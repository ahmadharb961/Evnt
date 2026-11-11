import "server-only";
import { prisma } from "./db";
import { mediaSrc } from "./media";
import { activeFlashPercent, salesState, seatStates } from "./booking";
import { loc, type Locale } from "@/i18n/core";
import { areaName } from "@/lib/areas";

export async function loadEventPage(slug: string, locale: Locale, userId?: string | null) {
  const e = await prisma.event.findUnique({
    where: { slug },
    include: {
      merchant: true,
      location: true,
      category: { include: { parent: true } },
      media: { orderBy: { sort: "asc" } },
      ticketTypes: { where: { active: true }, orderBy: { sort: "asc" } },
      sessions: { where: { status: "SCHEDULED", startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 60 },
      seatingMap: true,
    },
  });
  if (!e) return null;
  const pct = await activeFlashPercent(e.id);
  const seatCount = e.seatingMap ? await prisma.seat.count({ where: { mapId: e.seatingMap.id, blocked: false } }) : 0;
  const taken =
    e.seatingMode === "ASSIGNED" && e.sessions.length
      ? new Map(
          (
            await prisma.seatClaim.groupBy({
              by: ["sessionId"],
              where: { sessionId: { in: e.sessions.map((s) => s.id) }, OR: [{ status: { in: ["CONFIRMED", "RESERVED"] } }, { status: "HELD", expiresAt: { gt: new Date() } }] },
              _count: { _all: true },
            })
          ).map((r) => [r.sessionId, r._count._all]),
        )
      : new Map<string, number>();
  const sessions = await Promise.all(
    e.sessions.map(async (s) => {
      const remaining = e.seatingMode === "ASSIGNED" ? seatCount - (taken.get(s.id) ?? 0) : s.capacity - s.reserved;
      const sales = await salesState(s, e, userId);
      return {
        id: s.id,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        remaining: Math.max(0, remaining),
        open: sales.open,
        early: sales.open && "early" in sales ? !!sales.early : false,
        reason: sales.open ? null : sales.reason,
        opensAt: !sales.open && "opensAt" in sales && sales.opensAt ? sales.opensAt.toISOString() : null,
      };
    }),
  );
  const gallery = [mediaSrc(e.coverId, e.coverUrl), ...e.media.map((m) => mediaSrc(m.mediaId, m.url))];
  const now = new Date();
  return {
    raw: e,
    id: e.id,
    slug: e.slug,
    status: e.status,
    merchantApproved: e.merchant.status === "APPROVED",
    title: loc(e.title, locale),
    summary: loc(e.summary, locale),
    description: loc(e.description, locale),
    included: loc(e.included, locale),
    importantInfo: loc(e.importantInfo, locale),
    cancellationPolicy: loc(e.cancellationPolicy, locale),
    gallery,
    videoUrl: e.videoUrl,
    category: { name: loc(e.category.name, locale), slug: e.category.slug, parent: e.category.parent ? { name: loc(e.category.parent.name, locale), slug: e.category.parent.slug } : null },
    merchant: { id: e.merchant.id, name: e.merchant.name, slug: e.merchant.slug, whatsapp: e.merchant.whatsapp, logo: e.merchant.logoId ? mediaSrc(e.merchant.logoId) : null, farah: !!e.merchant.farahUntil && e.merchant.farahUntil > now },
    location: e.location ? { name: e.location.name, address: e.location.address, area: areaName(e.location.area, locale), areaSlug: e.location.area, lat: e.location.lat, lng: e.location.lng } : null,
    ageMin: e.ageMin,
    ageMax: e.ageMax,
    setting: e.setting,
    isFree: e.isFree,
    accessible: e.accessible,
    payAtVenue: e.payAtVenue,
    memberEarlyAccess: e.memberEarlyAccess,
    seatingMode: e.seatingMode,
    flashPercent: pct,
    ticketTypes: e.ticketTypes.map((t) => ({ id: t.id, name: loc(t.name, locale), priceCents: t.priceCents, zone: t.zone, minQty: t.minQty, maxQty: t.maxQty })),
    sessions,
    seatingMap: e.seatingMap ? { id: e.seatingMap.id, width: e.seatingMap.width, height: e.seatingMap.height, zones: e.seatingMap.zones as { key: string; name: string; color: string }[], labels: (e.seatingMap.labels ?? []) as { text: string; x: number; y: number; w: number }[] } : null,
    rating: e.ratingAvg,
    ratingCount: e.ratingCount,
  };
}

export type EventPageData = NonNullable<Awaited<ReturnType<typeof loadEventPage>>>;

export async function seatMapFor(sessionId: string, mapId: string, holdIds: string[] = []) {
  return seatStates(sessionId, mapId, holdIds);
}
