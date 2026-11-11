import "server-only";
import type { BillingInterval } from "@prisma/client";
import { prisma } from "./db";
import { UserError } from "./auth";
import { getSetting } from "./settings";
import { notifyUser } from "./notify";

// EVNT+ family membership. Benefits are applied automatically where they're used:
// booking fee waived and 24h flexible cancellation (booking.ts), double points (membership.ts),
// 48h early access (salesState in booking.ts).

function cardNumber() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  const d = Array.from(b, (x) => String(x % 10)).join("") + String(Date.now()).slice(-6);
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8, 12)}`;
}

const addPeriod = (from: Date, interval: BillingInterval) => {
  const d = new Date(from);
  if (interval === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
};

/** Creates (or reuses) a membership awaiting payment. It becomes ACTIVE only after a verified payment. */
export async function prepareMembership(userId: string, interval: BillingInterval) {
  const price = interval === "YEARLY" ? await getSetting("membership.yearlyCents") : await getSetting("membership.monthlyCents");
  const existing = await prisma.membership.findUnique({ where: { userId } });
  if (existing && existing.status === "ACTIVE" && existing.currentPeriodEnd && existing.currentPeriodEnd > new Date() && !existing.cancelAtPeriodEnd && existing.interval === interval)
    throw new UserError("You're already an EVNT+ member");
  if (existing) return prisma.membership.update({ where: { id: existing.id }, data: { interval, priceCents: price, ...(existing.status === "ACTIVE" ? {} : { status: "PENDING_PAYMENT" }) } });
  return prisma.membership.create({ data: { userId, interval, priceCents: price, status: "PENDING_PAYMENT", cardNumber: cardNumber() } });
}

export async function applyMembershipPayment(paymentId: string, outcome: "success" | "failed") {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p?.membershipId) return;
  if (outcome === "failed") {
    await prisma.payment.updateMany({ where: { id: p.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: "FAILED" } });
    return;
  }
  const marked = await prisma.payment.updateMany({ where: { id: p.id, status: { in: ["INITIATED", "PENDING", "FAILED"] } }, data: { status: "SUCCEEDED", confirmedAt: new Date() } });
  if (!marked.count) return;
  const m = await prisma.membership.findUniqueOrThrow({ where: { id: p.membershipId } });
  const now = new Date();
  // Renewing early extends from the current end; otherwise the period starts now.
  const start = m.status === "ACTIVE" && m.currentPeriodEnd && m.currentPeriodEnd > now ? m.currentPeriodEnd : now;
  await prisma.membership.update({ where: { id: m.id }, data: { status: "ACTIVE", currentPeriodEnd: addPeriod(start, m.interval), cancelAtPeriodEnd: false, remindedAt: null } });
  await prisma.auditLog.create({ data: { actorId: m.userId, action: "membership.paid", entityType: "membership", entityId: m.id, data: { paymentId } } });
  await notifyUser(m.userId, { kind: "plus.active", title: "Welcome to EVNT+", body: "Your membership is active: no booking fees, double points and early access.", link: "/plus" });
}

export async function cancelMembership(userId: string) {
  const m = await prisma.membership.findUnique({ where: { userId } });
  if (!m || m.status !== "ACTIVE") throw new UserError("No active membership");
  await prisma.membership.update({ where: { id: m.id }, data: { cancelAtPeriodEnd: true } });
}

export async function resumeMembership(userId: string) {
  await prisma.membership.updateMany({ where: { userId, status: "ACTIVE" }, data: { cancelAtPeriodEnd: false } });
}

/** Admin-granted membership (e.g. partner gift). Recorded in the audit log, no payment involved. */
export async function grantMembership(userId: string, months: number, actorId: string) {
  const end = new Date();
  end.setMonth(end.getMonth() + Math.max(1, Math.min(24, months)));
  const existing = await prisma.membership.findUnique({ where: { userId } });
  if (existing) await prisma.membership.update({ where: { id: existing.id }, data: { status: "ACTIVE", currentPeriodEnd: end, cancelAtPeriodEnd: true, priceCents: 0 } });
  else await prisma.membership.create({ data: { userId, interval: "MONTHLY", status: "ACTIVE", priceCents: 0, currentPeriodEnd: end, cancelAtPeriodEnd: true, cardNumber: cardNumber() } });
  await prisma.auditLog.create({ data: { actorId, action: "membership.granted", entityType: "user", entityId: userId, data: { months } } });
}

/** Cron: renewal reminders 3 days before the end, and expiry. */
export async function runMemberships(now = new Date()) {
  const soon = new Date(now.getTime() + 3 * 86400_000);
  const remind = await prisma.membership.findMany({ where: { status: "ACTIVE", cancelAtPeriodEnd: false, remindedAt: null, currentPeriodEnd: { lte: soon, gt: now } } });
  for (const m of remind) {
    await notifyUser(m.userId, { kind: "plus.renewal", title: "Your EVNT+ membership renews soon", body: "Renew now to keep your benefits without interruption.", link: "/plus" });
    await prisma.membership.update({ where: { id: m.id }, data: { remindedAt: now } });
  }
  const expired = await prisma.membership.updateMany({ where: { status: "ACTIVE", currentPeriodEnd: { lt: now } }, data: { status: "EXPIRED" } });
  return { reminded: remind.length, expired: expired.count };
}
