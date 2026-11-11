import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, MessageCircle, Phone, Clock } from "lucide-react";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { favoriteIds } from "@/server/home";
import { listReviews } from "@/server/reviews";
import { searchRestaurants, RESTAURANT_FACILITIES } from "@/server/listings";
import { isOpenAt, type Hours } from "@/server/restaurants";
import { mediaSrc } from "@/server/media";
import { trackView } from "@/server/analytics";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { Gallery } from "@/components/gallery";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";
import { FarahBadge, facilityLabel, RestaurantCard } from "@/components/cards";
import { ReviewsSection } from "@/components/reviews";
import { ResultsMap } from "@/components/results-map";
import { ReservationForm } from "@/components/reservation-form";
import { Breadcrumbs } from "@/components/category-header";
import { alternates, appUrl } from "@/server/urls";
import { areaName } from "@/lib/areas";
import { ymdString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

const img = (s: string) => (s.startsWith("/") || s.startsWith("http") ? s : mediaSrc(s));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [r, locale, t] = await Promise.all([prisma.restaurant.findUnique({ where: { slug }, include: { location: true } }), getLocale(), getT()]);
  if (!r) return {};
  return { title: t("{name} — kids-friendly restaurant in {area}", { name: r.name, area: areaName(r.location?.area, locale) }), description: loc(r.about, locale).slice(0, 160), alternates: alternates(`/restaurants/${slug}`) };
}

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const r = await prisma.restaurant.findUnique({ where: { slug }, include: { merchant: true, location: true } });
  if (!r || r.status !== "PUBLISHED" || r.merchant.status !== "APPROVED") notFound();
  void trackView(r.merchantId, "restaurant", r.id);
  const [saved, reviews, nearby, completed, reviewed] = await Promise.all([
    favoriteIds(user?.id),
    listReviews({ restaurantId: r.id }),
    searchRestaurants({ area: r.location?.area, excludeId: r.id, limit: 6 }, locale),
    user ? prisma.restaurantReservation.count({ where: { userId: user.id, restaurantId: r.id, status: "COMPLETED" } }) : 0,
    user ? prisma.review.count({ where: { userId: user.id, restaurantId: r.id } }) : 0,
  ]);
  const hours = r.hours as Hours;
  const open = isOpenAt(hours, new Date());
  const days = [
    ["mon", t("Monday")],
    ["tue", t("Tuesday")],
    ["wed", t("Wednesday")],
    ["thu", t("Thursday")],
    ["fri", t("Friday")],
    ["sat", t("Saturday")],
    ["sun", t("Sunday")],
  ] as const;
  const farah = !!r.merchant.farahUntil && r.merchant.farahUntil > new Date();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: r.name,
    image: [img(r.coverId ?? r.coverUrl ?? "/brand/placeholder.svg")].map((x) => (x.startsWith("http") ? x : appUrl() + x)),
    servesCuisine: r.cuisines,
    priceRange: "$".repeat(r.priceLevel),
    address: r.location ? { "@type": "PostalAddress", streetAddress: r.location.address, addressLocality: areaName(r.location.area, "en"), addressCountry: "LB" } : undefined,
    geo: r.location?.lat ? { "@type": "GeoCoordinates", latitude: r.location.lat, longitude: r.location.lng } : undefined,
    ...(r.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: r.ratingAvg.toFixed(1), reviewCount: r.ratingCount } } : {}),
  };
  return (
    <div className="container-x py-5 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs items={[{ href: "/", label: t("Home") }, { href: "/restaurants", label: t("Restaurants") }, { label: r.name }]} />
      <Gallery images={[mediaSrc(r.coverId, r.coverUrl), ...r.gallery.map(img)]} video={r.videoUrl} title={r.name} />
      <div className="mt-6 grid gap-10 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              {farah && <FarahBadge t={t} />}
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{r.name}</h1>
              <p className="mt-1 text-sm text-ink-muted">
                {r.cuisines.join(" · ")} · {"$".repeat(r.priceLevel)} · <span className={open ? "font-semibold text-mint-deep" : ""}>{open ? t("Open now") : t("Closed now")}</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <ShareButton title={r.name} />
              <FavoriteButton type="restaurant" id={r.id} saved={saved.has(r.id)} variant="plain" />
            </div>
          </div>
          <p className="mt-5 text-ink-soft">{loc(r.about, locale)}</p>
          <section className="mt-8">
            <h2 className="h-section">{t("For families")}</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RESTAURANT_FACILITIES.map((f) => (
                <div key={f} className={`rounded-2xl p-3 text-sm ${r[f] ? "bg-mint-soft font-medium text-mint-deep" : "bg-canvas text-ink-muted line-through"}`}>
                  {facilityLabel(t, f)}
                </div>
              ))}
            </div>
          </section>
          <section className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4" />
                {t("Opening hours")}
              </h2>
              <ul className="space-y-1 text-sm">
                {days.map(([k, l]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-ink-muted">{l}</span>
                    <span dir="ltr">{hours[k]?.length ? hours[k]!.map(([a, b]) => `${a}–${b}`).join(", ") : t("Closed")}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4" />
                {t("Location")}
              </h2>
              {r.location && (
                <>
                  <p className="text-sm text-ink-soft">
                    {r.location.address}, {areaName(r.location.area, locale)}
                  </p>
                  {r.location.lat != null && (
                    <div className="mt-3">
                      <ResultsMap height={200} points={[{ id: r.id, lat: r.location.lat, lng: r.location.lng!, title: r.name, subtitle: r.location.address, href: `/restaurants/${r.slug}`, image: mediaSrc(r.coverId, r.coverUrl) }]} />
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
          <div className="mt-8 flex flex-wrap gap-2">
            {r.merchant.whatsapp && (
              <a href={`/go/whatsapp/${r.merchant.slug}?t=restaurant&id=${r.id}`} rel="nofollow" className="btn-outline">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            )}
            {r.merchant.phone && (
              <a href={`/go/phone/${r.merchant.slug}?t=restaurant&id=${r.id}`} rel="nofollow" className="btn-outline">
                <Phone className="h-4 w-4" />
                {t("Call")}
              </a>
            )}
          </div>
          <div id="reviews" className="mt-12">
            <ReviewsSection data={reviews} t={t} locale={locale} target={{ restaurantId: r.id }} canReview={!!user && completed > 0 && !reviewed} />
          </div>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-bold">{r.acceptsReservations ? t("Reserve a table") : t("Contact the restaurant")}</h2>
            {r.acceptsReservations ? (
              <ReservationForm restaurantId={r.id} maxParty={r.maxPartySize} signedIn={!!user} phone={user?.phone ?? ""} minDate={ymdString(new Date())} deposit={r.depositCents ? formatMoney(r.depositCents, locale) : null} next={`/restaurants/${r.slug}`} />
            ) : (
              <p className="text-sm text-ink-muted">{t("This restaurant doesn't take online reservations. Contact them on WhatsApp or by phone.")}</p>
            )}
          </div>
        </aside>
      </div>
      {nearby.items.length > 0 && (
        <section className="mt-16">
          <h2 className="h-section mb-4">{t("More family spots nearby")}</h2>
          <div className="scroll-row">
            {nearby.items.map((x) => (
              <RestaurantCard key={x.id} r={x} t={t} saved={saved.has(x.id)} />
            ))}
          </div>
        </section>
      )}
      <Link href="/restaurants" className="sr-only">
        {t("All restaurants")}
      </Link>
    </div>
  );
}
