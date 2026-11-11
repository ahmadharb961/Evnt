import Link from "next/link";
import { Palette, Tent, PartyPopper, Trees, Drama, UtensilsCrossed, ShoppingBag, Sparkles } from "lucide-react";

const STYLE: Record<string, { icon: React.ElementType; bg: string; fg: string }> = {
  "activities-workshops": { icon: Palette, bg: "bg-mint-soft", fg: "text-mint-deep" },
  "camps-after-school": { icon: Tent, bg: "bg-powder-soft", fg: "text-powder-deep" },
  "birthdays-parties": { icon: PartyPopper, bg: "bg-blush-soft", fg: "text-blush-deep" },
  "family-experiences": { icon: Trees, bg: "bg-peach-soft", fg: "text-peach-deep" },
  "shows-entertainment": { icon: Drama, bg: "bg-powder-soft", fg: "text-powder-deep" },
  "restaurants-cafes": { icon: UtensilsCrossed, bg: "bg-mint-soft", fg: "text-mint-deep" },
  shop: { icon: ShoppingBag, bg: "bg-blush-soft", fg: "text-blush-deep" },
};

/** Where a primary category lives. */
export function categoryHref(slug: string) {
  if (slug === "restaurants-cafes") return "/restaurants";
  if (slug === "shop") return "/shop";
  if (slug === "birthdays-parties") return "/birthdays";
  return `/c/${slug}`;
}

export function CategoryTiles({ items }: { items: { slug: string; name: string; image: string | null }[] }) {
  return (
    <div className="scroll-row lg:grid lg:grid-cols-7 lg:overflow-visible">
      {items.map((c) => {
        const s = STYLE[c.slug] ?? { icon: Sparkles, bg: "bg-powder-soft", fg: "text-powder-deep" };
        const Icon = s.icon;
        return (
          <Link key={c.slug} href={categoryHref(c.slug)} className="group w-[30vw] max-w-[150px] shrink-0 snap-start lg:w-auto lg:max-w-none">
            <div className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl ${s.bg} transition group-hover:shadow-card`}>
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <Icon className={`h-9 w-9 ${s.fg} transition group-hover:scale-110`} strokeWidth={1.6} />
              )}
            </div>
            <p className="mt-2 text-center text-[13px] font-semibold leading-tight">{c.name}</p>
          </Link>
        );
      })}
    </div>
  );
}
