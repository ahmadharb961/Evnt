import type { PrismaClient } from "@prisma/client";

/** The sample businesses created by the demo seed. Real businesses are never touched. */
export const DEMO_MERCHANT_SLUGS = ["little-makers-studio", "cedar-kids-theater", "green-valley-farm", "tiny-chefs-academy", "sunny-camp-lebanon", "party-lane", "cafe-bloom", "the-garden-table", "seaside-family-grill", "toybox-beirut", "mini-mode"];

const DAY = 86400_000;

/**
 * Keeps demo activities bookable: any demo activity with fewer than 3 dates in the future gets its
 * original schedule repeated, on the same weekdays and times, starting from the next matching week.
 * Past dates and existing bookings are left as they are. Safe to run any number of times.
 */
export async function refreshDemoSessions(db: PrismaClient, now = new Date()): Promise<number> {
  const events = await db.event.findMany({
    where: { merchant: { slug: { in: DEMO_MERCHANT_SLUGS } }, status: "PUBLISHED" },
    select: { id: true, sessions: { select: { startsAt: true, endsAt: true, capacity: true }, orderBy: { startsAt: "asc" } } },
  });
  let added = 0;
  for (const e of events) {
    const soon = now.getTime() + DAY;
    if (e.sessions.filter((s) => s.startsAt.getTime() > soon).length >= 3 || !e.sessions.length) continue;
    // The original schedule: the first two weeks of dates this activity was created with.
    const first = e.sessions[0].startsAt.getTime();
    const template = e.sessions.filter((s) => s.startsAt.getTime() - first < 14 * DAY);
    // Move it forward by whole weeks so every date lands after tomorrow (weekdays stay the same).
    const weeks = Math.max(0, Math.ceil((soon - first) / (7 * DAY)));
    const existing = new Set(e.sessions.map((s) => s.startsAt.getTime()));
    for (const rep of [0, 2]) {
      for (const s of template) {
        const startsAt = new Date(s.startsAt.getTime() + (weeks + rep) * 7 * DAY);
        if (startsAt.getTime() <= soon || existing.has(startsAt.getTime())) continue;
        await db.eventSession.create({ data: { eventId: e.id, startsAt, endsAt: new Date(startsAt.getTime() + (s.endsAt.getTime() - s.startsAt.getTime())), capacity: s.capacity } });
        existing.add(startsAt.getTime());
        added++;
      }
    }
  }
  return added;
}

let lastCheck = 0;
/** Demo sites only: makes sure sample activities have upcoming dates, checked at most once an hour. */
export async function ensureDemoDates(db: PrismaClient) {
  if (process.env.SEED_DEMO !== "true" || Date.now() - lastCheck < 3600_000) return;
  lastCheck = Date.now();
  try {
    await refreshDemoSessions(db);
  } catch (e) {
    console.error("[demo-dates]", e);
  }
}
