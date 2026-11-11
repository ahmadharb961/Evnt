import "server-only";
import { prisma } from "../db";
import { UserError } from "../auth";
import { appUrl } from "../urls";
import { createWhishPayment, fetchWhishStatus, whishAvailable } from "./whish";
import { applyBookingPayment } from "../booking";

export { whishAvailable };

type Purpose = "BOOKING" | "ORDER" | "INVOICE" | "MEMBERSHIP" | "RESERVATION_DEPOSIT";

/** Dispatches a verified payment outcome to the module that owns it. */
async function applyOutcome(paymentId: string, outcome: "success" | "failed") {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) return;
  if (p.purpose === "BOOKING") return applyBookingPayment(paymentId, outcome);
  const { applyOrderPayment } = await import("../orders");
  const { applyInvoicePayment } = await import("../billing");
  const { applyMembershipPayment } = await import("../plus");
  if (p.purpose === "ORDER") return applyOrderPayment(paymentId, outcome);
  if (p.purpose === "INVOICE") return applyInvoicePayment(paymentId, outcome);
  if (p.purpose === "MEMBERSHIP") return applyMembershipPayment(paymentId, outcome);
}

/**
 * Starts a Whish payment. Returns the URL of the Whish payment page.
 * Throws a clear error when Whish is not enabled: EVNT never simulates a successful payment.
 */
export async function startWhishPayment(p: {
  purpose: Purpose;
  amountCents: number;
  description: string;
  userId?: string;
  merchantId?: string;
  bookingId?: string;
  orderGroupId?: string;
  invoiceId?: string;
  membershipId?: string;
  returnPath: string;
}) {
  if (!(await whishAvailable())) throw new UserError("Online payment with Whish is not available yet");
  if (p.amountCents <= 0) throw new UserError("Nothing to pay");
  const ref = p.bookingId ?? p.orderGroupId ?? p.invoiceId ?? p.membershipId ?? "x";
  const attempt = await prisma.payment.count({ where: { purpose: p.purpose, OR: [{ bookingId: ref }, { orderGroupId: ref }, { invoiceId: ref }, { membershipId: ref }] } });
  const payment = await prisma.payment.create({
    data: {
      purpose: p.purpose,
      method: "WHISH",
      status: "INITIATED",
      amountCents: p.amountCents,
      idempotencyKey: `${p.purpose}:${ref}:${attempt + 1}`,
      userId: p.userId,
      merchantId: p.merchantId,
      bookingId: p.bookingId,
      orderGroupId: p.orderGroupId,
      invoiceId: p.invoiceId,
      membershipId: p.membershipId,
    },
  });
  try {
    const back = `${appUrl()}/pay/return?pid=${payment.id}&next=${encodeURIComponent(p.returnPath)}`;
    const { redirectUrl } = await createWhishPayment({
      externalId: payment.id,
      amountCents: p.amountCents,
      description: p.description,
      successUrl: back,
      failureUrl: back,
      callbackUrl: `${appUrl()}/api/webhooks/whish?pid=${payment.id}`,
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "PENDING" } });
    return { paymentId: payment.id, redirectUrl };
  } catch (e) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: String((e as Error).message).slice(0, 200) } });
    throw new UserError("We couldn't start the Whish payment. Please try again.");
  }
}

/**
 * Re-checks a pending Whish payment with Whish (server to server) and applies the result.
 * Used by the provider callback, the return page and the cron job.
 */
export async function syncWhishPayment(paymentId: string, eventId?: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.method !== "WHISH") return null;
  if (p.status === "SUCCEEDED" || p.status === "REFUNDED") return p.status;
  const { status, raw } = await fetchWhishStatus(p.id);
  const evId = eventId ?? `status:${p.id}:${status}`;
  await prisma.paymentEvent.upsert({
    where: { providerEventId: evId },
    create: { provider: "whish", providerEventId: evId, paymentId: p.id, verified: true, payload: (raw ?? {}) as object },
    update: {},
  });
  if (status === "success") await applyOutcome(p.id, "success");
  else if (status === "failed") await applyOutcome(p.id, "failed");
  return (await prisma.payment.findUnique({ where: { id: p.id } }))?.status ?? null;
}

/** Cron: re-check pending payments (in case a callback was missed). */
export async function syncPendingPayments() {
  const pending = await prisma.payment.findMany({ where: { method: "WHISH", status: "PENDING", createdAt: { gt: new Date(Date.now() - 2 * 86400_000) } }, take: 100 });
  for (const p of pending) await syncWhishPayment(p.id).catch((e) => console.error("[whish] sync", p.id, e));
  return pending.length;
}
