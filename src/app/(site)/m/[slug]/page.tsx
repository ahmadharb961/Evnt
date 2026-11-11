import { notFound } from "next/navigation";
import { MapPin, MessageCircle, Phone, Globe, Instagram } from "lucide-react";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { favoriteIds } from "@/server/home";
import { searchEvents, searchProducts, searchRestaurants } from "@/server/listings";
import { listReviews } from "@/server/reviews";
import { mediaSrc } from "@/server/media";
import { trackView } from "@/server/analytics";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { FarahBadge } from "@/components/cards";
import { SectionRow } from "@/components/home/section-row";
import { Stars } from "@/components/reviews";
import { areaName } from "@/lib/areas";
import { alternates } from "@/server/urls";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [m, locale] = await Promise.all([prisma.merchant.findUnique({ where: { slug } }), getLocale()]);
  if (!m || m.status !== "APPROVED") return {};
  return { title: m.name, description: loc(m.about, locale).slice(0, 160), alternates: alternates(`/m/${slug}`) };
}

export default async function MerchantProfile({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ad?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const m = await prisma.merchant.findUnique({ where: { slug }, include: { locations: true } });
  if (!m || m.status !== "APPROVED") notFound();
  void trackView(m.id, "merchant", m.id);
  if (sp.ad && /^[a-z0-9]{20,40}$/.test(sp.ad)) await prisma.adCampaign.updateMany({ where: { id: sp.ad, merchantId: m.id }, data: { clicks: { increment: 1 } } });
  const [events, products, restaurants, reviews, saved] = await Promise.all([
    searchEvents({ merchantId: m.id, limit: 20, includeSoldOut: true }, locale),
    searchProducts({ merchantId: m.id, limit: 20 }, locale),
    prisma.restaurant.findMany({ where: { merchantId: m.id, status: "PUBLISHED" }, select: { id: true } }),
    listReviews({ merchantId: m.id }, 6),
    favoriteIds(user?.id),
  ]);
  const rs = restaurants.length ? await searchRestaurants({ ids: restaurants.map((r) => r.id) }, locale) : { items: [] };
  const farah = !!m.farahUntil && m.farahUntil > new Date();
  return (
    <div>
      <div className="relative h-48 bg-powder-soft sm:h-72">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {m.coverId && <img src={mediaSrc(m.coverId)} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="container-x">
        <div className="-mt-12 flex flex-wrap items-end gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaSrc(m.logoId ?? m.coverId)} alt="" className="h-24 w-24 rounded-3xl border-4 border-white bg-white object-cover shadow-card" />
          <div className="pb-1">
            <h1 className="text-3xl font-bold tracking-tight">{m.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
              {farah && <FarahBadge t={t} small />}
              {m.ratingCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Stars value={m.ratingAvg} size="h-3.5 w-3.5" /> {m.ratingAvg.toFixed(1)} ({m.ratingCount})
                </span>
              )}
              {m.locations.map((l) => (
                <span key={l.id} className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {areaName(l.area, locale)}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-6 max-w-2xl text-ink-soft">{loc(m.about, locale)}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {m.whatsapp && (
            <a href={`/go/whatsapp/${m.slug}?t=merchant&id=${m.id}`} rel="nofollow" className="btn-primary">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          )}
          {m.phone && (
            <a href={`/go/phone/${m.slug}?t=merchant&id=${m.id}`} rel="nofollow" className="btn-outline">
              <Phone className="h-4 w-4" />
              {t("Call")}
            </a>
          )}
          {m.website && (
            <a href={`/go/website/${m.slug}?t=merchant&id=${m.id}`} rel="nofollow noopener" target="_blank" className="btn-outline">
              <Globe className="h-4 w-4" />
              {t("Website")}
            </a>
          )}
          {m.instagram && (
            <a href={`https://instagram.com/${encodeURIComponent(m.instagram)}`} rel="nofollow noopener" target="_blank" className="btn-outline">
              <Instagram className="h-4 w-4" />
              Instagram
            </a>
          )}
        </div>
      </div>
      <SectionRow title={t("Activities & events")} items={events.items} layout="GRID" t={t} locale={locale} saved={saved} />
      <SectionRow title={t("Restaurant")} items={rs.items} t={t} locale={locale} saved={saved} />
      <SectionRow title={t("Shop")} items={products.items} layout="GRID" t={t} locale={locale} saved={saved} />
      {reviews.total > 0 && (
        <section className="container-x mt-12">
          <h2 className="h-section mb-4">{t("What parents say")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {reviews.items.map((r) => (
              <div key={r.id} className="card p-5">
                <Stars value={r.rating} size="h-3.5 w-3.5" />
                <p className="mt-2 text-sm text-ink-soft">{r.body}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  {r.author}
                  {r.verified ? ` · ${t("Verified booking")}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
