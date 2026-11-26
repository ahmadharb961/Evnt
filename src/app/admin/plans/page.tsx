import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { savePlanAction, savePlacementAction, saveRatesAction } from "@/actions/admin";
import { NumberTile } from "@/components/admin/settings-ui";
import { TONES } from "@/lib/tones";
import { PLAN } from "@/lib/status";

export const metadata = { title: "Plans & pricing" };
const CATS = ["WORKSHOPS", "CAMPS", "SHOWS", "BIRTHDAYS", "FAMILY_EXPERIENCES"] as const;
const PLANS = ["BASIC", "PRO", "FEATURED"] as const;
const CAT_LABEL: Record<(typeof CATS)[number], string> = { WORKSHOPS: "Workshops", CAMPS: "Camps", SHOWS: "Shows", BIRTHDAYS: "Birthdays", FAMILY_EXPERIENCES: "Family experiences" };

export default async function PlansAdmin() {
  await requireAdmin("FINANCE", "ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const [plans, rates, placements] = await Promise.all([prisma.subscriptionPlan.findMany({ orderBy: { monthlyCents: "asc" } }), prisma.commissionRate.findMany(), prisma.adPlacement.findMany({ where: { code: { not: "FARAH_REEL" } }, orderBy: { sort: "asc" } })]);
  const rate = (c: string, p: string) => (rates.find((r) => r.category === c && r.plan === p)?.rateBps ?? 0) / 100;
  const flags = [
    ["bookingManagement", t("Booking management")],
    ["advancedAnalytics", t("Advanced analytics")],
    ["demandIntelligence", t("Demand intelligence")],
    ["priorityPlacement", t("Priority placement eligibility")],
    ["sponsoredRoundups", t("Sponsored roundup eligibility")],
  ] as const;
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("Plans & pricing")} subtitle={t("Every price here applies immediately, without a deployment. Changes are recorded in the audit log.")} />
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p, i) => {
          const c = TONES[(["slate", "sky", "violet"] as const)[i % 3]];
          return (
            <section key={p.code} className={`rounded-[2rem] p-4 ${c.soft}`}>
              <div className="mb-4 flex items-center justify-between px-1">
                <h2 className="text-2xl font-extrabold tracking-tight">{p.name}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${c.tile} ${c.text}`}>{p.monthlyCents ? t("Paid plan") : t("Free plan")}</span>
              </div>
              <ActionForm action={savePlanAction.bind(null, p.code)} submit={t("Save {plan}", { plan: p.name })} submitClass="btn-primary w-full" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumberTile name="monthly" label={t("Per month")} help="" money defaultValue={p.monthlyCents / 100} accent={c.deep} compact />
                  <NumberTile name="yearly" label={t("Per year")} help="" money defaultValue={p.yearlyCents / 100} accent={c.deep} compact />
                  <NumberTile name="guestFee" label={t("Restaurant fee / guest")} help="" money defaultValue={p.restaurantGuestFeeCents / 100} accent={c.deep} compact />
                  <NumberTile name="flash" label={t("Flash promos / month")} help="" defaultValue={p.flashPromosPerMonth} accent={c.deep} compact />
                </div>
                <div className="rounded-[1.5rem] bg-white p-4 shadow-card">
                  <p className="mb-2 text-sm font-bold">{t("Included features")}</p>
                  <div className="flex flex-wrap gap-2">
                    {flags.map(([k, l]) => (
                      <label key={k} className="cursor-pointer rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-muted ring-1 ring-ink/[.06] transition has-[:checked]:bg-ink has-[:checked]:text-white">
                        <input type="checkbox" name={k} defaultChecked={p[k]} className="sr-only" />
                        {l}
                      </label>
                    ))}
                  </div>
                </div>
              </ActionForm>
            </section>
          );
        })}
      </div>
      <Panel title={t("Booking commission matrix (%)")} subtitle={t("EVNT's share of each booking, by category and plan")} icon="Scale" tone="sky">
        <ActionForm action={saveRatesAction} submit={t("Save rates")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-xs text-ink-muted">
                  <th className="pb-2 text-start">{t("Category")}</th>
                  {PLANS.map((p) => (
                    <th key={p} className="pb-2 text-start">
                      {t(PLAN[p].label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATS.map((c) => (
                  <tr key={c} className="border-t border-ink/[.06]">
                    <td className="py-2 font-semibold">{t(CAT_LABEL[c])}</td>
                    {PLANS.map((p) => (
                      <td key={p} className="py-2 pe-2">
                        <span className="flex w-28 items-center rounded-2xl bg-canvas pe-3 ring-1 ring-ink/[.06] focus-within:ring-2 focus-within:ring-ink/30">
                          <input name={`${c}_${p}`} defaultValue={rate(c, p)} inputMode="decimal" className="w-full min-w-0 bg-transparent px-3 py-2 text-xl font-extrabold outline-none" />
                          <span className="text-sm font-bold text-ink-muted">%</span>
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
      </Panel>
      <Panel title={t("Advertising & paid services")} icon="Megaphone" tone="peach">
        <div className="grid gap-3 md:grid-cols-2">
          {placements.map((p) => (
            <div key={p.code} className="rounded-2xl border border-ink/[.06] p-4">
              <p className="mb-2 font-semibold">{loc(p.name, locale)}</p>
              <ActionForm action={savePlacementAction.bind(null, p.code)} submit={t("Save")} submitClass="btn-outline btn-sm" className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="label text-xs">{p.unit === "PERCENT_SALES" ? "%" : `USD / ${p.unit.toLowerCase()}`}</span>
                  <input name="price" defaultValue={p.priceCents / 100} className="input !w-28 !py-1.5 !text-xl !font-extrabold" />
                </label>
                <label className="block">
                  <span className="label text-xs">{t("Slots")}</span>
                  <input name="slots" type="number" defaultValue={p.slots} className="input !w-24 !py-1.5 !text-xl !font-extrabold" />
                </label>
                <label className="flex items-center gap-1.5 pb-2 text-xs">
                  <input type="checkbox" name="active" defaultChecked={p.active} className="accent-ink" />
                  {t("Active")}
                </label>
              </ActionForm>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
