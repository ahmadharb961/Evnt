import type { MetadataRoute } from "next";
import { prisma } from "@/server/db";
import { localizedUrl } from "@/server/urls";
import { AREAS } from "@/lib/areas";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

// Every public page, with hreflang alternates for English, Arabic and French.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entry = (path: string, lastModified?: Date, priority = 0.6): MetadataRoute.Sitemap[number] => ({
    url: localizedUrl(path, "en"),
    lastModified,
    priority,
    alternates: { languages: { en: localizedUrl(path, "en"), ar: localizedUrl(path, "ar"), fr: localizedUrl(path, "fr") } },
  });
  const [events, restaurants, products, merchants, cats, articles] = await Promise.all([
    prisma.event.findMany({ where: { status: "PUBLISHED", merchant: { status: "APPROVED" } }, select: { slug: true, updatedAt: true } }),
    prisma.restaurant.findMany({ where: { status: "PUBLISHED", merchant: { status: "APPROVED" } }, select: { slug: true, updatedAt: true } }),
    prisma.product.findMany({ where: { status: "PUBLISHED", merchant: { status: "APPROVED" } }, select: { slug: true, updatedAt: true } }),
    prisma.merchant.findMany({ where: { status: "APPROVED" }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { active: true }, select: { slug: true, kind: true, parentId: true } }),
    prisma.article.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
  ]).catch(() => [[], [], [], [], [], []] as never);
  const statics = ["/", "/discover", "/activities", "/birthdays", "/restaurants", "/shop", "/plus", "/farah-approved", "/guides", "/business", "/business/pricing", "/contact", "/terms", "/privacy", "/refunds", "/reviews-policy"];
  return [
    ...statics.map((p) => entry(p, undefined, p === "/" ? 1 : 0.7)),
    ...cats.filter((c) => c.kind === "EVENT").map((c) => entry(`/c/${c.slug}`, undefined, 0.7)),
    ...cats.filter((c) => c.kind === "PRODUCT" && c.parentId).map((c) => entry(`/shop/c/${c.slug}`, undefined, 0.5)),
    ...AREAS.map((a) => entry(`/kids-activities/${a.slug}`, undefined, 0.6)),
    ...events.map((e) => entry(`/events/${e.slug}`, e.updatedAt, 0.8)),
    ...restaurants.map((r) => entry(`/restaurants/${r.slug}`, r.updatedAt, 0.7)),
    ...products.map((p) => entry(`/shop/p/${p.slug}`, p.updatedAt, 0.5)),
    ...merchants.map((m) => entry(`/m/${m.slug}`, m.updatedAt, 0.5)),
    ...articles.map((a) => entry(`/guides/${a.slug}`, a.updatedAt, 0.6)),
  ];
}
