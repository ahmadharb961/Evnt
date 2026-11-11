"use client";

import { useMemo, useState } from "react";
import { simulate, DEFAULT_SCENARIO, type Scenario } from "@/lib/revenue";
import { formatMoney } from "@/lib/money";
import { useLocale, useT } from "@/i18n/client";

/** Interactive revenue scenario. Clearly a forecast — never actual or guaranteed revenue. */
export function RevenueSimulator({ initial }: { initial: Partial<Scenario> }) {
  const t = useT();
  const locale = useLocale();
  const [s, setS] = useState<Scenario>({ ...DEFAULT_SCENARIO, ...initial });
  const r = useMemo(() => simulate(s), [s]);
  const money = (c: number) => formatMoney(c, locale);
  const field = (k: keyof Scenario, label: string, cents = false, suffix = "") => (
    <label className="block">
      <span className="label text-xs">{label}</span>
      <div className="flex items-center gap-1">
        {cents && <span className="text-sm text-ink-muted">$</span>}
        <input
          type="number"
          min={0}
          step={cents ? 0.01 : 1}
          value={cents ? s[k] / 100 : s[k]}
          onChange={(e) => setS({ ...s, [k]: cents ? Math.round(parseFloat(e.target.value || "0") * 100) : Math.max(0, parseFloat(e.target.value || "0")) })}
          className="input !py-2"
        />
        {suffix && <span className="text-sm text-ink-muted">{suffix}</span>}
      </div>
    </label>
  );
  return (
    <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5 rounded-3xl border border-ink/[.06] bg-white p-6">
        <p className="text-sm font-semibold">{t("Assumptions (monthly)")}</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {field("proMerchants", t("Pro merchants"))}
          {field("proMonthlyCents", t("Pro price"), true)}
          {field("featuredMerchants", t("Featured merchants"))}
          {field("featuredMonthlyCents", t("Featured price"), true)}
          {field("members", t("EVNT+ members"))}
          {field("memberMonthlyCents", t("EVNT+ monthly price"), true)}
          {field("bookings", t("Bookings"))}
          {field("avgCommissionCents", t("Average commission / booking"), true)}
          {field("assessments", t("Farah assessments"))}
          {field("assessmentCents", t("Assessment price"), true)}
          {field("refundRatePct", t("Refunds (% of commissions)"), false, "%")}
          {field("paymentCostPct", t("Payment processing"), false, "%")}
          {field("operatingCostsCents", t("Operating expenses"), true)}
        </div>
        <button type="button" onClick={() => setS({ ...DEFAULT_SCENARIO })} className="btn-ghost btn-sm">
          {t("Reset to the default scenario")}
        </button>
      </div>
      <div className="space-y-3 rounded-3xl bg-ink p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{t("Scenario — not actual or guaranteed revenue")}</p>
        {[
          [t("Subscription revenue"), r.subscriptions],
          [t("Membership revenue"), r.memberships],
          [t("Booking commissions"), r.commissions],
          [t("Assessment revenue"), r.assessments],
        ].map(([l, v]) => (
          <div key={l as string} className="flex justify-between text-sm">
            <span className="text-white/80">{l}</span>
            <span>{money(v as number)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-white/20 pt-3 text-lg font-bold">
          <span>{t("Estimated monthly gross")}</span>
          <span>{money(r.gross)}</span>
        </div>
        {[
          [t("− Refunds"), r.refunds],
          [t("− Payment costs"), r.paymentCosts],
          [t("− Operating expenses"), r.operatingCosts],
        ].map(([l, v]) => (
          <div key={l as string} className="flex justify-between text-sm text-white/70">
            <span>{l}</span>
            <span>{money(v as number)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-white/20 pt-3 text-lg font-bold">
          <span>{t("Net contribution")}</span>
          <span className={r.net < 0 ? "text-red-300" : "text-mint"}>{money(r.net)}</span>
        </div>
        <p className="text-xs text-white/60">{t("Annualised gross: {amount}", { amount: money(r.gross * 12) })}</p>
      </div>
    </div>
  );
}
