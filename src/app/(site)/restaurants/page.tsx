import Link from "next/link";
import { getLocale, getT } from "@/i18n/server";
import { searchRestaurants, RESTAURANT_FACILITIES, type Facility } from "@/server/listings";
import { favoriteIds } from "@/server/home";
import { getCurrentUser } from "@/server/auth";
import { CardGrid } from "@/components/home/section-row";
import { EmptyState } from "@/components/empty";
import { ResultsMap } from "@/components/results-map";
import { facilityLabel } from "@/components/cards";
import { CategorySponsor } from "@/components/category-sponsor";
import { prisma } from "@/server/db";
import { AREAS } from "@/lib/areas";
import { one, parseNear, withParams, type SP } from "@/lib/filters";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Kids-friendly restaurants in Lebanon"), description: t("Family restaurants and cafés with kids' menus, high chairs and play areas. Reserve a table online."), alternates: alternates("/restaurants") };
}

export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const facilities = one(sp.f).split(",").filter((f): f is Facility => (RESTAURANT_FACILITIES as readonly string[]).includes(f));
  const [{ items, total }, saved, cat] = await Promise.all([
    searchRestaurants({ q: one(sp.q) || undefined, area: one(sp.area) || undefined, facilities, farah: one(sp.farah) === "1" || undefined, reservable: one(sp.reserve) === "1" || undefined, near: parseNear(sp), limit: 60 }, locale),
    favoriteIds(user?.id),
    prisma.category.findUnique({ where: { slug: "restaurants-cafes" } }),
  ]);
  const toggleF = (f: string) => {
    const next = facilities.includes(f as Facility) ? facilities.filter((x) => x !== f) : [...facilities, f];
    return "/restaurants" + withParams(sp, { f: next.join(",") || null });
  };
  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Restaurants & cafés")}</h1>
      <p className="mt-2 text-ink-muted">{t("Places where kids are truly welcome — filter by what your family needs.")}</p>
      {cat && <CategorySponsor categoryId={cat.id} t={t} />}
      <form className="mt-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={one(sp.q)} placeholder={t("Search restaurants or cuisine")} className="input !h-10 !w-64 !rounded-full !py-0 text-sm" />
        <select name="area" defaultValue={one(sp.area)} className="input !h-10 !w-48 !rounded-full !py-0 text-sm">
          <option value="">{t("All of Lebanon")}</option>
          {AREAS.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a[locale]}
            </option>
          ))}
        </select>
        {one(sp.f) && <input type="hidden" name="f" value={one(sp.f)} />}
        <button className="btn-primary !min-h-10">{t("Search")}</button>
      </form>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {RESTAURANT_FACILITIES.map((f) => (
          <Link key={f} href={toggleF(f)} className={`chip shrink-0 ${facilities.includes(f) ? "chip-on" : ""}`} scroll={false}>
            {facilityLabel(t, f)}
          </Link>
        ))}
        <Link href={"/restaurants" + withParams(sp, { reserve: one(sp.reserve) === "1" ? null : "1" })} className={`chip shrink-0 ${one(sp.reserve) === "1" ? "chip-on" : ""}`} scroll={false}>
          {t("Reserve online")}
        </Link>
        <Link href={"/restaurants" + withParams(sp, { farah: one(sp.farah) === "1" ? null : "1" })} className={`chip shrink-0 ${one(sp.farah) === "1" ? "chip-on" : ""}`} scroll={false}>
          {t("Farah Approved")}
        </Link>
        <Link href={"/restaurants" + withParams(sp, { view: one(sp.view) === "map" ? null : "map" })} className="chip shrink-0">
          {one(sp.view) === "map" ? t("List view") : t("Map view")}
        </Link>
      </div>
      <div className="mt-6">
        <p className="mb-5 text-sm text-ink-muted">{t(total === 1 ? "{n} result" : "{n} results", { n: total })}</p>
        {!items.length ? (
          <EmptyState title={t("No restaurants found")} cta={{ href: "/restaurants", label: t("Clear filters") }} />
        ) : one(sp.view) === "map" ? (
          <ResultsMap points={items.filter((i) => i.lat != null).map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, title: i.name, subtitle: i.areaName, href: `/restaurants/${i.slug}`, image: i.image }))} />
        ) : (
          <CardGrid items={items} t={t} locale={locale} saved={saved} />
        )}
      </div>
    </div>
  );
}
