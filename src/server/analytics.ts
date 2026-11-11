import "server-only";
import { prisma } from "./db";
import { startOfBeirutDay } from "@/lib/dates";

/** Counts a listing view for the merchant's analytics (one row per merchant/day/listing). */
export async function trackView(merchantId: string, targetType: string, targetId: string) {
  const day = startOfBeirutDay(new Date());
  await prisma.dailyStat
    .upsert({
      where: { merchantId_day_targetType_targetId: { merchantId, day, targetType, targetId } },
      create: { merchantId, day, targetType, targetId, views: 1 },
      update: { views: { increment: 1 } },
    })
    .catch(() => {});
}

/** Merchant KPIs for a period. Only money actually received counts as revenue (no unpaid COD). */
export async function merchantKpis(merchantId: string, since: Date) {
  const [bookings, evntBookings, orders, views, leads, quotes, ledger, campaigns, reservations] = await Promise.all([
    prisma.booking.aggregate({ where: { merchantId, status: { in: ["CONFIRMED", "COMPLETED"] }, confirmedAt: { gte: since } }, _sum: { subtotalCents: true }, _count: { _all: true } }),
    prisma.booking.aggregate({ where: { merchantId, status: { in: ["CONFIRMED", "COMPLETED"] }, confirmedAt: { gte: since }, attribution: { not: "MERCHANT_LINK" } }, _sum: { subtotalCents: true } }),
    prisma.order.aggregate({ where: { merchantId, createdAt: { gte: since }, OR: [{ paidAt: { not: null } }, { codCollectedAt: { not: null } }], status: { notIn: ["CANCELED", "REFUNDED"] } }, _sum: { subtotalCents: true }, _count: { _all: true } }),
    prisma.dailyStat.aggregate({ where: { merchantId, day: { gte: since } }, _sum: { views: true } }),
    prisma.birthdayLead.count({ where: { merchantId, createdAt: { gte: since } } }),
    prisma.birthdayQuote.count({ where: { merchantId, createdAt: { gte: since } } }),
    prisma.ledgerEntry.aggregate({ where: { merchantId, settlementId: null }, _sum: { amountCents: true } }),
    prisma.adCampaign.aggregate({ where: { merchantId, createdAt: { gte: since } }, _sum: { impressions: true, clicks: true } }),
    prisma.restaurantReservation.aggregate({ where: { restaurant: { merchantId }, status: "COMPLETED", startsAt: { gte: since } }, _count: { _all: true }, _sum: { completedGuests: true } }),
  ]);
  const v = views._sum.views ?? 0;
  const conversions = bookings._count._all + orders._count._all;
  const balance = ledger._sum.amountCents ?? 0;
  return {
    revenueCents: (bookings._sum.subtotalCents ?? 0) + (orders._sum.subtotalCents ?? 0),
    evntRevenueCents: (evntBookings._sum.subtotalCents ?? 0) + (orders._sum.subtotalCents ?? 0),
    bookings: bookings._count._all,
    orders: orders._count._all,
    reservations: reservations._count._all,
    guests: reservations._sum.completedGuests ?? 0,
    views: v,
    leads: leads + quotes,
    conversionPct: v ? Math.round((conversions / v) * 1000) / 10 : 0,
    commissionPayableCents: balance < 0 ? -balance : 0,
    payoutDueCents: balance > 0 ? balance : 0,
    adImpressions: campaigns._sum.impressions ?? 0,
    adClicks: campaigns._sum.clicks ?? 0,
  };
}
