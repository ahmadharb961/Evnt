import "server-only";
import type { HomeSection } from "@prisma/client";
import { prisma } from "./db";
import { searchEvents, searchProducts, searchRestaurants, type EventFilters } from "./listings";
import { loc, type Locale } from "@/i18n/core";
import type { CardData } from "@/lib/types";

export type ResolvedSection = {
  id: string;
  title: string;
  subtitle: string;
  bannerUrl: string | null;
  layout: "CAROUSEL" | "GRID";
  ctaText: string;
  ctaHref: string | null;
  sponsored: boolean;
  items: CardData[];
};

type SectionFilters = {
  categorySlug?: string;
  ageMin?: number;
  ageMax?: number;
  area?: string;
  maxPriceCents?: number;
  free?: boolean;
  weekend?: boolean;
  when?: string;
  setting?: "INDOOR" | "OUTDOOR";
  sort?: EventFilters["sort"];
};

/** Sections visible right now (admin can schedule start/end dates). */
export async function activeSections(now = new Date()) {
  return prisma.homeSection.findMany({
    where: {
      visible: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: { sort: "asc" },
  });
}

/** Approved, running sponsored campaigns for a placement. Counted as impressions when shown. */
export async function liveCampaigns(placementCode: string, opts: { categoryId?: string } = {}) {
  const now = new Date();
  return prisma.adCampaign.findMany({
    where: { placementCode, status: "APPROVED", startsAt: { lte: now }, endsAt: { gt: now }, ...(opts.categoryId ? { categoryId: opts.categoryId } : {}) },
    orderBy: { approvedAt: "asc" },
  });
}

export async function resolveSection(s: HomeSection, locale: Locale): Promise<ResolvedSection> {
  const f = (s.filters ?? {}) as SectionFilters;
  const manual = s.mode === "MANUAL" && s.itemIds.length ? s.itemIds : undefined;
  let items: CardData[] = [];
  if (s.source === "EVENTS") {
    items = (
      await searchEvents(
        {
          ids: manual,
          categorySlug: f.categorySlug,
          ageMin: f.ageMin,
          ageMax: f.ageMax,
          area: f.area,
          maxPriceCents: f.maxPriceCents,
          free: f.free,
          setting: f.setting,
          when: f.weekend ? "weekend" : f.when,
          sort: f.sort,
          limit: s.limit,
        },
        locale,
      )
    ).items;
  } else if (s.source === "RESTAURANTS") {
    items = (await searchRestaurants({ ids: manual, area: f.area, limit: s.limit }, locale)).items;
  } else if (s.source === "PRODUCTS") {
    items = (await searchProducts({ ids: manual, categorySlug: f.categorySlug, maxPriceCents: f.maxPriceCents, ageMin: f.ageMin, ageMax: f.ageMax, limit: s.limit }, locale)).items;
  } else if (s.source === "FARAH") {
    const [ev, rs] = await Promise.all([searchEvents({ farah: true, limit: s.limit }, locale), searchRestaurants({ farah: true, limit: s.limit }, locale)]);
    items = [...rs.items, ...ev.items].slice(0, s.limit);
  } else if (s.source === "SPONSORED") {
    const camps = await liveCampaigns("HOMEPAGE_FEATURED");
    const evIds = camps.filter((c) => c.eventId).map((c) => c.eventId!);
    const rsIds = camps.filter((c) => c.restaurantId).map((c) => c.restaurantId!);
    const prIds = camps.filter((c) => c.productId).map((c) => c.productId!);
    const [ev, rs, pr] = await Promise.all([
      evIds.length ? searchEvents({ ids: evIds, limit: 20 }, locale) : { items: [] },
      rsIds.length ? searchRestaurants({ ids: rsIds, limit: 20 }, locale) : { items: [] },
      prIds.length ? searchProducts({ ids: prIds, limit: 20 }, locale) : { items: [] },
    ]);
    items = [...ev.items, ...rs.items, ...pr.items].map((i) => ({ ...i, sponsored: true }));
    if (camps.length) await prisma.adCampaign.updateMany({ where: { id: { in: camps.map((c) => c.id) } }, data: { impressions: { increment: 1 } } });
  }
  if (s.sponsored) items = items.map((i) => ({ ...i, sponsored: true }));
  return {
    id: s.id,
    title: loc(s.title, locale),
    subtitle: loc(s.subtitle, locale),
    bannerUrl: s.bannerId ? `/media/${s.bannerId}` : s.bannerUrl,
    layout: s.layout === "GRID" ? "GRID" : "CAROUSEL",
    ctaText: loc(s.ctaText, locale),
    ctaHref: s.ctaHref,
    sponsored: s.sponsored,
    items,
  };
}

export async function favoriteIds(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await prisma.favorite.findMany({ where: { userId }, select: { targetId: true } });
  return new Set(rows.map((r) => r.targetId));
}
