import Link from "next/link";
import { Check } from "lucide-react";
import { prisma } from "@/server/db";
import { getSetting } from "@/server/settings";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { formatMoney } from "@/lib/money";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Plans & pricing for businesses"), alternates: alternates("/business/pricing") };
}

const CAT_LABEL: Record<string, string> = {
  WORKSHOPS: "Workshops & Classes",
  CAMPS: "Camps",
  SHOWS: "Shows & Entertainment",
  BIRTHDAYS: "Birthday Bookings",
  FAMILY_EXPERIENCES: "Family Experiences",
  RETAIL: "Retail Sales",
};

export default async function PricingPage() {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const [plans, rates, placements, trialOn, trialDays] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { monthlyCents: "asc" } }),
    prisma.commissionRate.findMany(),
    prisma.adPlacement.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    getSetting("trial.enabled"),
    getSetting("trial.days"),
  ]);
  const rate = (c: string, p: string) => (rates.find((r) => r.category === c && r.plan === p)?.rateBps ?? 0) / 100;
  return (
    <div className="container-x py-10 sm:py-16">
      <h1 className="text-center text-3xl font-extrabold tracking-tight sm:text-5xl">{t("Simple plans. Pay as you grow.")}</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-ink-muted">{t("Listing is free. Upgrade for lower commissions and growth tools.")}</p>
      {trialOn && <p className="mx-auto mt-4 w-fit rounded-full bg-mint-soft px-4 py-2 text-sm font-semibold text-mint-deep">{t("Launch offer: {n}-day free trial of paid plans for early partners", { n: trialDays })}</p>}
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.code} className={`rounded-4xl border p-7 ${p.code === "PRO" ? "border-ink bg-ink text-white" : "border-ink/10 bg-white"}`}>
            <p className="text-lg font-bold">{p.name}</p>
            <p className="mt-3">
              <span className="text-4xl font-extrabold">{p.monthlyCents ? formatMoney(p.monthlyCents, locale) : t("Free")}</span>
              {p.monthlyCents > 0 && <span className="text-sm opacity-70"> {t("/month")}</span>}
            </p>
            {p.yearlyCents > 0 && <p className="mt-1 text-xs opacity-70">{t("or {price}/year", { price: formatMoney(p.yearlyCents, locale) })}</p>}
            <ul className="mt-6 space-y-2.5 text-sm">
              {(p.features as Record<string, string>[]).map((f, i) => (
                <li key={i} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  {loc(f, locale)}
                </li>
              ))}
            </ul>
            <Link href="/business/join" className={`mt-7 w-full ${p.code === "PRO" ? "btn bg-white text-ink" : "btn-primary"}`}>
              {t("Get started")}
            </Link>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-2xl font-bold">{t("Booking commissions")}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t("Charged only on bookings EVNT generates. 0% on customers you bring with your own EVNT link.")}</p>
      <div className="mt-4 overflow-x-auto rounded-3xl border border-ink/10">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-canvas text-start">
            <tr>
              <th className="p-4 text-start">{t("Category")}</th>
              {plans.map((p) => (
                <th key={p.code} className="p-4 text-start">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(CAT_LABEL).map(([k, v]) => (
              <tr key={k} className="border-t border-ink/[.06]">
                <td className="p-4">{t(v)}</td>
                {plans.map((p) => (
                  <td key={p.code} className="p-4 font-semibold">
                    {rate(k, p.code)}%
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-ink/[.06]">
              <td className="p-4">{t("Restaurant reservations (per verified guest)")}</td>
              {plans.map((p) => (
                <td key={p.code} className="p-4 font-semibold">
                  {formatMoney(p.restaurantGuestFeeCents, locale)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted">{t("Verified EVNT-generated bookings completed directly with you within 72 hours of a contact click are charged at 50% of the rate.")}</p>

      <h2 className="mt-16 text-2xl font-bold">{t("Advertising & paid services")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {placements.map((p) => (
          <div key={p.code} className="card p-5">
            <p className="font-semibold">{loc(p.name, locale)}</p>
            <p className="mt-1 text-sm text-ink-muted">{loc(p.description, locale)}</p>
            <p className="mt-3 font-bold">
              {p.unit === "PERCENT_SALES" ? t("{n}% of generated sales", { n: p.priceCents / 100 }) : `${formatMoney(p.priceCents, locale)} ${p.unit === "WEEK" ? t("/week") : p.unit === "MONTH" ? t("/month") : p.unit === "CAMPAIGN" ? t("/campaign") : ""}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
