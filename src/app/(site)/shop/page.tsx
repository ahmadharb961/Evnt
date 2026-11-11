import Link from "next/link";
import { Puzzle, Baby, Shirt, Palette, Gift } from "lucide-react";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { ShopGrid, parseShopParams } from "@/components/shop-grid";
import { CategorySponsor } from "@/components/category-sponsor";
import { alternates } from "@/server/urls";
import type { SP } from "@/lib/filters";

const ICON: Record<string, React.ElementType> = { "toys-games": Puzzle, "baby-essentials": Baby, "kids-fashion": Shirt, "learning-creativity": Palette, "gifts-party": Gift };
const BG = ["bg-mint-soft", "bg-peach-soft", "bg-powder-soft", "bg-blush-soft", "bg-mint-soft"];

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Shop for kids"), description: t("Toys, baby essentials, kids' fashion and party supplies from Lebanese shops. Cash on delivery available."), alternates: alternates("/shop") };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const root = await prisma.category.findUnique({ where: { slug: "shop" }, include: { children: { where: { active: true }, orderBy: { sort: "asc" } } } });
  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Shop for kids")}</h1>
      <p className="mt-2 text-ink-muted">{t("From Lebanese shops, delivered to your door. Cash on delivery available.")}</p>
      <div className="mt-6 grid grid-cols-5 gap-2 sm:gap-4">
        {root?.children.map((c, i) => {
          const Icon = ICON[c.slug] ?? Gift;
          return (
            <Link key={c.id} href={`/shop/c/${c.slug}`} className="group text-center">
              <span className={`flex aspect-square items-center justify-center rounded-3xl ${BG[i % BG.length]} transition group-hover:shadow-card`}>
                <Icon className="h-7 w-7 sm:h-9 sm:w-9" strokeWidth={1.6} />
              </span>
              <span className="mt-2 block text-[11px] font-semibold leading-tight sm:text-sm">{loc(c.name, locale)}</span>
            </Link>
          );
        })}
      </div>
      {root && <CategorySponsor categoryId={root.id} t={t} />}
      <div className="mt-8">
        <ShopGrid filters={parseShopParams(sp)} sp={sp} basePath="/shop" />
      </div>
    </div>
  );
}
