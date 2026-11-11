import "server-only";
import type { Merchant, MerchantType } from "@prisma/client";
import { prisma } from "./db";

// Which merchant tools to show: by business type (relevance) and subscription plan (paid features).

const SELLS_EVENTS: MerchantType[] = ["ACTIVITY_PROVIDER", "VENUE", "EVENT_ORGANIZER", "BIRTHDAY_SERVICE"];

export async function merchantFeatures(m: Pick<Merchant, "type" | "plan" | "status" | "restrictedAt">) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: m.plan } });
  const restricted = !!m.restrictedAt;
  return {
    events: SELLS_EVENTS.includes(m.type) || m.type === "RESTAURANT",
    seating: SELLS_EVENTS.includes(m.type),
    restaurant: m.type === "RESTAURANT",
    shop: m.type === "RETAILER" || m.type === "BIRTHDAY_SERVICE",
    birthdays: m.type === "BIRTHDAY_SERVICE" || m.type === "VENUE" || m.type === "RESTAURANT" || m.type === "ACTIVITY_PROVIDER",
    // Paid features (and switched off while invoices are seriously overdue)
    bookingManagement: !!plan?.bookingManagement && !restricted,
    advancedAnalytics: !!plan?.advancedAnalytics && !restricted,
    birthdayRadar: !!plan?.birthdayRadar && !restricted,
    demandIntelligence: !!plan?.demandIntelligence && !restricted,
    flashPromos: restricted ? 0 : plan?.flashPromosPerMonth ?? 0,
    advertising: !restricted,
    restricted,
  };
}

export type Features = Awaited<ReturnType<typeof merchantFeatures>>;
