import Link from "next/link";
import { ScrollRow } from "@/components/scroll-row";
import { ArrowRight } from "lucide-react";
import { EventCard, ProductCard, RestaurantCard } from "@/components/cards";
import type { CardData } from "@/lib/types";
import type { Locale, T } from "@/i18n/core";

export function CardGrid({ items, t, locale, saved }: { items: CardData[]; t: T; locale: Locale; saved: Set<string> }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((i) => (
        <Card key={i.kind + i.id} i={i} t={t} locale={locale} saved={saved} wide />
      ))}
    </div>
  );
}

export function Card({ i, t, locale, saved, wide }: { i: CardData; t: T; locale: Locale; saved: Set<string>; wide?: boolean }) {
  if (i.kind === "event") return <EventCard e={i} t={t} locale={locale} saved={saved.has(i.id)} wide={wide} />;
  if (i.kind === "restaurant") return <RestaurantCard r={i} t={t} saved={saved.has(i.id)} wide={wide} />;
  return <ProductCard p={i} t={t} locale={locale} saved={saved.has(i.id)} wide={wide} />;
}

export function SectionRow({
  title,
  subtitle,
  href,
  ctaText,
  items,
  layout = "CAROUSEL",
  banner,
  t,
  locale,
  saved,
}: {
  title: string;
  subtitle?: string;
  href?: string | null;
  ctaText?: string;
  items: CardData[];
  layout?: "CAROUSEL" | "GRID";
  banner?: string | null;
  t: T;
  locale: Locale;
  saved: Set<string>;
}) {
  if (!items.length) return null;
  const onlyProducts = items.every((i) => i.kind === "product");
  return (
    <section className="container-x mt-12 sm:mt-14">
      {banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner} alt="" loading="lazy" className="mb-5 aspect-[3/1] w-full rounded-3xl object-cover sm:aspect-[5/1]" />
      )}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="h-section">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
            {ctaText || t("See all")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        )}
      </div>
      {layout === "GRID" ? (
        onlyProducts ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((i) => (
              <Card key={i.id} i={i} t={t} locale={locale} saved={saved} wide />
            ))}
          </div>
        ) : (
          <CardGrid items={items} t={t} locale={locale} saved={saved} />
        )
      ) : (
        <ScrollRow>
          {items.map((i) => (
            <Card key={i.kind + i.id} i={i} t={t} locale={locale} saved={saved} />
          ))}
        </ScrollRow>
      )}
    </section>
  );
}
