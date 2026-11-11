import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { mediaSrc } from "./media";
import { loc, type Locale } from "@/i18n/core";
import { areaName, AREAS, distanceKm } from "@/lib/areas";
import { windowFor } from "@/lib/dates";
import type { Availability, EventCardData, ProductCardData, RestaurantCardData } from "@/lib/types";

// ───────────────────────── Events ─────────────────────────

export type EventFilters = {
  q?: string;
  categorySlug?: string;
  area?: string;
  ageMin?: number;
  ageMax?: number;
  when?: string;
  free?: boolean;
  maxPriceCents?: number;
  setting?: "INDOOR" | "OUTDOOR";
  minRating?: number;
  farah?: boolean;
  accessible?: boolean;
  includeSoldOut?: boolean;
  sort?: "recommended" | "soonest" | "popular" | "newest" | "price" | "rating" | "distance";
  near?: { lat: number; lng: number };
  maxKm?: number;
  ids?: string[];
  merchantId?: string;
  excludeId?: string;
  limit?: number;
  offset?: number;
};

const tokens = (q: string) =>
  q
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .slice(0, 6);

/** Age words in a search ("toddler", "3 years", "baby") become an age filter. */
export function ageFromQuery(q: string): { ageMin: number; ageMax: number; rest: string } | null {
  const s = q.toLowerCase();
  const year = s.match(/\b(\d{1,2})\s*(y|yr|yrs|years?|ans?|سنوات|سنة)\b/);
  if (year) {
    const n = +year[1];
    if (n <= 16) return { ageMin: n, ageMax: n, rest: s.replace(year[0], "").trim() };
  }
  const words: [RegExp, number, number][] = [
    [/\b(baby|babies|bébé|bebe|رضيع)\b/, 0, 1],
    [/\b(toddlers?|tout-petits?)\b/, 1, 3],
    [/\b(preschool|maternelle)\b/, 3, 5],
    [/\b(teens?|tweens?|ados?)\b/, 10, 12],
  ];
  for (const [re, a, b] of words) if (re.test(s)) return { ageMin: a, ageMax: b, rest: s.replace(re, "").trim() };
  return null;
}

function areaFromQuery(q: string): { area: string; rest: string } | null {
  const s = q.toLowerCase();
  for (const a of AREAS) {
    for (const name of [a.en, a.fr, a.ar, a.slug]) {
      const n = name.toLowerCase();
      if (n.length >= 3 && s.includes(n)) return { area: a.slug, rest: s.replace(n, "").trim() };
    }
  }
  return null;
}

async function categoryIdsFor(slug?: string): Promise<string[] | null> {
  if (!slug) return null;
  const c = await prisma.category.findUnique({ where: { slug }, include: { children: { select: { id: true } } } });
  if (!c) return [];
  return [c.id, ...c.children.map((x) => x.id)];
}

const eventInclude = {
  merchant: { select: { name: true, farahUntil: true } },
  location: { select: { area: true, lat: true, lng: true } },
  category: { select: { name: true } },
  sessions: {
    where: { status: "SCHEDULED" as const, startsAt: { gt: new Date(0) } },
    orderBy: { startsAt: "asc" as const },
    select: { id: true, startsAt: true, capacity: true, reserved: true },
    take: 40,
  },
  seatingMap: { select: { _count: { select: { seats: { where: { blocked: false } } } } } },
} satisfies Prisma.EventInclude;

type EventRow = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

/** Seats taken per session (confirmed, organizer-reserved, or held and not expired). */
async function seatsTaken(sessionIds: string[]) {
  if (!sessionIds.length) return new Map<string, number>();
  const rows = await prisma.seatClaim.groupBy({
    by: ["sessionId"],
    where: { sessionId: { in: sessionIds }, OR: [{ status: { in: ["CONFIRMED", "RESERVED"] } }, { status: "HELD", expiresAt: { gt: new Date() } }] },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.sessionId, r._count._all]));
}

function availabilityOf(remaining: number[], capacity: number[]): Availability {
  if (!remaining.length) return "none";
  const total = remaining.reduce((a, b) => a + b, 0);
  if (total <= 0) return "soldout";
  const cap = capacity.reduce((a, b) => a + b, 0) || 1;
  return total / cap < 0.15 || total <= 5 ? "limited" : "available";
}

async function toEventCards(rows: EventRow[], locale: Locale, window: { from: Date; to: Date } | null) {
  const now = new Date();
  const from = window?.from ?? now;
  const to = window?.to ?? new Date(now.getTime() + 400 * 86400_000);
  const assignedSessionIds = rows.filter((r) => r.seatingMode === "ASSIGNED").flatMap((r) => r.sessions.map((s) => s.id));
  const taken = await seatsTaken(assignedSessionIds);
  return rows.map((e): EventCardData => {
    const upcoming = e.sessions.filter((s) => s.startsAt >= from && s.startsAt < to);
    const seatCount = e.seatingMap?._count.seats ?? 0;
    const remaining = upcoming.map((s) => (e.seatingMode === "ASSIGNED" ? seatCount - (taken.get(s.id) ?? 0) : s.capacity - s.reserved));
    const caps = upcoming.map((s) => (e.seatingMode === "ASSIGNED" ? seatCount : s.capacity));
    const nextOpen = upcoming.find((_, i) => remaining[i] > 0) ?? upcoming[0];
    const area = e.location?.area ?? null;
    return {
      kind: "event",
      id: e.id,
      slug: e.slug,
      title: loc(e.title, locale),
      image: mediaSrc(e.coverId, e.coverUrl),
      merchantName: e.merchant.name,
      area,
      areaName: areaName(area, locale),
      ageMin: e.ageMin,
      ageMax: e.ageMax,
      isFree: e.isFree,
      fromPriceCents: e.fromPriceCents,
      rating: e.ratingAvg,
      ratingCount: e.ratingCount,
      nextStartsAt: nextOpen ? nextOpen.startsAt.toISOString() : null,
      sessionsCount: upcoming.length,
      availability: availabilityOf(remaining, caps),
      farah: !!e.merchant.farahUntil && e.merchant.farahUntil > now,
      isNew: !!e.publishedAt && now.getTime() - e.publishedAt.getTime() < 14 * 86400_000,
      lat: e.location?.lat ?? null,
      lng: e.location?.lng ?? null,
      categoryName: loc(e.category.name, locale),
    };
  });
}

export async function searchEvents(f: EventFilters, locale: Locale): Promise<{ items: EventCardData[]; total: number }> {
  let q = (f.q ?? "").trim();
  let { ageMin, ageMax, area } = f;
  if (q) {
    const age = ageFromQuery(q);
    if (age && ageMin == null && ageMax == null) ({ ageMin, ageMax, rest: q } = { ...age });
    const ar = areaFromQuery(q);
    if (ar && !area) ({ area, rest: q } = { ...ar });
  }
  const now = new Date();
  const window = windowFor(f.when, now);
  const catIds = await categoryIdsFor(f.categorySlug);

  const where: Prisma.EventWhereInput = {
    status: "PUBLISHED",
    merchant: { status: "APPROVED" },
    sessions: { some: { status: "SCHEDULED", startsAt: { gte: window?.from ?? now, ...(window ? { lt: window.to } : {}) } } },
    ...(catIds ? { categoryId: { in: catIds } } : {}),
    ...(area ? { location: { area } } : {}),
    ...(ageMax != null ? { ageMin: { lte: ageMax } } : {}),
    ...(ageMin != null ? { ageMax: { gte: ageMin } } : {}),
    ...(f.free ? { isFree: true } : {}),
    ...(f.maxPriceCents != null && !f.free ? { OR: [{ isFree: true }, { fromPriceCents: { lte: f.maxPriceCents } }] } : {}),
    ...(f.setting ? { setting: { in: [f.setting, "BOTH"] } } : {}),
    ...(f.minRating ? { ratingAvg: { gte: f.minRating } } : {}),
    ...(f.farah ? { merchant: { status: "APPROVED", farahUntil: { gt: now } } } : {}),
    ...(f.accessible ? { accessible: true } : {}),
    ...(f.ids ? { id: { in: f.ids } } : {}),
    ...(f.merchantId ? { merchantId: f.merchantId } : {}),
    ...(f.excludeId ? { id: { not: f.excludeId } } : {}),
    ...(tokens(q).length ? { AND: tokens(q).map((t) => ({ searchText: { contains: t, mode: "insensitive" as const } })) } : {}),
  };

  const rows = await prisma.event.findMany({ where, include: eventInclude, take: 300 });
  let items = await toEventCards(rows, locale, window);
  if (!f.includeSoldOut) items = items.filter((i) => i.availability !== "none");
  if (f.near) {
    items = items.filter((i) => i.lat == null || !f.maxKm || distanceKm(f.near!, { lat: i.lat, lng: i.lng! }) <= f.maxKm);
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  const soon = (i: EventCardData) => (i.nextStartsAt ? Date.parse(i.nextStartsAt) : Infinity);
  const sort = f.sort ?? (f.near ? "distance" : "recommended");
  const score = (i: EventCardData) => {
    const r = byId.get(i.id)!;
    const days = (soon(i) - now.getTime()) / 86400_000;
    return r.popularity * 2 + i.rating * Math.min(i.ratingCount, 20) + (i.isNew ? 15 : 0) - Math.min(days, 60) * 0.8 + (i.availability === "soldout" ? -100 : 0);
  };
  if (f.ids && sort === "recommended") items.sort((a, b) => f.ids!.indexOf(a.id) - f.ids!.indexOf(b.id));
  else
    items.sort((a, b) => {
      // Sold-out listings always go last: never present unavailable inventory first.
      if ((a.availability === "soldout") !== (b.availability === "soldout")) return a.availability === "soldout" ? 1 : -1;
      switch (sort) {
        case "soonest":
          return soon(a) - soon(b);
        case "popular":
          return byId.get(b.id)!.popularity - byId.get(a.id)!.popularity;
        case "newest":
          return (byId.get(b.id)!.publishedAt?.getTime() ?? 0) - (byId.get(a.id)!.publishedAt?.getTime() ?? 0);
        case "price":
          return (a.isFree ? 0 : a.fromPriceCents) - (b.isFree ? 0 : b.fromPriceCents);
        case "rating":
          return b.rating - a.rating || b.ratingCount - a.ratingCount;
        case "distance":
          if (!f.near) return 0;
          return (a.lat == null ? 1e9 : distanceKm(f.near, { lat: a.lat, lng: a.lng! })) - (b.lat == null ? 1e9 : distanceKm(f.near, { lat: b.lat, lng: b.lng! }));
        default:
          return score(b) - score(a);
      }
    });
  const total = items.length;
  const offset = f.offset ?? 0;
  return { items: items.slice(offset, offset + (f.limit ?? 24)), total };
}

// ───────────────────────── Restaurants ─────────────────────────

export const RESTAURANT_FACILITIES = [
  "kidsMenu",
  "highChairs",
  "playArea",
  "outdoorSeating",
  "strollerAccess",
  "changingFacilities",
  "parking",
  "birthdaySuitable",
] as const;
export type Facility = (typeof RESTAURANT_FACILITIES)[number];

export type RestaurantFilters = {
  q?: string;
  area?: string;
  cuisine?: string;
  facilities?: Facility[];
  priceLevel?: number;
  minRating?: number;
  farah?: boolean;
  reservable?: boolean;
  sort?: "recommended" | "rating" | "distance" | "newest";
  near?: { lat: number; lng: number };
  ids?: string[];
  excludeId?: string;
  limit?: number;
  offset?: number;
};

export async function searchRestaurants(f: RestaurantFilters, locale: Locale): Promise<{ items: RestaurantCardData[]; total: number }> {
  let q = (f.q ?? "").trim();
  let area = f.area;
  if (q) {
    const ar = areaFromQuery(q);
    if (ar && !area) ({ area, rest: q } = { ...ar });
  }
  const now = new Date();
  const where: Prisma.RestaurantWhereInput = {
    status: "PUBLISHED",
    merchant: { status: "APPROVED", ...(f.farah ? { farahUntil: { gt: now } } : {}) },
    ...(area ? { location: { area } } : {}),
    ...(f.cuisine ? { cuisines: { has: f.cuisine } } : {}),
    ...(f.priceLevel ? { priceLevel: { lte: f.priceLevel } } : {}),
    ...(f.minRating ? { ratingAvg: { gte: f.minRating } } : {}),
    ...(f.reservable ? { acceptsReservations: true } : {}),
    ...(f.ids ? { id: { in: f.ids } } : {}),
    ...(f.excludeId ? { id: { not: f.excludeId } } : {}),
    ...Object.fromEntries((f.facilities ?? []).map((k) => [k, true])),
    ...(tokens(q).length ? { AND: tokens(q).map((t) => ({ searchText: { contains: t, mode: "insensitive" as const } })) } : {}),
  };
  const rows = await prisma.restaurant.findMany({
    where,
    include: { merchant: { select: { farahUntil: true } }, location: { select: { area: true, lat: true, lng: true } } },
    take: 300,
  });
  let items = rows.map(
    (r): RestaurantCardData => ({
      kind: "restaurant",
      id: r.id,
      slug: r.slug,
      name: r.name,
      image: mediaSrc(r.coverId, r.coverUrl),
      areaName: areaName(r.location?.area, locale),
      cuisines: r.cuisines,
      priceLevel: r.priceLevel,
      rating: r.ratingAvg,
      ratingCount: r.ratingCount,
      facilities: RESTAURANT_FACILITIES.filter((k) => r[k]),
      farah: !!r.merchant.farahUntil && r.merchant.farahUntil > now,
      acceptsReservations: r.acceptsReservations,
      lat: r.location?.lat ?? null,
      lng: r.location?.lng ?? null,
    }),
  );
  const pop = new Map(rows.map((r) => [r.id, r]));
  const sort = f.sort ?? (f.near ? "distance" : "recommended");
  if (f.ids && sort === "recommended") items.sort((a, b) => f.ids!.indexOf(a.id) - f.ids!.indexOf(b.id));
  else
    items = items.sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating || b.ratingCount - a.ratingCount;
      if (sort === "newest") return pop.get(b.id)!.createdAt.getTime() - pop.get(a.id)!.createdAt.getTime();
      if (sort === "distance" && f.near)
        return (a.lat == null ? 1e9 : distanceKm(f.near, { lat: a.lat, lng: a.lng! })) - (b.lat == null ? 1e9 : distanceKm(f.near, { lat: b.lat, lng: b.lng! }));
      const s = (x: RestaurantCardData) => pop.get(x.id)!.popularity * 2 + x.rating * Math.min(x.ratingCount, 20) + x.facilities.length * 2;
      return s(b) - s(a);
    });
  const offset = f.offset ?? 0;
  return { items: items.slice(offset, offset + (f.limit ?? 24)), total: items.length };
}

// ───────────────────────── Products ─────────────────────────

export type ProductFilters = {
  q?: string;
  categorySlug?: string;
  ageMin?: number;
  ageMax?: number;
  maxPriceCents?: number;
  onSale?: boolean;
  inStock?: boolean;
  sort?: "recommended" | "price" | "price-desc" | "newest" | "rating";
  ids?: string[];
  merchantId?: string;
  excludeId?: string;
  limit?: number;
  offset?: number;
};

export async function searchProducts(f: ProductFilters, locale: Locale): Promise<{ items: ProductCardData[]; total: number }> {
  const q = (f.q ?? "").trim();
  const catIds = await categoryIdsFor(f.categorySlug);
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    merchant: { status: "APPROVED" },
    ...(catIds ? { categoryId: { in: catIds } } : {}),
    ...(f.ageMax != null ? { OR: [{ ageMin: null }, { ageMin: { lte: f.ageMax } }] } : {}),
    ...(f.ageMin != null ? { AND: [{ OR: [{ ageMax: null }, { ageMax: { gte: f.ageMin } }] }] } : {}),
    ...(f.onSale ? { salePriceCents: { not: null } } : {}),
    ...(f.ids ? { id: { in: f.ids } } : {}),
    ...(f.merchantId ? { merchantId: f.merchantId } : {}),
    ...(f.excludeId ? { id: { not: f.excludeId } } : {}),
    ...(tokens(q).length ? { searchText: { contains: tokens(q).join(" "), mode: "insensitive" as const } } : {}),
  };
  if (tokens(q).length > 1) {
    delete where.searchText;
    where.AND = [...((where.AND as Prisma.ProductWhereInput[]) ?? []), ...tokens(q).map((t) => ({ searchText: { contains: t, mode: "insensitive" as const } }))];
  }
  const rows = await prisma.product.findMany({
    where,
    include: { merchant: { select: { name: true } }, variants: { where: { active: true }, select: { stock: true, priceCents: true } } },
    take: 300,
  });
  let items = rows.map((p): ProductCardData => {
    return {
      kind: "product",
      id: p.id,
      slug: p.slug,
      title: loc(p.title, locale),
      image: p.images[0] ? (p.images[0].startsWith("/") || p.images[0].startsWith("http") ? p.images[0] : mediaSrc(p.images[0])) : mediaSrc(),
      merchantName: p.merchant.name,
      priceCents: p.priceCents,
      salePriceCents: p.salePriceCents != null && p.salePriceCents < p.priceCents ? p.salePriceCents : null,
      rating: p.ratingAvg,
      ratingCount: p.ratingCount,
      inStock: p.variants.some((v) => v.stock > 0),
    };
  });
  if (f.inStock) items = items.filter((i) => i.inStock);
  if (f.maxPriceCents != null) items = items.filter((i) => (i.salePriceCents ?? i.priceCents) <= f.maxPriceCents!);
  const pop = new Map(rows.map((r) => [r.id, r]));
  const eff = (i: ProductCardData) => i.salePriceCents ?? i.priceCents;
  const sort = f.sort ?? "recommended";
  if (f.ids && sort === "recommended") items.sort((a, b) => f.ids!.indexOf(a.id) - f.ids!.indexOf(b.id));
  else
    items.sort((a, b) => {
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      if (sort === "price") return eff(a) - eff(b);
      if (sort === "price-desc") return eff(b) - eff(a);
      if (sort === "newest") return pop.get(b.id)!.createdAt.getTime() - pop.get(a.id)!.createdAt.getTime();
      if (sort === "rating") return b.rating - a.rating;
      return pop.get(b.id)!.popularity - pop.get(a.id)!.popularity + (b.rating - a.rating);
    });
  const offset = f.offset ?? 0;
  return { items: items.slice(offset, offset + (f.limit ?? 24)), total: items.length };
}

// ───────────────────────── Search text ─────────────────────────

/** Rebuilds the search text of an event (all languages, merchant, category, area). */
export async function reindexEvent(id: string) {
  const e = await prisma.event.findUnique({ where: { id }, include: { merchant: true, category: { include: { parent: true } }, location: true } });
  if (!e) return;
  const parts = [
    ...Object.values((e.title as object) ?? {}),
    ...Object.values((e.summary as object) ?? {}),
    e.merchant.name,
    ...Object.values((e.category.name as object) ?? {}),
    ...Object.values((e.category.parent?.name as object) ?? {}),
    e.location?.area ?? "",
    ...(e.location?.area ? [areaName(e.location.area, "en"), areaName(e.location.area, "ar"), areaName(e.location.area, "fr")] : []),
    e.isFree ? "free gratuit مجاني" : "",
    e.setting === "OUTDOOR" ? "outdoor plein air" : e.setting === "INDOOR" ? "indoor intérieur" : "",
  ];
  await prisma.event.update({ where: { id }, data: { searchText: parts.join(" ").toLowerCase().slice(0, 4000) } });
}

export async function reindexRestaurant(id: string) {
  const r = await prisma.restaurant.findUnique({ where: { id }, include: { merchant: true, location: true } });
  if (!r) return;
  const parts = [
    r.name,
    r.merchant.name,
    ...Object.values((r.about as object) ?? {}),
    ...r.cuisines,
    "restaurant cafe café مطعم",
    ...(r.location?.area ? [r.location.area, areaName(r.location.area, "en"), areaName(r.location.area, "ar"), areaName(r.location.area, "fr")] : []),
    r.playArea ? "play area aire de jeux ملعب" : "",
    r.kidsMenu ? "kids menu menu enfant" : "",
  ];
  await prisma.restaurant.update({ where: { id }, data: { searchText: parts.join(" ").toLowerCase().slice(0, 4000) } });
}

export async function reindexProduct(id: string) {
  const p = await prisma.product.findUnique({ where: { id }, include: { merchant: true, category: { include: { parent: true } } } });
  if (!p) return;
  const parts = [
    ...Object.values((p.title as object) ?? {}),
    ...Object.values((p.description as object) ?? {}),
    p.merchant.name,
    ...Object.values((p.category.name as object) ?? {}),
    ...Object.values((p.category.parent?.name as object) ?? {}),
  ];
  await prisma.product.update({ where: { id }, data: { searchText: parts.join(" ").toLowerCase().slice(0, 4000) } });
}
