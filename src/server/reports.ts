import "server-only";
import { prisma } from "./db";

/**
 * Platform financials for a period. Revenue only counts money actually received:
 * - Online payments that SUCCEEDED (not pending/failed)
 * - COD only once the merchant recorded the cash as collected
 * - Commissions only when EARNED/INVOICED/SETTLED (never PENDING or REVERSED)
 */
export async function platformFinancials(since: Date, until = new Date()) {
  const range = { gte: since, lt: until };
  const [subs, membership, commissions, leads, certs, ads, reports, refunds, codCollected, codUncollected, gmvBookings, gmvOrders, payments] = await Promise.all([
    prisma.invoiceLine.aggregate({ where: { kind: "SUBSCRIPTION", invoice: { status: "PAID", paidAt: range } }, _sum: { amountCents: true } }),
    prisma.payment.aggregate({ where: { purpose: "MEMBERSHIP", status: "SUCCEEDED", confirmedAt: range }, _sum: { amountCents: true } }),
    prisma.commission.aggregate({ where: { status: { in: ["EARNED", "INVOICED", "SETTLED"] }, earnedAt: range }, _sum: { amountCents: true } }),
    prisma.invoiceLine.aggregate({ where: { kind: "LEAD", invoice: { status: "PAID", paidAt: range } }, _sum: { amountCents: true } }),
    prisma.invoiceLine.aggregate({ where: { kind: "CERTIFICATION", invoice: { status: "PAID", paidAt: range } }, _sum: { amountCents: true } }),
    prisma.invoiceLine.aggregate({ where: { kind: "ADVERTISING", invoice: { status: "PAID", paidAt: range } }, _sum: { amountCents: true } }),
    prisma.invoiceLine.aggregate({ where: { kind: "REPORT", invoice: { status: "PAID", paidAt: range } }, _sum: { amountCents: true } }),
    prisma.refund.aggregate({ where: { status: "PROCESSED", processedAt: range }, _sum: { amountCents: true } }),
    prisma.order.aggregate({ where: { paymentMethod: "COD", codCollectedAt: range }, _sum: { codCollectedCents: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { paymentMethod: "COD", codCollectedAt: null, status: { in: ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"] }, createdAt: range }, _sum: { totalCents: true }, _count: { _all: true } }),
    prisma.booking.aggregate({ where: { status: { in: ["CONFIRMED", "COMPLETED"] }, confirmedAt: range }, _sum: { subtotalCents: true, feeCents: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { OR: [{ paidAt: range }, { codCollectedAt: range }], status: { notIn: ["CANCELED", "REFUNDED"] } }, _sum: { subtotalCents: true }, _count: { _all: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", confirmedAt: range, method: "WHISH" }, _sum: { amountCents: true }, _count: { _all: true } }),
  ]);
  const n = (v: number | null | undefined) => v ?? 0;
  const bookingFees = n(gmvBookings._sum.feeCents);
  const revenue = {
    subscriptions: n(subs._sum.amountCents),
    memberships: n(membership._sum.amountCents),
    commissions: n(commissions._sum.amountCents),
    bookingFees,
    leads: n(leads._sum.amountCents),
    certifications: n(certs._sum.amountCents),
    advertising: n(ads._sum.amountCents),
    reports: n(reports._sum.amountCents),
  };
  const gross = Object.values(revenue).reduce((a, b) => a + b, 0);
  return {
    revenue,
    gross,
    refunds: n(refunds._sum.amountCents),
    codCollected: { cents: n(codCollected._sum.codCollectedCents), count: codCollected._count._all },
    codUncollected: { cents: n(codUncollected._sum.totalCents), count: codUncollected._count._all },
    gmv: { bookings: n(gmvBookings._sum.subtotalCents), orders: n(gmvOrders._sum.subtotalCents), bookingCount: gmvBookings._count._all, orderCount: gmvOrders._count._all },
    whish: { cents: n(payments._sum.amountCents), count: payments._count._all },
  };
}
