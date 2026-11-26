import Link from "next/link";
import { getLocale, getT } from "@/i18n/server";
import { ShopGrid, parseShopParams } from "@/components/shop-grid";
import { StoreCard } from "@/components/cards";
import { listStores, shopCategories } from "@/server/listings";
import { ShopCategories } from "@/components/shop-categories";
import { CategorySponsor } from "@/components/category-sponsor";
import { alternates } from "@/server/urls";
import type { SP } from "@/lib/filters";


export async function generateMetadata() {
  const t = await getT();
  return { title: t("Shop for kids"), description: t("Toys, baby essentials, kids' fashion and party supplies from Lebanese shops. Cash on delivery available."), alternates: alternates("/shop") };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const showProducts = sp.view === "products" || !!sp.q;
  const [{ root, items: cats }, stores] = await Promise.all([
    shopCategories(locale),
    showProducts ? Promise.resolve([]) : listStores(locale),
  ]);
  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Shop for kids")}</h1>
      <p className="mt-2 text-ink-muted">{t("From Lebanese shops, delivered to your door. Cash on delivery available.")}</p>
      <ShopCategories items={cats} t={t} />
      {root && <CategorySponsor categoryId={root.id} t={t} />}
      <div className="mt-8 flex gap-2">
        <Link href="/shop" className={`chip ${!showProducts ? "chip-on" : ""}`} scroll={false}>
          {t("Shops")}
        </Link>
        <Link href="/shop?view=products" className={`chip ${showProducts ? "chip-on" : ""}`} scroll={false}>
          {t("All products")}
        </Link>
      </div>
      {showProducts ? (
        <div className="mt-6">
          <ShopGrid filters={parseShopParams(sp)} sp={sp} basePath="/shop" />
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-muted">{t("{n} shops · tap a shop to see everything it sells", { n: stores.length })}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((st) => (
              <StoreCard key={st.id} s={st} t={t} wide />
            ))}
          </div>
          {!stores.length && <p className="mt-6 rounded-3xl bg-canvas p-8 text-center text-sm text-ink-muted">{t("No shops yet.")}</p>}
        </>
      )}
    </div>
  );
}
