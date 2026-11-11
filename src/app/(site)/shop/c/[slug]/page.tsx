import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { ShopGrid, parseShopParams } from "@/components/shop-grid";
import { Breadcrumbs } from "@/components/category-header";
import { alternates } from "@/server/urls";
import type { SP } from "@/lib/filters";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [c, locale] = await Promise.all([prisma.category.findUnique({ where: { slug } }), getLocale()]);
  return c ? { title: loc(c.name, locale), alternates: alternates(`/shop/c/${slug}`) } : {};
}

export default async function ShopCategory({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const c = await prisma.category.findUnique({ where: { slug } });
  if (!c || c.kind !== "PRODUCT" || !c.active) notFound();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  return (
    <div className="container-x py-6 sm:py-10">
      <Breadcrumbs items={[{ href: "/", label: t("Home") }, { href: "/shop", label: t("Shop") }, { label: loc(c.name, locale) }]} />
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{loc(c.name, locale)}</h1>
      <ShopGrid filters={{ ...parseShopParams(sp), categorySlug: slug }} sp={sp} basePath={`/shop/c/${slug}`} />
    </div>
  );
}
