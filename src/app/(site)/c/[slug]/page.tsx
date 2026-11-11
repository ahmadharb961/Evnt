import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { EventFilterBar } from "@/components/filters";
import { EventResults } from "@/components/event-results";
import { Breadcrumbs, SubcategoryChips } from "@/components/category-header";
import { CategorySponsor } from "@/components/category-sponsor";
import { categoryHref } from "@/components/home/category-tiles";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { parseEventParams, type SP } from "@/lib/filters";
import { alternates } from "@/server/urls";

async function load(slug: string) {
  return prisma.category.findUnique({ where: { slug }, include: { parent: { include: { children: { where: { active: true }, orderBy: { sort: "asc" } } } }, children: { where: { active: true }, orderBy: { sort: "asc" } } } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [c, locale, t] = await Promise.all([load(slug), getLocale(), getT()]);
  if (!c) return {};
  const name = loc(c.name, locale);
  return {
    title: t("{name} for kids in Lebanon", { name }),
    description: t("Find and book {name} for kids across Lebanon: dates, ages, prices and parent reviews.", { name: name.toLowerCase() }),
    alternates: alternates(`/c/${slug}`),
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const c = await load(slug);
  if (!c || !c.active) notFound();
  if (c.kind !== "EVENT" && !c.parentId) redirect(categoryHref(c.slug));
  if (c.kind === "PRODUCT") redirect(`/shop/c/${c.slug}`);
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const top = c.parent ?? c;
  const subs = (c.parent ? c.parent.children : c.children).map((s) => ({ slug: s.slug, name: loc(s.name, locale), href: `/c/${s.slug}` }));
  const blurb = loc(c.blurb, locale);
  return (
    <div className="container-x py-6 sm:py-10">
      <Breadcrumbs
        items={[
          { href: "/", label: t("Home") },
          { href: "/activities", label: t("Activities") },
          ...(c.parent ? [{ href: categoryHref(c.parent.slug), label: loc(c.parent.name, locale) }] : []),
          { label: loc(c.name, locale) },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{loc(c.name, locale)}</h1>
      {blurb && <p className="mt-2 max-w-2xl text-ink-muted">{blurb}</p>}
      <SubcategoryChips items={[{ slug: top.slug, name: t("All"), href: categoryHref(top.slug) }, ...subs]} active={c.slug} />
      <CategorySponsor categoryId={top.id} t={t} />
      <div className="mt-6">
        <Suspense>
          <EventFilterBar />
        </Suspense>
      </div>
      <div className="mt-6">
        <EventResults filters={{ ...parseEventParams(sp), categorySlug: c.slug }} sp={sp} basePath={`/c/${c.slug}`} />
      </div>
    </div>
  );
}
