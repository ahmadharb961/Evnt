import Link from "next/link";
import { BadgeCheck, Crown } from "lucide-react";
import { Hero } from "@/components/home/hero";
import { CategoryTiles } from "@/components/home/category-tiles";
import { SectionRow } from "@/components/home/section-row";
import { activeSections, favoriteIds, resolveSection } from "@/server/home";
import { recommendedEvents } from "@/server/recommend";
import { getSetting } from "@/server/settings";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { alternates } from "@/server/urls";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return {
    title: { absolute: t("EVNT — Things to do with kids in Lebanon") },
    description: t("Discover, book and enjoy the best kids' activities, birthdays, family restaurants and shopping in Lebanon."),
    alternates: alternates("/"),
  };
}

export default async function HomePage() {
  const [locale, t, user, hero] = await Promise.all([getLocale(), getT(), getCurrentUser(), getSetting("hero")]);
  const [cats, sections, saved, forYou] = await Promise.all([
    prisma.category.findMany({ where: { parentId: null, active: true }, orderBy: { sort: "asc" } }),
    activeSections(),
    favoriteIds(user?.id),
    user ? recommendedEvents(user.id, locale, 12) : Promise.resolve([]),
  ]);
  const resolved = await Promise.all(sections.map((s) => resolveSection(s, locale)));

  return (
    <>
      <Hero
        videoSrc={hero.videoId ? `/media/${hero.videoId}` : hero.videoUrl || null}
        poster={hero.posterUrl || "/brand/hero-poster.svg"}
        headline={loc(hero.headline, locale)}
        subline={loc(hero.subline, locale)}
        ctaText={loc(hero.ctaText, locale)}
        ctaHref={hero.ctaHref || "/discover"}
      />

      <section className="container-x mt-10">
        <CategoryTiles items={cats.map((c) => ({ slug: c.slug, name: loc(c.name, locale), image: c.imageId ? mediaSrc(c.imageId) : c.imageUrl }))} />
      </section>

      {forYou.length > 0 && (
        <SectionRow title={t("Picked for your family")} subtitle={t("Based on your kids' ages, interests and favorites")} items={forYou} t={t} locale={locale} saved={saved} href="/account/family" ctaText={t("Edit preferences")} />
      )}

      {resolved.map((s) => (
        <SectionRow key={s.id} title={s.title} subtitle={s.subtitle} href={s.ctaHref} ctaText={s.ctaText} items={s.items} layout={s.layout} banner={s.bannerUrl} t={t} locale={locale} saved={saved} />
      ))}

      <section className="container-x mt-16 grid gap-4 md:grid-cols-2">
        <Link href="/plus" className="group relative overflow-hidden rounded-4xl bg-gradient-to-br from-powder to-blush p-7 sm:p-9">
          <Crown className="h-7 w-7" />
          <h3 className="mt-4 text-2xl font-bold">EVNT+</h3>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">{t("No booking fees, double points, 48-hour early access and members-only playdates.")}</p>
          <span className="btn-primary mt-5">{t("Discover EVNT+")}</span>
        </Link>
        <Link href="/farah-approved" className="group relative overflow-hidden rounded-4xl bg-gradient-to-br from-mint to-peach-soft p-7 sm:p-9">
          <BadgeCheck className="h-7 w-7" />
          <h3 className="mt-4 text-2xl font-bold">{t("Farah Approved")}</h3>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">{t("Venues independently assessed for safety, cleanliness and family comfort.")}</p>
          <span className="btn-primary mt-5">{t("See certified places")}</span>
        </Link>
      </section>
    </>
  );
}
