import Link from "next/link";
import { ArrowRight, Sparkles, MapPin, CalendarDays } from "lucide-react";
import { FarahBadge, SponsoredTag } from "@/components/cards";
import { FavoriteButton } from "@/components/favorite-button";
import type { CardData } from "@/lib/types";
import type { Locale, T } from "@/i18n/core";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

function hrefOf(i: CardData) {
  const src = i.sponsored ? "?src=sponsored" : "";
  if (i.kind === "event") return `/events/${i.slug}${src}`;
  if (i.kind === "restaurant") return `/restaurants/${i.slug}${src}`;
  return `/shop/p/${i.slug}${src}`;
}

function metaOf(i: CardData, t: T, locale: Locale): { title: string; kicker: string; line: string; price: string | null } {
  if (i.kind === "event")
    return {
      title: i.title,
      kicker: i.categoryName,
      line: [i.nextStartsAt ? fmtDate(new Date(i.nextStartsAt), locale, { weekday: "short", day: "numeric", month: "short" }) : "", i.areaName].filter(Boolean).join(" · "),
      price: i.isFree ? t("Free") : i.fromPriceCents ? t("From {price}", { price: formatMoney(i.fromPriceCents, locale) }) : null,
    };
  if (i.kind === "restaurant") return { title: i.name, kicker: t("Restaurant"), line: [i.cuisines.slice(0, 2).join(" · "), i.areaName].filter(Boolean).join(" · "), price: "$".repeat(i.priceLevel) };
  return { title: i.title, kicker: i.merchantName, line: i.inStock ? t("In stock") : t("Out of stock"), price: formatMoney(i.salePriceCents ?? i.priceCents, locale) };
}

function SpotCard({ i, t, locale, saved, hero = false }: { i: CardData; t: T; locale: Locale; saved: Set<string>; hero?: boolean }) {
  const m = metaOf(i, t, locale);
  const farah = i.kind !== "product" && i.farah;
  return (
    <div className={`group relative isolate overflow-hidden rounded-[1.75rem] bg-ink/40 ring-1 ring-white/10 ${hero ? "aspect-[4/5] sm:aspect-auto sm:h-full sm:min-h-[460px]" : "aspect-[4/5]"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={i.image} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2 [&>*:last-child]:pointer-events-auto">
        <div className="flex flex-wrap gap-1.5">
          {i.sponsored && <SponsoredTag t={t} />}
          {farah && <FarahBadge t={t} small />}
        </div>
        <FavoriteButton type={i.kind} id={i.id} saved={saved.has(i.id)} />
      </div>
      <Link href={hrefOf(i)} className="absolute inset-0 flex flex-col justify-end p-5 text-white sm:p-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{m.kicker}</span>
        <span className={`mt-1.5 font-serif font-semibold leading-tight tracking-tight ${hero ? "text-3xl sm:text-4xl" : "text-xl"}`}>{m.title}</span>
        {m.line && (
          <span className="mt-2 flex items-center gap-1.5 text-sm text-white/80">
            {i.kind === "event" ? <CalendarDays className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{m.line}</span>
          </span>
        )}
        <span className="mt-4 flex items-center justify-between gap-3">
          {m.price ? <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-ink">{m.price}</span> : <span />}
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur transition group-hover:bg-white group-hover:text-ink">
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </span>
        </span>
      </Link>
    </div>
  );
}

/** "Handpicked experiences": an editorial, dark showcase that stands apart from the regular rows. */
export function Spotlight({ title, subtitle, href, ctaText, items, t, locale, saved }: { title: string; subtitle?: string; href?: string | null; ctaText?: string; items: CardData[]; t: T; locale: Locale; saved: Set<string> }) {
  if (!items.length) return null;
  const [first, ...rest] = items;
  const side = rest.slice(0, 4);
  const more = rest.slice(4);
  return (
    <section className="mt-12 sm:mt-16">
      <div className="container-x">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#1d1b22] px-4 py-8 text-white sm:rounded-[2.5rem] sm:px-8 sm:py-12 lg:px-12">
          <div aria-hidden className="absolute -end-24 -top-24 -z-10 h-72 w-72 rounded-full bg-blush/30 blur-3xl" />
          <div aria-hidden className="absolute -bottom-32 -start-20 -z-10 h-80 w-80 rounded-full bg-mint/20 blur-3xl" />
          <div aria-hidden className="absolute end-1/3 top-1/2 -z-10 h-56 w-56 rounded-full bg-peach/20 blur-3xl" />
          <div className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
                <Sparkles className="h-3.5 w-3.5 text-peach" />
                {t("Curated by EVNT")}
              </span>
              <h2 className="mt-3 font-serif text-[2rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl">{title}</h2>
              {subtitle && <p className="mt-3 text-sm text-white/70 sm:text-base">{subtitle}</p>}
            </div>
            {href && (
              <Link href={href} className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-peach sm:self-auto">
                {ctaText || t("See all")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            )}
          </div>
          {/* Phones: one swipeable row of tall cards. Larger screens: a big lead card with a 2×2 grid beside it. */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:hidden [scrollbar-width:none]">
            {items.map((i) => (
              <div key={i.kind + i.id} className="w-[80vw] max-w-[320px] shrink-0 snap-start">
                <SpotCard i={i} t={t} locale={locale} saved={saved} />
              </div>
            ))}
          </div>
          <div className="hidden gap-4 sm:grid lg:grid-cols-2">
            <SpotCard i={first} t={t} locale={locale} saved={saved} hero />
            {side.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {side.map((i) => (
                  <SpotCard key={i.kind + i.id} i={i} t={t} locale={locale} saved={saved} />
                ))}
              </div>
            )}
          </div>
          {more.length > 0 && (
            <div className="mt-4 hidden snap-x gap-4 overflow-x-auto pb-1 sm:flex [scrollbar-width:none]">
              {more.map((i) => (
                <div key={i.kind + i.id} className="w-[calc((100%-3rem)/4)] min-w-[220px] shrink-0 snap-start">
                  <SpotCard i={i} t={t} locale={locale} saved={saved} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
