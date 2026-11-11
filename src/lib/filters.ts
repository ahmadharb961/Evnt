import { AGE_BANDS } from "./areas";

// URL search params <-> filters. Shared by discover, category, location and listing pages.
export type SP = Record<string, string | string[] | undefined>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseEventParams(sp: SP) {
  const age = AGE_BANDS.find((b) => b.key === one(sp.age));
  const maxPrice = parseFloat(one(sp.maxPrice));
  const rating = parseFloat(one(sp.rating));
  const setting = one(sp.setting).toUpperCase();
  const sort = one(sp.sort);
  return {
    q: one(sp.q) || undefined,
    when: one(sp.when) || undefined,
    ageMin: age?.min,
    ageMax: age?.max,
    area: one(sp.area) || undefined,
    free: one(sp.price) === "free" || undefined,
    maxPriceCents: Number.isFinite(maxPrice) && maxPrice > 0 ? Math.round(maxPrice * 100) : undefined,
    setting: setting === "INDOOR" || setting === "OUTDOOR" ? (setting as "INDOOR" | "OUTDOOR") : undefined,
    minRating: Number.isFinite(rating) ? rating : undefined,
    farah: one(sp.farah) === "1" || undefined,
    accessible: one(sp.accessible) === "1" || undefined,
    includeSoldOut: one(sp.soldout) === "1" || undefined,
    sort: (["soonest", "popular", "newest", "price", "rating", "distance"].includes(sort) ? sort : undefined) as
      | "soonest"
      | "popular"
      | "newest"
      | "price"
      | "rating"
      | "distance"
      | undefined,
    near: parseNear(sp),
    maxKm: parseFloat(one(sp.km)) || undefined,
  };
}

export function parseNear(sp: SP) {
  const m = one(sp.near).match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) return undefined;
  const lat = +m[1];
  const lng = +m[2];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : undefined;
}

export const page = (sp: SP) => Math.max(1, parseInt(one(sp.page) || "1", 10) || 1);

/** Builds a query string from the current params with some keys changed (null removes). */
export function withParams(sp: SP, changes: Record<string, string | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = one(v);
    if (s && k !== "page" && k !== "lang") q.set(k, s);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v == null || v === "") q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
