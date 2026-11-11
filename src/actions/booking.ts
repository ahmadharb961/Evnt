"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/server/db";
import { getCurrentUser, UserError } from "@/server/auth";
import { cancelBooking, confirmWithoutOnlinePayment, saveCheckoutDetails, seatStates, startBooking } from "@/server/booking";
import { startWhishPayment } from "@/server/payments";
import { rateLimit } from "@/server/rate-limit";
import { normalizeMobile } from "@/lib/phone";
import { getLocale, getT } from "@/i18n/server";

export type ActionResult = { error?: string; needsLogin?: boolean } | undefined;

const startSchema = z.object({
  sessionId: z.string().min(10).max(40),
  items: z.array(z.object({ ticketTypeId: z.string().min(10).max(40), quantity: z.number().int().min(0).max(50) })).max(20),
  seatIds: z.array(z.string().min(10).max(40)).max(12).optional(),
  seatTickets: z.record(z.string(), z.string()).optional(),
  returnTo: z.string().max(300),
});

/** Step 1–3 → creates a hold and a pending booking, then goes to checkout. */
export async function startBookingAction(input: z.infer<typeof startSchema>): Promise<ActionResult> {
  const t = await getT();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { error: t("Please check your selection") };
  const user = await getCurrentUser();
  if (!user) return { needsLogin: true };
  if (!rateLimit(`book:${user.id}`, 20, 10 * 60_000).ok) return { error: t("Too many attempts. Try again in a few minutes.") };
  let code: string;
  try {
    ({ code } = await startBooking({ userId: user.id, sessionId: parsed.data.sessionId, items: parsed.data.items, seatIds: parsed.data.seatIds, seatTickets: parsed.data.seatTickets, locale: await getLocale() }));
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  redirect(`/checkout/${code}`);
}

/** Live seat states for the picker (polled while choosing). */
export async function seatStatesAction(sessionId: string) {
  const s = await prisma.eventSession.findUnique({ where: { id: sessionId }, include: { event: { select: { seatingMapId: true, status: true } } } });
  if (!s?.event.seatingMapId || s.event.status !== "PUBLISHED") return [];
  return seatStates(sessionId, s.event.seatingMapId);
}

export type CheckoutState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

/** Final step: contact + attendee details, then the chosen payment route. */
export async function checkoutAction(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in") };
  const code = String(form.get("code") ?? "");
  const method = String(form.get("method") ?? "");
  const contactName = String(form.get("contactName") ?? "").trim();
  if (contactName.length < 2) return { fieldErrors: { contactName: t("Enter your name") } };
  const phone = normalizeMobile(String(form.get("contactPhone") ?? ""));
  if (!phone.ok) return { fieldErrors: { contactPhone: t(phone.error) } };
  const attendees = form.getAll("attendee").map((v) => ({ name: String(v).trim().slice(0, 80) }));
  if (form.get("policy") !== "on") return { fieldErrors: { policy: t("Please accept the cancellation policy") } };
  const booking = await prisma.booking.findUnique({ where: { code }, include: { event: true } });
  if (!booking || booking.userId !== user.id) return { error: t("Booking not found") };
  try {
    await saveCheckoutDetails(code, user.id, { contactName, contactPhone: phone.e164, attendees });
    if (method === "FREE" || method === "PAY_AT_VENUE") {
      await confirmWithoutOnlinePayment(code, user.id, method);
    } else if (method === "WHISH") {
      const { redirectUrl } = await startWhishPayment({
        purpose: "BOOKING",
        amountCents: booking.totalCents,
        description: `EVNT booking ${booking.code}`,
        userId: user.id,
        merchantId: booking.merchantId,
        bookingId: booking.id,
        returnPath: `/account/bookings/${booking.code}`,
      });
      // Give the parent time on the Whish page without losing their seats.
      const ext = new Date(Date.now() + 10 * 60_000);
      await prisma.inventoryHold.updateMany({ where: { bookingId: booking.id, released: false, expiresAt: { lt: ext } }, data: { expiresAt: ext } });
      await prisma.seatClaim.updateMany({ where: { hold: { bookingId: booking.id }, status: "HELD" }, data: { expiresAt: ext } });
      await prisma.booking.update({ where: { id: booking.id }, data: { holdExpiresAt: ext } });
      redirect(redirectUrl);
    } else return { error: t("Choose a payment method") };
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  redirect(`/account/bookings/${code}?new=1`);
}

export async function cancelMyBookingAction(code: string, reason: string): Promise<ActionResult> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in") };
  try {
    await cancelBooking(code, { userId: user.id, as: "customer" }, reason || "Cancelled by parent");
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  return {};
}
