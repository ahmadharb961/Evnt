import { Suspense } from "react";
import { EventFilterBar } from "@/components/filters";
import { EventResults } from "@/components/event-results";
import { SubcategoryChips } from "@/components/category-header";
import { categoryHref } from "@/components/home/category-tiles";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { parseEventParams, type SP } from "@/lib/filters";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const t = await getT();
  return {
    title: t("Kids activities in Lebanon"),
    description: t("Workshops, camps, shows and family experiences for kids aged 0–12 across Lebanon. Book online in minutes."),
    alternates: alternates("/activities"),
  };
}

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const cats = await prisma.category.findMany({ where: { parentId: null, kind: "EVENT", active: true }, orderBy: { sort: "asc" } });
  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Activities")}</h1>
      <p className="mt-2 text-ink-muted">{t("Workshops, camps, shows and family experiences — book in a few taps.")}</p>
      <SubcategoryChips items={cats.map((c) => ({ slug: c.slug, name: loc(c.name, locale), href: categoryHref(c.slug) }))} />
      <div className="mt-6">
        <Suspense>
          <EventFilterBar />
        </Suspense>
      </div>
      <div className="mt-6">
        <EventResults filters={parseEventParams(sp)} sp={sp} basePath="/activities" />
      </div>
    </div>
  );
}
