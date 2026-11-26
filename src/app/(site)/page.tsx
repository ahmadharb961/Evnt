import { Hero } from "@/components/home/hero";
import { CategoryTiles } from "@/components/home/category-tiles";
import { SectionRow } from "@/components/home/section-row";
import { Spotlight } from "@/components/home/spotlight";
import { countImpressions, favoriteIds, homeContent } from "@/server/home";
import { after } from "next/server";
import { recommendedEvents } from "@/server/recommend";
import { getSetting } from "@/server/settings";
import { getCurrentUser } from "@/server/auth";
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
  const [{ cats, sections: resolved }, saved, forYou] = await Promise.all([
    homeContent(locale),
    favoriteIds(user?.id),
    user ? recommendedEvents(user.id, locale, 12) : Promise.resolve([]),
  ]);
  after(() => countImpressions(resolved.flatMap((s) => s.campaignIds)).catch(() => {}));

  return (
    <>
      <Hero
        videoSrc={hero.mode === "IMAGE" ? null : hero.videoId ? `/media/${hero.videoId}` : hero.videoUrl || null}
        poster={hero.mode === "IMAGE" ? hero.photoUrl || "/brand/family.webp" : hero.posterUrl || "/brand/hero-poster.jpg"}
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

      {resolved.map((s) =>
        s.layout === "SPOTLIGHT" ? (
          <Spotlight key={s.id} title={s.title} subtitle={s.subtitle} href={s.ctaHref} ctaText={s.ctaText} items={s.items} t={t} locale={locale} saved={saved} />
        ) : (
        <SectionRow key={s.id} title={s.title} subtitle={s.subtitle} href={s.ctaHref} ctaText={s.ctaText} items={s.items} stores={s.stores} layout={s.layout} banner={s.bannerUrl} t={t} locale={locale} saved={saved} />
        ),
      )}

    </>
  );
}
