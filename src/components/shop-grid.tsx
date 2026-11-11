import Link from "next/link";
import { ProductCard } from "@/components/cards";
import { EmptyState, Pager } from "@/components/empty";
import { searchProducts, type ProductFilters } from "@/server/listings";
import { favoriteIds } from "@/server/home";
import { getCurrentUser } from "@/server/auth";
import { getLocale, getT } from "@/i18n/server";
import { AGE_BANDS } from "@/lib/areas";
import { one, page as pageOf, withParams, type SP } from "@/lib/filters";

const PER = 30;

export function parseShopParams(sp: SP): ProductFilters {
  const age = AGE_BANDS.find((b) => b.key === one(sp.age));
  const max = parseFloat(one(sp.maxPrice));
  const sort = one(sp.sort);
  return {
    q: one(sp.q) || undefined,
    ageMin: age?.min,
    ageMax: age?.max,
    maxPriceCents: Number.isFinite(max) && max > 0 ? Math.round(max * 100) : undefined,
    onSale: one(sp.sale) === "1" || undefined,
    inStock: one(sp.stock) === "1" || undefined,
    sort: (["price", "price-desc", "newest", "rating"].includes(sort) ? sort : undefined) as ProductFilters["sort"],
  };
}

export async function ShopGrid({ filters, sp, basePath }: { filters: ProductFilters; sp: SP; basePath: string }) {
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const page = pageOf(sp);
  const [{ items, total }, saved] = await Promise.all([searchProducts({ ...filters, limit: PER, offset: (page - 1) * PER }, locale), favoriteIds(user?.id)]);
  const chip = (k: string, v: string, label: string) => {
    const on = one(sp[k]) === v;
    return (
      <Link key={k + v} href={basePath + withParams(sp, { [k]: on ? null : v })} className={`chip shrink-0 ${on ? "chip-on" : ""}`} scroll={false}>
        {label}
      </Link>
    );
  };
  return (
    <>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {AGE_BANDS.map((b) => chip("age", b.key, t("{a}–{b} yrs", { a: b.min, b: b.max })))}
        <span className="mx-1 h-6 w-px shrink-0 self-center bg-ink/10" />
        {chip("maxPrice", "20", t("Under ${n}", { n: 20 }))}
        {chip("maxPrice", "50", t("Under ${n}", { n: 50 }))}
        {chip("sale", "1", t("On sale"))}
        {chip("stock", "1", t("In stock"))}
        <span className="mx-1 h-6 w-px shrink-0 self-center bg-ink/10" />
        {chip("sort", "price", t("Lowest price"))}
        {chip("sort", "newest", t("Newest"))}
      </div>
      {items.length === 0 ? (
        <EmptyState title={t("No products found")} cta={{ href: basePath, label: t("Clear filters") }} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} t={t} locale={locale} saved={saved.has(p.id)} wide />
            ))}
          </div>
          <Pager page={page} total={total} perPage={PER} t={t} hrefFor={(p) => basePath + withParams(sp, { page: String(p) })} />
        </>
      )}
    </>
  );
}
