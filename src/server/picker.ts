import "server-only";
import { prisma } from "./db";
import { mediaSrc } from "./media";
import { loc, type Locale } from "@/i18n/core";
import type { PickKind, PickItem } from "@/lib/picker";

const img = (s?: string | null) => (s ? (s.startsWith("/") || s.startsWith("http") ? s : mediaSrc(s)) : mediaSrc());

/** Admin search across businesses and listings, for ordering and hand-picked sections. */
export async function searchPickable(kinds: PickKind[], q: string, locale: Locale, take = 12): Promise<PickItem[]> {
  const text = q.trim();
  const out: PickItem[] = [];
  const contains = { contains: text, mode: "insensitive" as const };
  await Promise.all(
    kinds.map(async (k) => {
      if (k === "merchant") {
        const rows = await prisma.merchant.findMany({
          where: { status: "APPROVED", ...(text ? { name: contains } : {}) },
          orderBy: [{ rank: { sort: "asc", nulls: "last" } }, { name: "asc" }],
          take,
        });
        out.push(...rows.map((m) => ({ id: m.id, kind: k, label: m.name, sub: m.type.replace(/_/g, " ").toLowerCase(), image: img(m.logoId) })));
      } else if (k === "event") {
        const rows = await prisma.event.findMany({
          where: { status: "PUBLISHED", ...(text ? { searchText: { contains: text.toLowerCase() } } : {}) },
          include: { merchant: { select: { name: true } } },
          orderBy: [{ rank: { sort: "asc", nulls: "last" } }, { popularity: "desc" }],
          take,
        });
        out.push(...rows.map((e) => ({ id: e.id, kind: k, label: loc(e.title, locale), sub: e.merchant.name, image: img(e.coverId ?? e.coverUrl) })));
      } else if (k === "restaurant") {
        const rows = await prisma.restaurant.findMany({
          where: { status: "PUBLISHED", ...(text ? { searchText: { contains: text.toLowerCase() } } : {}) },
          orderBy: [{ rank: { sort: "asc", nulls: "last" } }, { popularity: "desc" }],
          take,
        });
        out.push(...rows.map((r) => ({ id: r.id, kind: k, label: r.name, sub: r.cuisines.join(" · "), image: img(r.coverId ?? r.coverUrl) })));
      } else {
        const rows = await prisma.product.findMany({
          where: { status: "PUBLISHED", ...(text ? { searchText: { contains: text.toLowerCase() } } : {}) },
          include: { merchant: { select: { name: true } } },
          orderBy: [{ rank: { sort: "asc", nulls: "last" } }, { popularity: "desc" }],
          take,
        });
        out.push(...rows.map((p) => ({ id: p.id, kind: k, label: loc(p.title, locale), sub: p.merchant.name, image: img(p.images[0]) })));
      }
    }),
  );
  return out;
}

/** Resolves ids (of any kind) back to picker items, keeping the given order and dropping unknown ids. */
export async function resolvePickable(ids: string[], locale: Locale): Promise<PickItem[]> {
  if (!ids.length) return [];
  const [m, e, r, p] = await Promise.all([
    prisma.merchant.findMany({ where: { id: { in: ids } } }),
    prisma.event.findMany({ where: { id: { in: ids } }, include: { merchant: { select: { name: true } } } }),
    prisma.restaurant.findMany({ where: { id: { in: ids } } }),
    prisma.product.findMany({ where: { id: { in: ids } }, include: { merchant: { select: { name: true } } } }),
  ]);
  const map = new Map<string, PickItem>();
  for (const x of m) map.set(x.id, { id: x.id, kind: "merchant", label: x.name, sub: x.type.replace(/_/g, " ").toLowerCase(), image: img(x.logoId) });
  for (const x of e) map.set(x.id, { id: x.id, kind: "event", label: loc(x.title, locale), sub: x.merchant.name + (x.status !== "PUBLISHED" ? " · " + x.status : ""), image: img(x.coverId ?? x.coverUrl) });
  for (const x of r) map.set(x.id, { id: x.id, kind: "restaurant", label: x.name, sub: x.cuisines.join(" · "), image: img(x.coverId ?? x.coverUrl) });
  for (const x of p) map.set(x.id, { id: x.id, kind: "product", label: loc(x.title, locale), sub: x.merchant.name, image: img(x.images[0]) });
  return ids.map((id) => map.get(id)).filter((x): x is PickItem => !!x);
}

/** Current admin order for one kind (pinned items, lowest rank first). */
export async function rankedItems(kind: PickKind, locale: Locale): Promise<PickItem[]> {
  const where = { rank: { not: null } };
  const orderBy = { rank: "asc" as const };
  const ids =
    kind === "merchant"
      ? (await prisma.merchant.findMany({ where, orderBy, select: { id: true } })).map((x) => x.id)
      : kind === "event"
        ? (await prisma.event.findMany({ where, orderBy, select: { id: true } })).map((x) => x.id)
        : kind === "restaurant"
          ? (await prisma.restaurant.findMany({ where, orderBy, select: { id: true } })).map((x) => x.id)
          : (await prisma.product.findMany({ where, orderBy, select: { id: true } })).map((x) => x.id);
  return resolvePickable(ids, locale);
}
