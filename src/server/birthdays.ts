import "server-only";
import { prisma } from "./db";
import { UserError } from "./auth";
import { notifyMerchant, notifyUser } from "./notify";

export const SERVICES = ["venue", "entertainer", "decoration", "cake", "photographer", "package", "activity"] as const;
export type Service = (typeof SERVICES)[number];

/** A request is "qualified" when it's specific enough for a business to act on. */
export function qualifies(i: { date: Date; guests: number; budgetCents: number; services: string[] }) {
  const days = (i.date.getTime() - Date.now()) / 86400_000;
  return days >= 3 && days <= 180 && i.guests >= 5 && i.budgetCents >= 10000 && i.services.length > 0;
}

export async function createInquiry(userId: string, d: { childAge: number; date: Date; area: string; guests: number; budgetCents: number; services: string[]; notes?: string; phone: string }) {
  if (d.childAge < 0 || d.childAge > 16) throw new UserError("Enter your child's age");
  if (d.date < new Date()) throw new UserError("Choose a future date");
  if (d.guests < 1 || d.guests > 500) throw new UserError("Enter the number of guests");
  const services = d.services.filter((s) => (SERVICES as readonly string[]).includes(s));
  if (!services.length) throw new UserError("Choose at least one service");
  const recent = await prisma.birthdayInquiry.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 86400_000) } } });
  if (recent >= 3) throw new UserError("You've sent several requests today. Please try again tomorrow.");
  return prisma.birthdayInquiry.create({
    data: { userId, childAge: d.childAge, date: d.date, area: d.area, guests: d.guests, budgetCents: d.budgetCents, services, notes: d.notes?.slice(0, 600), contactPhone: d.phone, consentAt: new Date(), qualified: qualifies({ ...d, services }) },
  });
}

/** Businesses that match an inquiry: birthday services, venues, birthday-friendly restaurants, party packages. */
export async function matchingMerchants(inquiryId: string) {
  const i = await prisma.birthdayInquiry.findUniqueOrThrow({ where: { id: inquiryId } });
  const merchants = await prisma.merchant.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { type: { in: ["BIRTHDAY_SERVICE", "VENUE"] } },
        { restaurants: { some: { birthdaySuitable: true, status: "PUBLISHED" } } },
        { events: { some: { status: "PUBLISHED", category: { OR: [{ slug: "birthdays-parties" }, { parent: { slug: "birthdays-parties" } }] } } } },
      ],
    },
    include: { locations: { select: { area: true } }, events: { where: { status: "PUBLISHED", category: { OR: [{ slug: "birthdays-parties" }, { parent: { slug: "birthdays-parties" } }] } }, select: { fromPriceCents: true, slug: true, title: true }, take: 3 } },
    take: 60,
  });
  return merchants
    .map((m) => ({ m, score: (m.locations.some((l) => l.area === i.area) ? 5 : 0) + m.ratingAvg + (m.events.some((e) => e.fromPriceCents <= i.budgetCents) ? 2 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}

export async function requestQuotes(userId: string, inquiryId: string, merchantIds: string[]) {
  const i = await prisma.birthdayInquiry.findUnique({ where: { id: inquiryId } });
  if (!i || i.userId !== userId) throw new UserError("Not found");
  const ids = [...new Set(merchantIds)].slice(0, 8);
  const valid = await prisma.merchant.findMany({ where: { id: { in: ids }, status: "APPROVED" }, select: { id: true } });
  for (const m of valid) {
    const created = await prisma.birthdayQuote.upsert({ where: { inquiryId_merchantId: { inquiryId, merchantId: m.id } }, create: { inquiryId, merchantId: m.id }, update: {} });
    if (created.createdAt.getTime() > Date.now() - 5000)
      await notifyMerchant(m.id, { kind: "birthday.quote", title: "New birthday quote request", body: "A parent is planning a birthday and asked for your quote.", link: "/merchant/leads" });
  }
  return valid.length;
}

export async function sendQuote(quoteId: string, merchantId: string, priceCents: number | null, message: string, decline = false) {
  const q = await prisma.birthdayQuote.findUnique({ where: { id: quoteId }, include: { inquiry: true, merchant: true } });
  if (!q || q.merchantId !== merchantId) throw new UserError("Not found");
  await prisma.birthdayQuote.update({ where: { id: q.id }, data: { status: decline ? "DECLINED" : "QUOTED", priceCents: decline ? null : priceCents, message: message.slice(0, 1000) } });
  await notifyUser(q.inquiry.userId, {
    kind: "birthday.quoted",
    title: decline ? "{name} can't take your party" : "{name} sent you a quote",
    body: decline ? "They're not available. Check your other quotes." : "Open your birthday plan to see the price and message.",
    vars: { name: q.merchant.name },
    link: `/birthdays/plan/${q.inquiryId}`,
  });
}

