import Link from "next/link";
import { BadgeCheck, ShieldCheck, Sparkles, Users, Baby, Eye } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { favoriteIds } from "@/server/home";
import { searchEvents, searchRestaurants } from "@/server/listings";
import { prisma } from "@/server/db";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { SectionRow } from "@/components/home/section-row";
import { areaName } from "@/lib/areas";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Farah Approved — certified family-friendly venues"), description: t("Venues independently assessed by EVNT for safety, cleanliness, staff and family comfort."), alternates: alternates("/farah-approved") };
}

export default async function FarahPage() {
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const now = new Date();
  const [merchants, events, restaurants, saved] = await Promise.all([
    prisma.merchant.findMany({ where: { status: "APPROVED", farahUntil: { gt: now } }, include: { locations: { take: 1 } }, orderBy: { name: "asc" } }),
    searchEvents({ farah: true, limit: 12 }, locale),
    searchRestaurants({ farah: true, limit: 12 }, locale),
    favoriteIds(user?.id),
  ]);
  const pillars = [
    { icon: ShieldCheck, title: t("Safety"), body: t("Safe spaces, exits, first aid and supervision.") },
    { icon: Sparkles, title: t("Cleanliness"), body: t("Clean toilets, changing tables and play areas.") },
    { icon: Users, title: t("Welcoming staff"), body: t("Teams that genuinely welcome children and parents.") },
    { icon: Baby, title: t("Family comfort"), body: t("Stroller access, seating, kid-friendly food and environment.") },
    { icon: Eye, title: t("Transparency"), body: t("Clear prices, ages and rules — no surprises.") },
  ];
  return (
    <div>
      <section className="bg-gradient-to-br from-mint to-mint-soft">
        <div className="container-x py-14 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-mint-deep">
            <BadgeCheck className="h-4 w-4" />
            {t("Farah Approved")}
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">{t("Places that truly welcome families")}</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-soft">{t("Every Farah Approved venue passed an independent, in-person assessment against a structured checklist. Certification can't be bought: businesses pay for the assessment, not the result.")}</p>
        </div>
      </section>
      <section className="container-x mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {pillars.map((p) => (
          <div key={p.title} className="card p-5">
            <p.icon className="h-6 w-6 text-mint-deep" />
            <p className="mt-3 font-semibold">{p.title}</p>
            <p className="mt-1 text-sm text-ink-muted">{p.body}</p>
          </div>
        ))}
      </section>
      <SectionRow title={t("Certified restaurants & cafés")} items={restaurants.items} t={t} locale={locale} saved={saved} />
      <SectionRow title={t("Activities at certified venues")} items={events.items} t={t} locale={locale} saved={saved} />
      {merchants.length > 0 && (
        <section className="container-x mt-12">
          <h2 className="h-section mb-4">{t("All certified venues")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {merchants.map((m) => (
              <Link key={m.id} href={`/m/${m.slug}`} className="card flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaSrc(m.logoId ?? m.coverId)} alt="" className="h-12 w-12 rounded-xl object-cover" />
                <span>
                  <span className="block font-semibold">{m.name}</span>
                  <span className="text-xs text-ink-muted">{areaName(m.locations[0]?.area, locale)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="container-x mt-14 rounded-4xl bg-canvas p-8">
        <h2 className="text-xl font-bold">{t("Own a family venue?")}</h2>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">{t("Apply for an assessment from your EVNT business dashboard. Sponsored content is always labelled and never affects assessment results.")}</p>
        <Link href="/merchant/certification" className="btn-primary mt-4">
          {t("Apply for Farah Approved")}
        </Link>
      </section>
    </div>
  );
}
