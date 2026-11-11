import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { EventFilterBar } from "@/components/filters";
import { EventResults } from "@/components/event-results";
import { Breadcrumbs } from "@/components/category-header";
import { getLocale, getT } from "@/i18n/server";
import { areaBySlug, AREAS } from "@/lib/areas";
import { parseEventParams, type SP } from "@/lib/filters";
import { alternates } from "@/server/urls";

// SEO landing pages: "Kids activities in Beirut", etc.
export async function generateMetadata({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  const a = areaBySlug(area);
  if (!a) return {};
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  return {
    title: t("Kids activities in {area}", { area: a[locale] }),
    description: t("The best things to do with kids in {area}: workshops, shows, camps and family outings, with dates and prices.", { area: a[locale] }),
    alternates: alternates(`/kids-activities/${area}`),
  };
}

export default async function AreaPage({ params, searchParams }: { params: Promise<{ area: string }>; searchParams: Promise<SP> }) {
  const [{ area }, sp] = await Promise.all([params, searchParams]);
  const a = areaBySlug(area);
  if (!a) notFound();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  return (
    <div className="container-x py-6 sm:py-10">
      <Breadcrumbs items={[{ href: "/", label: t("Home") }, { href: "/activities", label: t("Activities") }, { label: a[locale] }]} />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Kids activities in {area}", { area: a[locale] })}</h1>
      <div className="mt-6">
        <Suspense>
          <EventFilterBar />
        </Suspense>
      </div>
      <div className="mt-6">
        <EventResults filters={{ ...parseEventParams(sp), area: a.slug }} sp={sp} basePath={`/kids-activities/${a.slug}`} />
      </div>
      <div className="mt-14">
        <h2 className="mb-3 font-semibold">{t("Other areas")}</h2>
        <div className="flex flex-wrap gap-2">
          {AREAS.filter((x) => x.slug !== a.slug).map((x) => (
            <Link key={x.slug} href={`/kids-activities/${x.slug}`} className="chip">
              {x[locale]}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
