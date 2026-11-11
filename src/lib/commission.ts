// Pure commission maths. Rates come from the CommissionRate table (editable by super admin).

export type AttributionKind = "EVNT" | "EVNT_EXTERNAL" | "MERCHANT_LINK";

/** Share of the applicable rate EVNT earns for each attribution source, in percent. */
export function attributionShare(a: AttributionKind, externalSharePct = 50): number {
  if (a === "EVNT") return 100;
  if (a === "EVNT_EXTERNAL") return externalSharePct;
  return 0;
}

export function effectiveRateBps(rateBps: number, a: AttributionKind, externalSharePct = 50): number {
  return Math.round((rateBps * attributionShare(a, externalSharePct)) / 100);
}

/** Commission on a transaction. The base excludes EVNT's own fees. */
export function commissionFor(baseCents: number, rateBps: number, a: AttributionKind, externalSharePct = 50) {
  const bps = effectiveRateBps(rateBps, a, externalSharePct);
  return { rateBps: bps, amountCents: Math.max(0, Math.round((baseCents * bps) / 10_000)) };
}

/** Restaurants are charged per verified completed guest, according to the merchant's plan. */
export function restaurantFee(guests: number, feePerGuestCents: number) {
  return Math.max(0, Math.floor(guests)) * feePerGuestCents;
}

/** A Birthday Radar lead fee is credited against the commission of the same converted booking. */
export function applyLeadCredit(commissionCents: number, remainingLeadCents: number) {
  const credit = Math.max(0, Math.min(commissionCents, remainingLeadCents));
  return { creditCents: credit, netCommissionCents: commissionCents - credit };
}

/** Within the external-booking window after a contact click (default 72 hours)? */
export function withinExternalWindow(clickAt: Date, bookedAt: Date, hours = 72) {
  const diff = bookedAt.getTime() - clickAt.getTime();
  return diff >= 0 && diff <= hours * 3600_000;
}
