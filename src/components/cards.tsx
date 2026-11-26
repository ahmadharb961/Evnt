import Link from "next/link";
import { imgProps, imgUrl } from "@/lib/img";
import { Star, MapPin, Calendar, ShoppingBag, ArrowRight } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtTime } from "@/lib/dates";
import type { EventCardData, ProductCardData, RestaurantCardData, StoreCardData } from "@/lib/types";
import type { Locale, T } from "@/i18n/core";

export function ageLabel(t: T, min: number, max: number) {
  if (min <= 0 && max >= 12) return t("All ages");
  if (min <= 0) return t("Up to {n} yrs", { n: max });
  if (max >= 16) return t("{n}+ yrs", { n: min });
  return t("{a}–{b} yrs", { a: min, b: max });
}

function Rating({ value, count, t }: { value: number; count: number; t: T }) {
  if (!count) return <span className="text-xs text-ink-muted">{t("New")}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold">
      <Star className="h-3.5 w-3.5 fill-ink text-ink" />
      {value.toFixed(1)}
      <span className="font-normal text-ink-muted">({count})</span>
    </span>
  );
}

export function SponsoredTag({ t }: { t: T }) {
  return <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{t("Sponsored")}</span>;
}

export function EventCard({ e, t, locale, saved, wide = false }: { e: EventCardData; t: T; locale: Locale; saved?: boolean; wide?: boolean }) {
  const href = `/events/${e.slug}${e.sponsored ? "?src=sponsored" : ""}`;
  return (
    <Link href={href} className={`group flex flex-col overflow-hidden rounded-3xl border border-ink/[.07] bg-white shadow-card transition duration-300 hover:shadow-lift ${wide ? "" : "w-[78vw] max-w-[300px] shrink-0 snap-start sm:w-[280px]"}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-powder-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...imgProps(e.image, "(max-width: 640px) 80vw, 300px", [384, 640, 828], 66)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {e.sponsored && <SponsoredTag t={t} />}
            {e.isFree && <span className="rounded-full bg-peach px-2 py-0.5 text-[10px] font-bold uppercase text-peach-deep">{t("Free")}</span>}
            {e.availability === "limited" && <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink">{t("Few spots left")}</span>}
            {e.availability === "soldout" && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">{t("Sold out")}</span>}
          </div>
          <FavoriteButton type="event" id={e.id} saved={saved} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
          <span className="truncate">{e.categoryName}</span>
          <Rating value={e.rating} count={e.ratingCount} t={t} />
        </div>
        <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug">{e.title}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          {e.nextStartsAt && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {fmtDate(new Date(e.nextStartsAt), locale)} · {fmtTime(new Date(e.nextStartsAt), locale)}
              {e.sessionsCount > 1 && <span className="text-ink-muted">+{e.sessionsCount - 1}</span>}
            </span>
          )}
          {e.areaName && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {e.areaName}
            </span>
          )}
        </div>
        <div className="mt-auto pt-3"><div className="flex items-center justify-between border-t border-ink/[.06] pt-3">
          <span className="rounded-full bg-powder-soft px-2.5 py-1 text-[11px] font-medium text-powder-deep">{ageLabel(t, e.ageMin, e.ageMax)}</span>
          <span className="text-sm font-bold">{e.isFree ? t("Free") : t("From {price}", { price: formatMoney(e.fromPriceCents, locale) })}</span>
        </div></div>
      </div>
    </Link>
  );
}

const FACILITY_LABEL: Record<string, string> = {
  kidsMenu: "Kids' menu",
  highChairs: "High chairs",
  playArea: "Play area",
  outdoorSeating: "Outdoor seating",
  strollerAccess: "Stroller friendly",
  changingFacilities: "Changing table",
  parking: "Parking",
  birthdaySuitable: "Birthdays",
};
export const facilityLabel = (t: T, k: string) => t(FACILITY_LABEL[k] ?? k);

export function RestaurantCard({ r, t, saved, wide = false }: { r: RestaurantCardData; t: T; saved?: boolean; wide?: boolean }) {
  return (
    <Link href={`/restaurants/${r.slug}`} className={`group flex flex-col overflow-hidden rounded-3xl border border-ink/[.07] bg-white shadow-card transition duration-300 hover:shadow-lift ${wide ? "" : "w-[78vw] max-w-[300px] shrink-0 snap-start sm:w-[280px]"}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-mint-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...imgProps(r.image, "(max-width: 640px) 80vw, 300px", [384, 640, 828], 66)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <div className="flex gap-1.5">
            {r.sponsored && <SponsoredTag t={t} />}
          </div>
          <FavoriteButton type="restaurant" id={r.id} saved={saved} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
          <span className="truncate">
            {r.cuisines.join(" · ")} · {"$".repeat(r.priceLevel)}
          </span>
          <Rating value={r.rating} count={r.ratingCount} t={t} />
        </div>
        <h3 className="mt-1 text-[15px] font-semibold">{r.name}</h3>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-soft">
          <MapPin className="h-3.5 w-3.5" />
          {r.areaName}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {r.facilities.slice(0, 3).map((f) => (
            <span key={f} className="rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-medium text-mint-deep">
              {facilityLabel(t, f)}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function ProductCard({ p, t, locale, saved, wide = false }: { p: ProductCardData; t: T; locale: Locale; saved?: boolean; wide?: boolean }) {
  return (
    <Link href={`/shop/p/${p.slug}`} className={`group flex flex-col overflow-hidden rounded-3xl border border-ink/[.07] bg-white shadow-card transition duration-300 hover:shadow-lift ${wide ? "" : "w-[44vw] max-w-[220px] shrink-0 snap-start sm:w-[220px]"}`}>
      <div className="relative aspect-square overflow-hidden bg-blush-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...imgProps(p.image, "(max-width: 640px) 45vw, 220px", [256, 384, 640], 70)} alt="" loading="lazy" className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${p.inStock ? "" : "opacity-60"}`} />
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between">
          <div className="flex gap-1">
            {p.sponsored && <SponsoredTag t={t} />}
            {p.salePriceCents != null && <span className="rounded-full bg-blush px-2 py-0.5 text-[10px] font-bold uppercase text-blush-deep">{t("Sale")}</span>}
            {!p.inStock && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">{t("Out of stock")}</span>}
          </div>
          <FavoriteButton type="product" id={p.id} saved={saved} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <p className="truncate text-xs text-ink-muted">{p.merchantName}</p>
        <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{p.title}</h3>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-sm font-bold">{formatMoney(p.salePriceCents ?? p.priceCents, locale)}</span>
          {p.salePriceCents != null && <span className="text-xs text-ink-muted line-through">{formatMoney(p.priceCents, locale)}</span>}
        </div>
      </div>
    </Link>
  );
}

/** A shop on EVNT: tap to see all its products. */
export function StoreCard({ s, t, wide = false }: { s: StoreCardData; t: T; wide?: boolean }) {
  return (
    <Link href={`/m/${s.slug}`} className={`group flex flex-col overflow-hidden rounded-3xl border border-ink/[.07] bg-white shadow-card transition duration-300 hover:shadow-lift ${wide ? "" : "w-[78vw] max-w-[300px] shrink-0 snap-start sm:w-[280px]"}`}>
      <div className="relative aspect-[16/9] overflow-hidden bg-blush-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...imgProps(s.cover, "(max-width: 640px) 90vw, 400px", [384, 640, 828], 66)} alt="" loading="lazy" className={`h-full w-full transition duration-500 group-hover:scale-[1.03] ${s.coverIsProduct ? "bg-white object-contain p-3" : "object-cover"}`} />
        {s.onSale > 0 && <span className="absolute end-3 top-3 rounded-full bg-blush px-2.5 py-1 text-[10px] font-bold uppercase text-blush-deep">{t("Sale")}</span>}
      </div>
      <div className="relative flex flex-1 flex-col px-4 pb-4">
        <div className="-mt-7 flex items-end gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-card">
            {s.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(s.logo, 128)} alt="" className="h-full w-full object-cover" />
            ) : (
              <ShoppingBag className="h-6 w-6 text-blush-deep" />
            )}
          </span>
        </div>
        <h3 className="mt-2 text-[17px] font-bold leading-snug">{s.name}</h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-muted">
          {s.areaName && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {s.areaName}
            </span>
          )}
          <Rating value={s.rating} count={s.ratingCount} t={t} />
        </p>
        {s.previews.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {s.previews.map((p, i) => (
              <span key={i} className="aspect-square overflow-hidden rounded-xl bg-canvas ring-1 ring-ink/[.04]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl(p, 128)} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" />
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="rounded-full bg-blush-soft px-2.5 py-1 text-[11px] font-semibold text-blush-deep">{t("{n} products", { n: s.productCount })}</span>
          <span className="inline-flex items-center gap-1 text-sm font-bold">
            {t("Visit shop")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </span>
        </div>
      </div>
    </Link>
  );
}
