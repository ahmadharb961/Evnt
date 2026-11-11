import "server-only";
import { prisma } from "./db";
import { searchEvents } from "./listings";
import { AGE_BANDS } from "@/lib/areas";
import type { Locale } from "@/i18n/core";
import type { EventCardData } from "@/lib/types";

/**
 * "Picked for you": uses only what the parent chose to share (age bands, interests, areas, budget)
 * plus their favorites and past bookings. Returns [] when there's nothing to personalise on.
 */
export async function recommendedEvents(userId: string, locale: Locale, limit = 12): Promise<EventCardData[]> {
  const [profile, favs, booked] = await Promise.all([
    prisma.familyProfile.findUnique({ where: { userId } }),
    prisma.favorite.findMany({ where: { userId, targetType: "event" }, select: { targetId: true }, take: 50 }),
    prisma.booking.findMany({ where: { userId, status: { in: ["CONFIRMED", "COMPLETED"] } }, select: { eventId: true, event: { select: { categoryId: true } } }, take: 50 }),
  ]);
  if (!profile && !favs.length && !booked.length) return [];

  const bands = AGE_BANDS.filter((b) => profile?.ageBands.includes(b.key));
  const ageMin = bands.length ? Math.min(...bands.map((b) => b.min)) : undefined;
  const ageMax = bands.length ? Math.max(...bands.map((b) => b.max)) : undefined;
  const { items } = await searchEvents({ ageMin, ageMax, maxPriceCents: profile?.maxBudgetCents ?? undefined, limit: 120, sort: "soonest" }, locale);

  const favEvents = favs.length ? await prisma.event.findMany({ where: { id: { in: favs.map((f) => f.targetId) } }, select: { categoryId: true } }) : [];
  const likedCats = new Set([...favEvents.map((e) => e.categoryId), ...booked.map((b) => b.event.categoryId)]);
  const interestCats = profile?.interests.length
    ? new Set((await prisma.category.findMany({ where: { OR: [{ slug: { in: profile.interests } }, { parent: { slug: { in: profile.interests } } }] }, select: { id: true } })).map((c) => c.id))
    : new Set<string>();
  const bookedIds = new Set(booked.map((b) => b.eventId));
  const rows = await prisma.event.findMany({ where: { id: { in: items.map((i) => i.id) } }, select: { id: true, categoryId: true } });
  const catOf = new Map(rows.map((r) => [r.id, r.categoryId]));
  const areas = new Set(profile?.preferredAreas ?? []);

  return items
    .filter((i) => !bookedIds.has(i.id) && i.availability !== "soldout")
    .map((i) => {
      const cat = catOf.get(i.id)!;
      const score = (interestCats.has(cat) ? 5 : 0) + (likedCats.has(cat) ? 3 : 0) + (i.area && areas.has(i.area) ? 4 : 0) + Math.min(i.ratingCount, 10) * 0.2;
      return { i, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.i);
}
