import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { favoriteIds } from "@/server/home";
import { searchEvents, searchRestaurants } from "@/server/listings";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { SectionRow } from "@/components/home/section-row";
import { SubcategoryChips } from "@/components/category-header";
import { ActionForm } from "@/components/portal/action-form";
import { createInquiryAction } from "@/actions/birthdays";
import { SERVICES } from "@/server/birthdays";
import { AREAS } from "@/lib/areas";
import { ymdString } from "@/lib/dates";
import { alternates } from "@/server/urls";
import { SERVICE_LABEL } from "@/lib/birthday";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Kids' birthday parties in Lebanon"), description: t("Birthday venues, entertainers, cakes, decorations and party packages. Get quotes from several businesses in one request."), alternates: alternates("/birthdays") };
}


export default async function BirthdaysPage() {
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const cat = await prisma.category.findUnique({ where: { slug: "birthdays-parties" }, include: { children: { where: { active: true }, orderBy: { sort: "asc" } } } });
  const [packages, venues, saved, mine] = await Promise.all([
    searchEvents({ categorySlug: "birthdays-parties", limit: 12 }, locale),
    searchRestaurants({ facilities: ["birthdaySuitable"], limit: 12 }, locale),
    favoriteIds(user?.id),
    user ? prisma.birthdayInquiry.findMany({ where: { userId: user.id, status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 3 }) : Promise.resolve([]),
  ]);
  return (
    <>
      <section className="bg-gradient-to-b from-blush-soft to-white">
        <div className="container-x grid gap-10 py-10 sm:py-16 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_440px]">
          <div>
            <PartyPopper className="h-9 w-9 text-blush-deep" />
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">{t("Plan a birthday they'll never forget")}</h1>
            <p className="mt-4 max-w-lg text-lg text-ink-soft">{t("Tell us about the party once. We'll match you with venues, entertainers, cakes and more — and you can ask several for quotes.")}</p>
            {cat && <SubcategoryChips items={cat.children.map((c) => ({ slug: c.slug, name: loc(c.name, locale), href: `/c/${c.slug}` }))} />}
            {mine.length > 0 && (
              <div className="mt-8 space-y-2">
                <p className="text-sm font-semibold">{t("Your birthday plans")}</p>
                {mine.map((i) => (
                  <Link key={i.id} href={`/birthdays/plan/${i.id}`} className="block rounded-2xl bg-white p-3 text-sm shadow-card">
                    {t("Party for a {n}-year-old · {guests} guests", { n: i.childAge, guests: i.guests })} →
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-bold">{t("Get matched & request quotes")}</h2>
            {user ? (
              <ActionForm action={createInquiryAction} submit={t("Find businesses")} submitClass="btn-primary w-full h-12">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="label">{t("Child's age")}</span>
                    <input name="childAge" type="number" min={0} max={16} required className="input" />
                  </label>
                  <label className="block">
                    <span className="label">{t("Party date")}</span>
                    <input name="date" type="date" min={ymdString(new Date())} required className="input" />
                  </label>
                  <label className="block">
                    <span className="label">{t("Guests")}</span>
                    <input name="guests" type="number" min={1} max={500} defaultValue={15} required className="input" />
                  </label>
                  <label className="block">
                    <span className="label">{t("Budget (USD)")}</span>
                    <input name="budget" inputMode="decimal" defaultValue="300" required className="input" />
                  </label>
                </div>
                <label className="block">
                  <span className="label">{t("Area")}</span>
                  <select name="area" required defaultValue="" className="input">
                    <option value="" disabled>
                      {t("Choose…")}
                    </option>
                    {AREAS.map((a) => (
                      <option key={a.slug} value={a.slug}>
                        {a[locale]}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <span className="label">{t("What do you need?")}</span>
                  <div className="flex flex-wrap gap-2">
                    {SERVICES.map((s) => (
                      <label key={s} className="chip cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                        <input type="checkbox" name="services" value={s} className="sr-only" />
                        {t(SERVICE_LABEL[s])}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="label">{t("Mobile number")}</span>
                  <input name="phone" type="tel" defaultValue={user.phone ? `+${user.phone}` : ""} required className="input" />
                </label>
                <label className="block">
                  <span className="label">{t("Anything else? (theme, timing…)")}</span>
                  <textarea name="notes" rows={2} maxLength={600} className="input" />
                </label>
                <label className="flex items-start gap-2 text-xs text-ink-muted">
                  <input type="checkbox" name="consent" className="mt-0.5 accent-ink" />
                  {t("I agree that EVNT shares these party details and my phone number with businesses I request quotes from, and with up to 3 verified partners. We never ask for or share your child's name.")}
                </label>
              </ActionForm>
            ) : (
              <Link href="/login?next=/birthdays" className="btn-primary h-12 w-full">
                {t("Sign in to start planning")}
              </Link>
            )}
          </div>
        </div>
      </section>
      <SectionRow title={t("Party packages")} items={packages.items} t={t} locale={locale} saved={saved} href="/c/birthdays-parties" />
      <SectionRow title={t("Birthday-friendly restaurants")} items={venues.items} t={t} locale={locale} saved={saved} href="/restaurants?f=birthdaySuitable" />
    </>
  );
}
