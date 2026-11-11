import { Heart } from "lucide-react";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { searchEvents, searchProducts, searchRestaurants } from "@/server/listings";
import { getLocale, getT } from "@/i18n/server";
import { SectionRow } from "@/components/home/section-row";
import { EmptyState } from "@/components/empty";

export const metadata = { title: "Favorites", robots: { index: false } };

export default async function FavoritesPage() {
  const user = await requireUser("/favorites");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const favs = await prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const ids = (type: string) => favs.filter((f) => f.targetType === type).map((f) => f.targetId);
  const saved = new Set(favs.map((f) => f.targetId));
  const [ev, rs, pr] = await Promise.all([
    ids("event").length ? searchEvents({ ids: ids("event"), includeSoldOut: true, limit: 100 }, locale) : { items: [] },
    ids("restaurant").length ? searchRestaurants({ ids: ids("restaurant"), limit: 100 }, locale) : { items: [] },
    ids("product").length ? searchProducts({ ids: ids("product"), limit: 100 }, locale) : { items: [] },
  ]);
  return (
    <div className="pb-6">
      <div className="container-x pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight">{t("Favorites")}</h1>
      </div>
      {!ev.items.length && !rs.items.length && !pr.items.length ? (
        <div className="container-x mt-6">
          <EmptyState icon={Heart} title={t("Nothing saved yet")} body={t("Tap the heart on anything you like to find it here later.")} cta={{ href: "/discover", label: t("Start exploring") }} />
        </div>
      ) : (
        <>
          <SectionRow title={t("Activities & events")} items={ev.items} layout="GRID" t={t} locale={locale} saved={saved} />
          <SectionRow title={t("Restaurants & cafés")} items={rs.items} layout="GRID" t={t} locale={locale} saved={saved} />
          <SectionRow title={t("Shop")} items={pr.items} layout="GRID" t={t} locale={locale} saved={saved} />
        </>
      )}
    </div>
  );
}
