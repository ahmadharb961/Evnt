import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { SearchBox } from "@/components/site/search-box";
import { EventFilterBar } from "@/components/filters";
import { EventResults } from "@/components/event-results";
import { CardGrid } from "@/components/home/section-row";
import { ProductCard } from "@/components/cards";
import { EmptyState } from "@/components/empty";
import { searchEvents, searchProducts, searchRestaurants } from "@/server/listings";
import { favoriteIds } from "@/server/home";
import { getCurrentUser } from "@/server/auth";
import { getLocale, getT } from "@/i18n/server";
import { one, parseEventParams, withParams, type SP } from "@/lib/filters";
import { alternates } from "@/server/urls";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const t = await getT();
  const q = one(sp.q);
  return {
    title: q ? t("“{q}” — search", { q }) : t("Discover things to do with kids"),
    description: t("Search kids' activities, workshops, camps, shows, family restaurants and products across Lebanon."),
    alternates: alternates("/discover"),
    robots: q ? { index: false } : undefined,
  };
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const t = await getT();
  const type = one(sp.type);
  const q = one(sp.q);
  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{q ? t("Results for “{q}”", { q }) : t("Discover")}</h1>
      <div className="mt-4 max-w-2xl md:hidden">
        <SearchBox compact />
      </div>
      <div className="mt-5">
        <Suspense>
          <EventFilterBar showType showView={type === "" || type === "activities"} />
        </Suspense>
      </div>
      <div className="mt-6">
        {type === "activities" ? (
          <EventResults filters={parseEventParams(sp)} sp={sp} basePath="/discover" />
        ) : type === "restaurants" ? (
          <RestaurantGrid sp={sp} />
        ) : type === "shop" ? (
          <ProductGrid sp={sp} />
        ) : one(sp.view) === "map" ? (
          <EventResults filters={parseEventParams(sp)} sp={sp} basePath="/discover" />
        ) : (
          <AllResults sp={sp} />
        )}
      </div>
    </div>
  );
}

async function AllResults({ sp }: { sp: SP }) {
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const f = parseEventParams(sp);
  const q = f.q;
  const [ev, rs, pr, saved] = await Promise.all([
    searchEvents({ ...f, limit: 8 }, locale),
    searchRestaurants({ q, area: f.area, farah: f.farah, limit: 4 }, locale),
    searchProducts({ q, ageMin: f.ageMin, ageMax: f.ageMax, maxPriceCents: f.maxPriceCents, limit: 5 }, locale),
    favoriteIds(user?.id),
  ]);
  // Restaurants and products only make sense for text/area searches, not date filters.
  const showOthers = !f.when;
  if (!ev.items.length && (!showOthers || (!rs.items.length && !pr.items.length)))
    return <EmptyState title={t("Nothing matches yet")} body={t("Try another date, age or area — new activities are added every week.")} cta={{ href: "/discover", label: t("Clear filters") }} />;
  const Head = ({ title, n, type }: { title: string; n: number; type: string }) => (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="h-section">
        {title} <span className="text-base font-medium text-ink-muted">{n}</span>
      </h2>
      <Link href={"/discover" + withParams(sp, { type })} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        {t("See all")}
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
      </Link>
    </div>
  );
  return (
    <div className="space-y-14">
      {ev.items.length > 0 && (
        <section>
          <Head title={t("Activities & events")} n={ev.total} type="activities" />
          <CardGrid items={ev.items} t={t} locale={locale} saved={saved} />
        </section>
      )}
      {showOthers && rs.items.length > 0 && (
        <section>
          <Head title={t("Restaurants & cafés")} n={rs.total} type="restaurants" />
          <CardGrid items={rs.items} t={t} locale={locale} saved={saved} />
        </section>
      )}
      {showOthers && pr.items.length > 0 && (
        <section>
          <Head title={t("Shop")} n={pr.total} type="shop" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {pr.items.map((p) => (
              <ProductCard key={p.id} p={p} t={t} locale={locale} saved={saved.has(p.id)} wide />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function RestaurantGrid({ sp }: { sp: SP }) {
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const f = parseEventParams(sp);
  const [{ items }, saved] = await Promise.all([searchRestaurants({ q: f.q, area: f.area, farah: f.farah, minRating: f.minRating, near: f.near, limit: 60 }, locale), favoriteIds(user?.id)]);
  if (!items.length) return <EmptyState title={t("No restaurants found")} cta={{ href: "/restaurants", label: t("Browse all restaurants") }} />;
  return <CardGrid items={items} t={t} locale={locale} saved={saved} />;
}

async function ProductGrid({ sp }: { sp: SP }) {
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const f = parseEventParams(sp);
  const [{ items }, saved] = await Promise.all([searchProducts({ q: f.q, ageMin: f.ageMin, ageMax: f.ageMax, maxPriceCents: f.maxPriceCents, limit: 60 }, locale), favoriteIds(user?.id)]);
  if (!items.length) return <EmptyState title={t("No products found")} cta={{ href: "/shop", label: t("Browse the shop") }} />;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((p) => (
        <ProductCard key={p.id} p={p} t={t} locale={locale} saved={saved.has(p.id)} wide />
      ))}
    </div>
  );
}
