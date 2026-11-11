import "server-only";
import type { Attribution, CommissionCategory, PlanCode } from "@prisma/client";
import type { Tx } from "./db";
import { applyLeadCredit, commissionFor, restaurantFee } from "@/lib/commission";
import { getSetting } from "./settings";

// The commission engine. Every commission is one row per source transaction (unique), so it can
// never be charged twice. Balances live in the ledger: positive = EVNT owes the merchant.

export async function rateBps(tx: Tx, category: CommissionCategory, plan: PlanCode) {
  const r = await tx.commissionRate.findUnique({ where: { category_plan: { category, plan } } });
  return r?.rateBps ?? 0;
}

/** The commission category of an event (its own, else its parent category's). */
export async function eventCommissionCategory(tx: Tx, categoryId: string): Promise<CommissionCategory> {
  const c = await tx.category.findUnique({ where: { id: categoryId }, include: { parent: true } });
  return c?.commission ?? c?.parent?.commission ?? "FAMILY_EXPERIENCES";
}

/** Birthday Radar: unused lead fee this merchant paid for this parent's inquiry, credited once. */
async function leadCreditFor(tx: Tx, merchantId: string, userId: string) {
  const leads = await tx.birthdayLead.findMany({ where: { merchantId, inquiry: { userId } } });
  for (const l of leads) {
    const remaining = l.priceCents - l.creditedCents;
    if (remaining > 0) return { lead: l, remaining };
  }
  return null;
}

/**
 * Records the commission of a booking that is now confirmed.
 * - EVNT (paid through EVNT): EVNT collected the money → ledger SALE (+subtotal) and COMMISSION (−fee).
 * - Pay at venue: the merchant collected → the commission is owed by the merchant (COD_COMMISSION, −fee).
 * - Merchant link: 0% commission.
 */
export async function recordBookingCommission(
  tx: Tx,
  b: { id: string; code: string; merchantId: string; userId: string; subtotalCents: number; attribution: Attribution; paymentMethod: string; eventCategoryId: string; plan: PlanCode },
) {
  const category = await eventCommissionCategory(tx, b.eventCategoryId);
  const base = await rateBps(tx, category, b.plan);
  const share = await getSetting("attribution.externalSharePct");
  const { rateBps: eff, amountCents } = commissionFor(b.subtotalCents, base, b.attribution, share);
  let credit = 0;
  if (amountCents > 0) {
    const lc = await leadCreditFor(tx, b.merchantId, b.userId);
    if (lc) {
      credit = applyLeadCredit(amountCents, lc.remaining).creditCents;
      await tx.birthdayLead.update({ where: { id: lc.lead.id }, data: { creditedCents: { increment: credit }, convertedAt: lc.lead.convertedAt ?? new Date() } });
    }
  }
  const net = amountCents - credit;
  const existing = await tx.commission.findUnique({ where: { source_sourceId: { source: "BOOKING", sourceId: b.id } } });
  if (existing) return existing;
  const c = await tx.commission.create({
    data: {
      merchantId: b.merchantId,
      source: "BOOKING",
      sourceId: b.id,
      category,
      plan: b.plan,
      attribution: b.attribution,
      rateBps: eff,
      baseCents: b.subtotalCents,
      amountCents: net,
      leadCreditCents: credit,
      status: "EARNED",
      earnedAt: new Date(),
    },
  });
  const ref = { refType: "booking", refId: b.id };
  if (b.paymentMethod === "WHISH" || b.paymentMethod === "OFFLINE") {
    if (b.subtotalCents > 0) await tx.ledgerEntry.create({ data: { merchantId: b.merchantId, type: "SALE", amountCents: b.subtotalCents, memo: `Booking ${b.code}`, ...ref } });
    if (net > 0) await tx.ledgerEntry.create({ data: { merchantId: b.merchantId, type: "COMMISSION", amountCents: -net, memo: `Commission ${b.code}`, ...ref } });
  } else if (net > 0) {
    await tx.ledgerEntry.create({ data: { merchantId: b.merchantId, type: "COD_COMMISSION", amountCents: -net, memo: `Commission ${b.code} (paid at venue)`, ...ref } });
  }
  return c;
}

/**
 * Reverses a booking's commission proportionally to the refunded part of the subtotal.
 * `refundedSubtotalCents` is the part of the merchant's price refunded to the parent.
 */
export async function reverseBookingCommission(tx: Tx, b: { id: string; code: string; merchantId: string; subtotalCents: number; paymentMethod: string }, refundedSubtotalCents: number) {
  const c = await tx.commission.findUnique({ where: { source_sourceId: { source: "BOOKING", sourceId: b.id } } });
  const ref = { refType: "booking", refId: b.id };
  const collectedByEvnt = b.paymentMethod === "WHISH" || b.paymentMethod === "OFFLINE";
  if (collectedByEvnt && refundedSubtotalCents > 0)
    await tx.ledgerEntry.create({ data: { merchantId: b.merchantId, type: "REFUND", amountCents: -refundedSubtotalCents, memo: `Refund ${b.code}`, ...ref } });
  if (!c || c.status === "REVERSED" || c.amountCents <= 0) return;
  const full = refundedSubtotalCents >= b.subtotalCents;
  const back = full ? c.amountCents : Math.round((c.amountCents * refundedSubtotalCents) / Math.max(1, b.subtotalCents));
  if (back <= 0) return;
  await tx.commission.update({ where: { id: c.id }, data: { amountCents: c.amountCents - back, status: full ? "REVERSED" : c.status } });
  await tx.ledgerEntry.create({
    data: { merchantId: b.merchantId, type: collectedByEvnt ? "COMMISSION" : "COD_COMMISSION", amountCents: back, memo: `Commission reversed ${b.code}`, ...ref },
  });
}

/** Per-guest fee for a verified, completed restaurant reservation. */
export async function recordReservationCommission(tx: Tx, r: { id: string; code: string; merchantId: string; plan: PlanCode; guests: number }) {
  const plan = await tx.subscriptionPlan.findUnique({ where: { code: r.plan } });
  const amount = restaurantFee(r.guests, plan?.restaurantGuestFeeCents ?? 0);
  const existing = await tx.commission.findUnique({ where: { source_sourceId: { source: "RESERVATION", sourceId: r.id } } });
  if (existing) return existing;
  const c = await tx.commission.create({
    data: { merchantId: r.merchantId, source: "RESERVATION", sourceId: r.id, plan: r.plan, attribution: "EVNT", rateBps: 0, baseCents: 0, guests: r.guests, amountCents: amount, status: "EARNED", earnedAt: new Date() },
  });
  if (amount > 0)
    await tx.ledgerEntry.create({ data: { merchantId: r.merchantId, type: "COD_COMMISSION", amountCents: -amount, memo: `Reservation ${r.code}: ${r.guests} guests`, refType: "reservation", refId: r.id } });
  return c;
}

/** Retail commission on a shop order once its money is actually in (Whish paid, or COD collected). */
export async function recordOrderCommission(tx: Tx, o: { id: string; number: string; merchantId: string; plan: PlanCode; baseCents: number; paymentMethod: string; totalCents: number }) {
  const existing = await tx.commission.findUnique({ where: { source_sourceId: { source: "ORDER", sourceId: o.id } } });
  if (existing) return existing;
  const bps = await rateBps(tx, "RETAIL", o.plan);
  const { amountCents } = commissionFor(o.baseCents, bps, "EVNT");
  const c = await tx.commission.create({
    data: { merchantId: o.merchantId, source: "ORDER", sourceId: o.id, category: "RETAIL", plan: o.plan, attribution: "EVNT", rateBps: bps, baseCents: o.baseCents, amountCents, status: "EARNED", earnedAt: new Date() },
  });
  const ref = { refType: "order", refId: o.id };
  if (o.paymentMethod === "WHISH") {
    await tx.ledgerEntry.create({ data: { merchantId: o.merchantId, type: "SALE", amountCents: o.totalCents, memo: `Order ${o.number}`, ...ref } });
    if (amountCents > 0) await tx.ledgerEntry.create({ data: { merchantId: o.merchantId, type: "COMMISSION", amountCents: -amountCents, memo: `Commission ${o.number}`, ...ref } });
  } else if (amountCents > 0) {
    await tx.ledgerEntry.create({ data: { merchantId: o.merchantId, type: "COD_COMMISSION", amountCents: -amountCents, memo: `Commission ${o.number} (cash collected by merchant)`, ...ref } });
  }
  return c;
}

export async function reverseOrderCommission(tx: Tx, o: { id: string; number: string; merchantId: string; paymentMethod: string; baseCents: number }, refundedCents: number) {
  const c = await tx.commission.findUnique({ where: { source_sourceId: { source: "ORDER", sourceId: o.id } } });
  const ref = { refType: "order", refId: o.id };
  if (o.paymentMethod === "WHISH" && refundedCents > 0)
    await tx.ledgerEntry.create({ data: { merchantId: o.merchantId, type: "REFUND", amountCents: -refundedCents, memo: `Refund ${o.number}`, ...ref } });
  if (!c || c.status === "REVERSED" || c.amountCents <= 0) return;
  const full = refundedCents >= o.baseCents;
  const back = full ? c.amountCents : Math.round((c.amountCents * refundedCents) / Math.max(1, o.baseCents));
  await tx.commission.update({ where: { id: c.id }, data: { amountCents: c.amountCents - back, status: full ? "REVERSED" : c.status } });
  await tx.ledgerEntry.create({ data: { merchantId: o.merchantId, type: o.paymentMethod === "WHISH" ? "COMMISSION" : "COD_COMMISSION", amountCents: back, memo: `Commission reversed ${o.number}`, ...ref } });
}

export async function merchantBalance(tx: Tx, merchantId: string) {
  const r = await tx.ledgerEntry.aggregate({ where: { merchantId }, _sum: { amountCents: true } });
  return r._sum.amountCents ?? 0;
}
