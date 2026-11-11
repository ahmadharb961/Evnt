// Admin revenue simulator. Scenario maths only — never actual or guaranteed revenue.

export type Scenario = {
  proMerchants: number;
  proMonthlyCents: number;
  featuredMerchants: number;
  featuredMonthlyCents: number;
  members: number;
  memberMonthlyCents: number;
  bookings: number;
  avgCommissionCents: number;
  assessments: number;
  assessmentCents: number;
  refundRatePct: number;
  paymentCostPct: number;
  operatingCostsCents: number;
};

export const DEFAULT_SCENARIO: Scenario = {
  proMerchants: 30,
  proMonthlyCents: 7900,
  featuredMerchants: 10,
  featuredMonthlyCents: 19900,
  members: 200,
  memberMonthlyCents: 999,
  bookings: 600,
  avgCommissionCents: 400,
  assessments: 5,
  assessmentCents: 25000,
  refundRatePct: 0,
  paymentCostPct: 0,
  operatingCostsCents: 0,
};

export function simulate(s: Scenario) {
  const subscriptions = s.proMerchants * s.proMonthlyCents + s.featuredMerchants * s.featuredMonthlyCents;
  const memberships = s.members * s.memberMonthlyCents;
  const commissions = s.bookings * s.avgCommissionCents;
  const assessments = s.assessments * s.assessmentCents;
  const gross = subscriptions + memberships + commissions + assessments;
  const refunds = Math.round((commissions * s.refundRatePct) / 100);
  const paymentCosts = Math.round(((gross - refunds) * s.paymentCostPct) / 100);
  const net = gross - refunds - paymentCosts - s.operatingCostsCents;
  return { subscriptions, memberships, commissions, assessments, gross, refunds, paymentCosts, operatingCosts: s.operatingCostsCents, net };
}
