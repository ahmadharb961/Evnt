import Link from "next/link";
import { Puzzle, Baby, Shirt, Palette, Gift, ShoppingBag, ArrowRight } from "lucide-react";
import type { T } from "@/i18n/core";

const STYLE: Record<string, { icon: React.ElementType; bg: string; badge: string; fg: string }> = {
  "toys-games": { icon: Puzzle, bg: "from-[#d9f2e6] to-[#bfe8d4]", badge: "bg-white", fg: "text-[#1f7a52]" },
  "baby-essentials": { icon: Baby, bg: "from-[#ffe9da] to-[#ffd3b5]", badge: "bg-white", fg: "text-[#b25a1f]" },
  "kids-fashion": { icon: Shirt, bg: "from-[#e3e9f7] to-[#cad6f0]", badge: "bg-white", fg: "text-[#3d5384]" },
  "learning-creativity": { icon: Palette, bg: "from-[#fbe3f1] to-[#f5c9e3]", badge: "bg-white", fg: "text-[#9a3f78]" },
  "gifts-party": { icon: Gift, bg: "from-[#fff1c7] to-[#ffe08f]", badge: "bg-white", fg: "text-[#a06a00]" },
};
const FALLBACK = { icon: ShoppingBag, bg: "from-[#eeeae4] to-[#ddd6cc]", badge: "bg-white", fg: "text-ink" };

/** Shop categories as colourful cards with a big icon, product count and a product photo. */
export function ShopCategories({ items, t }: { items: { slug: string; name: string; count: number; image: string | null }[]; t: T }) {
  return (
    <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-5">
      {items.map((c) => {
        const s = STYLE[c.slug] ?? FALLBACK;
        const Icon = s.icon;
        return (
          <Link
            key={c.slug}
            href={`/shop/c/${c.slug}`}
            className={`group relative isolate flex h-44 w-[44vw] max-w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-[1.75rem] bg-gradient-to-br p-4 shadow-card ring-1 ring-black/[.03] transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:h-52 sm:w-auto sm:max-w-none ${s.bg}`}
          >
            <span aria-hidden className="absolute -end-10 -top-10 -z-10 h-32 w-32 rounded-full bg-white/35" />
            <span aria-hidden className="absolute -bottom-12 -start-8 -z-10 h-28 w-28 rounded-full bg-white/25" />
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-card ${s.badge} ${s.fg}`}>
              <Icon className="h-7 w-7" strokeWidth={2} />
            </span>
            <span className="mt-auto">
              <span className="block text-base font-extrabold leading-tight sm:text-lg">{c.name}</span>
              <span className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${s.fg}`}>
                {c.count === 1 ? t("1 product") : c.count ? t("{n} products", { n: c.count }) : t("Shop now")}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </span>
            </span>
            <Icon aria-hidden className={`absolute -bottom-5 -end-4 -z-10 h-28 w-28 opacity-[.13] transition duration-500 group-hover:rotate-[-8deg] group-hover:scale-110 sm:h-32 sm:w-32 ${s.fg}`} strokeWidth={1.5} />
          </Link>
        );
      })}
    </div>
  );
}
