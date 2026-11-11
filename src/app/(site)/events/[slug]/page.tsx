import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Users, Sun, Home, Accessibility, MessageCircle, Clock, Zap } from "lucide-react";
import { loadEventPage } from "@/server/event-page";
import { getCurrentUser } from "@/server/auth";
import { favoriteIds } from "@/server/home";
import { getSetting } from "@/server/settings";
import { isMember } from "@/server/membership";
import { listReviews } from "@/server/reviews";
import { searchEvents } from "@/server/listings";
import { prisma } from "@/server/db";
import { trackView } from "@/server/analytics";
import { getLocale, getT } from "@/i18n/server";
import { BookingPanel } from "@/components/booking/booking-panel";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";
import { ageLabel, EventCard, FarahBadge } from "@/components/cards";
import { ReviewsSection } from "@/components/reviews";
import { ResultsMap } from "@/components/results-map";
import { Breadcrumbs } from "@/components/category-header";
import { Gallery } from "@/components/gallery";
import { categoryHref } from "@/components/home/category-tiles";
import { appUrl, alternates } from "@/server/urls";
import { formatMoney } from "@/lib/money";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const e = await loadEventPage(slug, locale);
  if (!e) return {};
  return {
    title: e.title,
    description: e.summary || e.description.slice(0, 160),
    alternates: alternates(`/events/${e.slug}`),
    openGraph: { title: e.title, description: e.summary, images: [e.gallery[0]] },
  };
}

export default async function EventPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ session?: string; ad?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const e = await loadEventPage(slug, locale, user?.id);
  if (!e) notFound();
  const staffView = user && (user.roles.length > 0 || (await prisma.merchantStaff.findFirst({ where: { userId: user.id, merchantId: e.merchant.id } })));
  if ((e.status !== "PUBLISHED" || !e.merchantApproved) && !staffView) notFound();
  if (!staffView) void trackView(e.merchant.id, "event", e.id);
  if (sp.ad && /^[a-z0-9]{20,40}$/.test(sp.ad)) await prisma.adCampaign.updateMany({ where: { id: sp.ad, eventId: e.id }, data: { clicks: { increment: 1 } } });

  const [saved, feeCents, member, holdMinutes, reviews, related, completed] = await Promise.all([
    favoriteIds(user?.id),
    getSetting("booking.feeCents"),
    isMember(user?.id),
    getSetting("booking.holdMinutes"),
    listReviews({ eventId: e.id }),
    searchEvents({ categorySlug: e.category.parent?.slug ?? e.category.slug, excludeId: e.id, limit: 8 }, locale),
    user ? prisma.booking.count({ where: { userId: user.id, eventId: e.id, status: "COMPLETED" } }) : Promise.resolve(0),
  ]);
  const alreadyReviewed = user ? await prisma.review.count({ where: { userId: user.id, eventId: e.id } }) : 0;
  const minPrice = e.ticketTypes.length ? Math.min(...e.ticketTypes.map((x) => x.priceCents)) : 0;
  const next = e.sessions.find((s) => s.remaining > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    description: e.summary || e.description.slice(0, 300),
    image: e.gallery.map((g) => (g.startsWith("http") ? g : appUrl() + g)),
    startDate: next?.startsAt ?? e.sessions[0]?.startsAt,
    endDate: next?.endsAt ?? e.sessions[0]?.endsAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: e.location ? { "@type": "Place", name: e.location.name, address: { "@type": "PostalAddress", streetAddress: e.location.address, addressLocality: e.location.area, addressCountry: "LB" } } : undefined,
    organizer: { "@type": "Organization", name: e.merchant.name, url: `${appUrl()}/m/${e.merchant.slug}` },
    offers: { "@type": "Offer", price: (minPrice / 100).toFixed(2), priceCurrency: "USD", availability: next ? "https://schema.org/InStock" : "https://schema.org/SoldOut", url: `${appUrl()}/events/${e.slug}` },
    typicalAgeRange: `${e.ageMin}-${e.ageMax}`,
    ...(e.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: e.rating.toFixed(1), reviewCount: e.ratingCount } } : {}),
  };

  return (
    <div className="container-x py-5 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {e.status !== "PUBLISHED" && <p className="mb-4 rounded-2xl bg-peach-soft px-4 py-3 text-sm text-peach-deep">{t("Preview: this listing is not published yet.")}</p>}
      <Breadcrumbs
        items={[
          { href: "/", label: t("Home") },
          ...(e.category.parent ? [{ href: categoryHref(e.category.parent.slug), label: e.category.parent.name }] : []),
          { href: `/c/${e.category.slug}`, label: e.category.name },
        ]}
      />
      <Gallery images={e.gallery} video={e.videoUrl} title={e.title} />

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {e.merchant.farah && <FarahBadge t={t} />}
                {e.flashPercent > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blush px-2.5 py-1 text-xs font-bold text-blush-deep">
                    <Zap className="h-3.5 w-3.5" />
                    {t("{n}% off for a limited time", { n: e.flashPercent })}
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{e.title}</h1>
              <Link href={`/m/${e.merchant.slug}`} className="mt-2 inline-block text-sm text-ink-muted hover:text-ink">
                {t("by {name}", { name: e.merchant.name })}
              </Link>
            </div>
            <div className="flex shrink-0 gap-2">
              <ShareButton title={e.title} />
              <FavoriteButton type="event" id={e.id} saved={saved.has(e.id)} variant="plain" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Users, label: t("Ages"), value: ageLabel(t, e.ageMin, e.ageMax) },
              { icon: e.setting === "OUTDOOR" ? Sun : Home, label: t("Setting"), value: e.setting === "OUTDOOR" ? t("Outdoor") : e.setting === "INDOOR" ? t("Indoor") : t("Indoor & outdoor") },
              { icon: MapPin, label: t("Where"), value: e.location?.area ?? "—" },
              { icon: Clock, label: t("Price"), value: e.isFree ? t("Free") : t("From {price}", { price: formatMoney(minPrice, locale) }) },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl bg-canvas p-3.5">
                <f.icon className="h-4 w-4 text-ink-muted" />
                <p className="mt-2 text-xs text-ink-muted">{f.label}</p>
                <p className="text-sm font-semibold">{f.value}</p>
              </div>
            ))}
          </div>

          {e.summary && <p className="mt-6 text-lg leading-relaxed text-ink-soft">{e.summary}</p>}
          <div className="prose-evnt mt-4">
            {e.description.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {e.included && (
            <section className="mt-8">
              <h2 className="h-section">{t("What's included")}</h2>
              <ul className="mt-3 space-y-2">
                {e.included.split("\n").filter(Boolean).map((l) => (
                  <li key={l} className="flex items-start gap-2 text-ink-soft">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mint-deep" />
                    {l}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {e.importantInfo && (
            <section className="mt-8">
              <h2 className="h-section">{t("Good to know")}</h2>
              <p className="mt-3 whitespace-pre-line text-ink-soft">{e.importantInfo}</p>
              {e.accessible && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-soft">
                  <Accessibility className="h-4 w-4" />
                  {t("Wheelchair accessible")}
                </p>
              )}
            </section>
          )}
          <section className="mt-8">
            <h2 className="h-section">{t("Cancellation policy")}</h2>
            <p className="mt-3 whitespace-pre-line text-ink-soft">{e.cancellationPolicy || t("Free cancellation up to 48 hours before the session (24 hours for EVNT+ members). No refunds after that.")}</p>
          </section>

          {e.location && (
            <section className="mt-8">
              <h2 className="h-section">{t("Location")}</h2>
              <p className="mt-2 text-ink-soft">
                {e.location.name} · {e.location.address}
              </p>
              {e.location.lat != null && (
                <div className="mt-3">
                  <ResultsMap height={260} points={[{ id: e.id, lat: e.location.lat, lng: e.location.lng!, title: e.title, subtitle: e.location.address, href: `/events/${e.slug}`, image: e.gallery[0] }]} />
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${e.location.lat},${e.location.lng}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold underline-offset-4 hover:underline">
                    {t("Get directions")}
                  </a>
                </div>
              )}
            </section>
          )}

          {e.merchant.whatsapp && (
            <a href={`/go/whatsapp/${e.merchant.slug}?t=event&id=${e.id}&text=${encodeURIComponent(`Hello! A question about "${e.title}" (found on EVNT)`)}`} className="btn-outline mt-8" rel="nofollow">
              <MessageCircle className="h-4 w-4" />
              {t("Ask the organizer on WhatsApp")}
            </a>
          )}

          <div className="mt-12">
            <ReviewsSection data={reviews} t={t} locale={locale} target={{ eventId: e.id }} canReview={!!user && completed > 0 && !alreadyReviewed} />
          </div>
        </div>

        <aside id="book" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="lg:card lg:p-6">
            <h2 className="mb-4 text-lg font-bold">{t("Book your spot")}</h2>
            <BookingPanel
              sessions={e.sessions}
              ticketTypes={e.ticketTypes}
              seating={e.seatingMode === "ASSIGNED" && e.seatingMap ? e.seatingMap : null}
              flashPercent={e.flashPercent}
              feeCents={feeCents}
              isMember={member}
              initialSession={sp.session}
              holdMinutes={holdMinutes}
            />
          </div>
        </aside>
      </div>

      {related.items.length > 0 && (
        <section className="mt-16">
          <h2 className="h-section mb-4">{t("You might also like")}</h2>
          <div className="scroll-row">
            {related.items.map((r) => (
              <EventCard key={r.id} e={r} t={t} locale={locale} saved={saved.has(r.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
