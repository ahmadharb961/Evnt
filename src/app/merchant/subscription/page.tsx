import { Check } from "lucide-react";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { activeSubscription, trialAvailable } from "@/server/billing";
import { getSetting } from "@/server/settings";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { changePlanAction } from "@/actions/merchant-growth";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Plan" };

export default async function SubscriptionPage() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const [plans, sub, pending, history, trial, trialDays] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { monthlyCents: "asc" } }),
    activeSubscription(ctx.merchant.id),
    prisma.merchantSubscription.findFirst({ where: { merchantId: ctx.merchant.id, status: "PENDING_PAYMENT" } }),
    prisma.merchantSubscription.findMany({ where: { merchantId: ctx.merchant.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    trialAvailable(ctx.merchant.id),
    getSetting("trial.days"),
  ]);
  const owner = ctx.staffRole === "OWNER";
  const statusLabel: Record<string, string> = { TRIALING: t("Free trial"), ACTIVE: t("Active"), PENDING_PAYMENT: t("Awaiting payment"), GRACE: t("Payment overdue (grace period)"), PAST_DUE: t("Past due"), CANCELED: t("Ended"), EXPIRED: t("Expired") };
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("Plan")} />
      {sub && (
        <Panel>
          <p className="text-lg font-bold">
            {plans.find((p) => p.code === sub.plan)?.name} · {statusLabel[sub.status]}
          </p>
          {sub.plan !== "BASIC" && (
            <p className="mt-1 text-sm text-ink-muted">
              {sub.cancelAtPeriodEnd ? t("Moves to Basic on {date}", { date: fmtDate(sub.currentPeriodEnd, locale, { day: "numeric", month: "long" }) }) : t("Current period ends {date}", { date: fmtDate(sub.currentPeriodEnd, locale, { day: "numeric", month: "long" }) })}
            </p>
          )}
          {pending && <p className="mt-2 rounded-2xl bg-peach-soft p-3 text-sm text-peach-deep">{t("A plan change is waiting for its invoice to be paid (see Billing).")}</p>}
        </Panel>
      )}
      {trial && <p className="rounded-3xl bg-mint-soft p-4 text-sm font-medium text-mint-deep">{t("Launch offer: upgrading now starts a free {n}-day trial.", { n: trialDays })}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const current = sub?.plan === p.code;
          return (
            <div key={p.code} className={`rounded-4xl border bg-white p-6 ${current ? "border-ink ring-2 ring-ink" : "border-ink/10"}`}>
              <p className="text-lg font-bold">{p.name}</p>
              <p className="mt-2 text-3xl font-extrabold">
                {p.monthlyCents ? formatMoney(p.monthlyCents, locale) : t("Free")}
                {p.monthlyCents > 0 && <span className="text-sm font-medium text-ink-muted">{t("/month")}</span>}
              </p>
              {p.yearlyCents > 0 && <p className="text-xs text-ink-muted">{t("or {price}/year", { price: formatMoney(p.yearlyCents, locale) })}</p>}
              <ul className="mt-5 space-y-2 text-sm">
                {(p.features as Record<string, string>[]).map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    {loc(f, locale)}
                  </li>
                ))}
              </ul>
              {owner && !current && (
                <div className="mt-6 flex flex-col gap-2">
                  {p.code === "BASIC" ? (
                    <ActionButton action={changePlanAction.bind(null, "BASIC", "MONTHLY")} className="btn-outline w-full" confirm={t("Move to Basic? Paid features stop at the end of your paid period.")}>
                      {t("Switch to Basic")}
                    </ActionButton>
                  ) : (
                    <>
                      <ActionButton action={changePlanAction.bind(null, p.code, "MONTHLY")} className="btn-primary w-full">
                        {trial ? t("Start free trial") : t("Choose monthly")}
                      </ActionButton>
                      {!trial && (
                        <ActionButton action={changePlanAction.bind(null, p.code, "YEARLY")} className="btn-outline w-full">
                          {t("Choose yearly")}
                        </ActionButton>
                      )}
                    </>
                  )}
                </div>
              )}
              {current && <p className="mt-6 text-center text-sm font-semibold">{t("Your current plan")}</p>}
            </div>
          );
        })}
      </div>
      <Panel title={t("Subscription history")}>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between py-2">
              <span>
                {plans.find((p) => p.code === h.plan)?.name} · {h.interval === "YEARLY" ? t("Yearly") : t("Monthly")}
                {h.adminOverride ? ` · ${t("set by EVNT")}` : ""}
              </span>
              <span className="text-ink-muted">
                {statusLabel[h.status]} · {fmtDate(h.createdAt, locale, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
