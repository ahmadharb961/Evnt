import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { savePlanAction, savePlacementAction, saveRatesAction } from "@/actions/admin";

export const metadata = { title: "Plans & pricing" };
const CATS = ["WORKSHOPS", "CAMPS", "SHOWS", "BIRTHDAYS", "FAMILY_EXPERIENCES", "RETAIL"] as const;
const PLANS = ["BASIC", "PRO", "FEATURED"] as const;

export default async function PlansAdmin() {
  await requireAdmin("FINANCE", "ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const [plans, rates, placements] = await Promise.all([prisma.subscriptionPlan.findMany({ orderBy: { monthlyCents: "asc" } }), prisma.commissionRate.findMany(), prisma.adPlacement.findMany({ orderBy: { sort: "asc" } })]);
  const rate = (c: string, p: string) => (rates.find((r) => r.category === c && r.plan === p)?.rateBps ?? 0) / 100;
  const flags = [
    ["bookingManagement", t("Booking management")],
    ["advancedAnalytics", t("Advanced analytics")],
    ["birthdayRadar", t("Birthday Radar")],
    ["demandIntelligence", t("Demand intelligence")],
    ["priorityPlacement", t("Priority placement eligibility")],
    ["sponsoredRoundups", t("Sponsored roundup eligibility")],
  ] as const;
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("Plans & pricing")} subtitle={t("Every price here applies immediately, without a deployment. Changes are recorded in the audit log.")} />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <Panel key={p.code} title={p.name}>
            <ActionForm action={savePlanAction.bind(null, p.code)} submit={t("Save {plan}", { plan: p.name })} submitClass="btn-primary btn-sm">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">{t("Monthly (USD)")}</span>
                  <input name="monthly" defaultValue={p.monthlyCents / 100} className="input !py-2" />
                </label>
                <label className="block">
                  <span className="label">{t("Yearly (USD)")}</span>
                  <input name="yearly" defaultValue={p.yearlyCents / 100} className="input !py-2" />
                </label>
                <label className="block">
                  <span className="label">{t("Restaurant fee / guest")}</span>
                  <input name="guestFee" defaultValue={p.restaurantGuestFeeCents / 100} className="input !py-2" />
                </label>
                <label className="block">
                  <span className="label">{t("Flash promos / month")}</span>
                  <input name="flash" type="number" defaultValue={p.flashPromosPerMonth} className="input !py-2" />
                </label>
              </div>
              <div className="space-y-1.5">
                {flags.map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={k} defaultChecked={p[k]} className="accent-ink" />
                    {l}
                  </label>
                ))}
              </div>
            </ActionForm>
          </Panel>
        ))}
      </div>
      <Panel title={t("Booking commission matrix (%)")}>
        <ActionForm action={saveRatesAction} submit={t("Save rates")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-xs text-ink-muted">
                  <th className="pb-2 text-start">{t("Category")}</th>
                  {PLANS.map((p) => (
                    <th key={p} className="pb-2 text-start">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATS.map((c) => (
                  <tr key={c} className="border-t border-ink/[.06]">
                    <td className="py-2">{c}</td>
                    {PLANS.map((p) => (
                      <td key={p} className="py-2 pe-2">
                        <input name={`${c}_${p}`} defaultValue={rate(c, p)} inputMode="decimal" className="input !w-24 !py-1.5" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
      </Panel>
      <Panel title={t("Advertising & paid services")}>
        <div className="grid gap-3 md:grid-cols-2">
          {placements.map((p) => (
            <div key={p.code} className="rounded-2xl border border-ink/[.06] p-4">
              <p className="mb-2 font-semibold">{loc(p.name, locale)}</p>
              <ActionForm action={savePlacementAction.bind(null, p.code)} submit={t("Save")} submitClass="btn-outline btn-sm" className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="label text-xs">{p.unit === "PERCENT_SALES" ? "%" : `USD / ${p.unit.toLowerCase()}`}</span>
                  <input name="price" defaultValue={p.priceCents / 100} className="input !w-24 !py-1.5" />
                </label>
                <label className="block">
                  <span className="label text-xs">{t("Slots")}</span>
                  <input name="slots" type="number" defaultValue={p.slots} className="input !w-20 !py-1.5" />
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
