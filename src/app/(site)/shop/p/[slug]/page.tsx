import { notFound } from "next/navigation";
import Link from "next/link";
import { Truck, Banknote } from "lucide-react";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { favoriteIds } from "@/server/home";
import { listReviews } from "@/server/reviews";
import { searchProducts, productFlash, effectiveProductPrice } from "@/server/listings";
import { mediaSrc } from "@/server/media";
import { trackView } from "@/server/analytics";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { Gallery } from "@/components/gallery";
import { AddToCart } from "@/components/add-to-cart";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";
import { ProductCard } from "@/components/cards";
import { ReviewsSection } from "@/components/reviews";
import { Breadcrumbs } from "@/components/category-header";
import { alternates, appUrl } from "@/server/urls";
import { formatMoney } from "@/lib/money";

const img = (s: string) => (s.startsWith("/") || s.startsWith("http") ? s : mediaSrc(s));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, locale] = await Promise.all([prisma.product.findUnique({ where: { slug } }), getLocale()]);
  if (!p) return {};
  return { title: loc(p.title, locale), description: loc(p.description, locale).slice(0, 160), alternates: alternates(`/shop/p/${slug}`), openGraph: { images: p.images[0] ? [img(p.images[0])] : [] } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const p = await prisma.product.findUnique({ where: { slug }, include: { merchant: true, category: { include: { parent: true } }, variants: { where: { active: true }, orderBy: { name: "asc" } } } });
  if (!p || p.status !== "PUBLISHED" || p.merchant.status !== "APPROVED") notFound();
  void trackView(p.merchantId, "product", p.id);
  const flashPct = (await productFlash([p.id])).get(p.id) ?? 0;
  const nowPrice = effectiveProductPrice(p.priceCents, p.salePriceCents, flashPct);
  const sale = nowPrice < p.priceCents ? nowPrice : null;
  const [saved, reviews, related, delivered, reviewed] = await Promise.all([
    favoriteIds(user?.id),
    listReviews({ productId: p.id }),
    searchProducts({ categorySlug: p.category.slug, excludeId: p.id, limit: 10 }, locale),
    user ? prisma.order.count({ where: { group: { userId: user.id }, status: "DELIVERED", items: { some: { productId: p.id } } } }) : 0,
    user ? prisma.review.count({ where: { userId: user.id, productId: p.id } }) : 0,
  ]);
  const title = loc(p.title, locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    image: p.images.map((i) => appUrl() + img(i)),
    description: loc(p.description, locale),
    brand: { "@type": "Brand", name: p.merchant.name },
    offers: { "@type": "Offer", priceCurrency: "USD", price: ((sale ?? p.priceCents) / 100).toFixed(2), availability: p.variants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
    ...(p.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg.toFixed(1), reviewCount: p.ratingCount } } : {}),
  };
  return (
    <div className="container-x py-5 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs items={[{ href: "/shop", label: t("Shop") }, { href: `/shop/c/${p.category.slug}`, label: loc(p.category.name, locale) }]} />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <Gallery images={p.images.map(img)} title={title} />
        </div>
        <div>
          <Link href={`/m/${p.merchant.slug}`} className="text-sm text-ink-muted hover:text-ink">
            {p.merchant.name}
          </Link>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
            <div className="flex shrink-0 gap-2">
              <ShareButton title={title} />
              <FavoriteButton type="product" id={p.id} saved={saved.has(p.id)} variant="plain" />
            </div>
          </div>
          {p.ageMin != null && <p className="mt-2 inline-block rounded-full bg-powder-soft px-3 py-1 text-xs font-medium text-powder-deep">{t("{a}–{b} yrs", { a: p.ageMin, b: p.ageMax ?? 12 })}</p>}
          <div className="mt-6">
            <AddToCart variants={p.variants.map((v) => ({ id: v.id, name: v.name === "Default" ? t("Standard") : v.name, stock: v.stock, priceCents: v.priceCents != null ? effectiveProductPrice(v.priceCents, null, flashPct) : nowPrice }))} comparePriceCents={sale ? p.priceCents : null} />
          </div>
          <div className="mt-8 space-y-3 rounded-3xl bg-canvas p-5 text-sm">
            <p className="flex gap-3">
              <Truck className="h-5 w-5 shrink-0" />
              <span>
                {loc(p.deliveryInfo, locale) || t("Delivered by the shop across Lebanon.")}{" "}
                {t("Delivery: {fee}", { fee: formatMoney(p.merchant.deliveryFeeCents, locale) })}
                {p.merchant.freeDeliveryOverCents != null && ` · ${t("free over {amount}", { amount: formatMoney(p.merchant.freeDeliveryOverCents, locale) })}`}
              </span>
            </p>
            {p.merchant.codEnabled && (
              <p className="flex gap-3">
                <Banknote className="h-5 w-5 shrink-0" />
                {t("Cash on delivery available")}
              </p>
            )}
          </div>
          <div className="prose-evnt mt-8">
            {loc(p.description, locale)
              .split(/\n{2,}/)
              .map((x, i) => (
                <p key={i}>{x}</p>
              ))}
          </div>
        </div>
      </div>
      <div className="mt-14">
        <ReviewsSection data={reviews} t={t} locale={locale} target={{ productId: p.id }} canReview={!!user && delivered > 0 && !reviewed} />
      </div>
      {related.items.length > 0 && (
        <section className="mt-14">
          <h2 className="h-section mb-4">{t("You might also like")}</h2>
          <div className="scroll-row">
            {related.items.map((r) => (
              <ProductCard key={r.id} p={r} t={t} locale={locale} saved={saved.has(r.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
