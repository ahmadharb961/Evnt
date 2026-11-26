// Admin revenue simulator. Scenario maths only — never actual or guaranteed revenue.

export type Scenario = {
  proMerchants: number;
  proMonthlyCents: number;
  featuredMerchants: number;
  featuredMonthlyCents: number;
  bookings: number;
  avgCommissionCents: number;
  refundRatePct: number;
  paymentCostPct: number;
  operatingCostsCents: number;
};

export const DEFAULT_SCENARIO: Scenario = {
  proMerchants: 30,
  proMonthlyCents: 7900,
  featuredMerchants: 10,
  featuredMonthlyCents: 19900,
  bookings: 600,
  avgCommissionCents: 400,
  refundRatePct: 0,
  paymentCostPct: 0,
  operatingCostsCents: 0,
};

export function simulate(s: Scenario) {
  const subscriptions = s.proMerchants * s.proMonthlyCents + s.featuredMerchants * s.featuredMonthlyCents;
  const commissions = s.bookings * s.avgCommissionCents;
  const gross = subscriptions + commissions;
  const refunds = Math.round((commissions * s.refundRatePct) / 100);
  const paymentCosts = Math.round(((gross - refunds) * s.paymentCostPct) / 100);
  const net = gross - refunds - paymentCosts - s.operatingCostsCents;
  return { subscriptions, commissions, gross, refunds, paymentCosts, operatingCosts: s.operatingCostsCents, net };
}
