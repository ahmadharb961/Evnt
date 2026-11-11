import { requireAdmin, hasRole } from "@/server/auth";
import { getSetting, DEFAULTS, type SettingKey } from "@/server/settings";
import { whishAvailable } from "@/server/payments";
import { getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { saveSettingsAction } from "@/actions/admin";

export const metadata = { title: "Platform settings" };

const GROUPS: { title: string; keys: SettingKey[] }[] = [
  { title: "Bookings", keys: ["booking.holdMinutes", "booking.feeCents"] },
  { title: "Attribution", keys: ["attribution.externalSharePct", "attribution.externalWindowHours"] },
  { title: "EVNT+ & loyalty", keys: ["membership.monthlyCents", "membership.yearlyCents", "membership.earlyAccessHours", "loyalty.pointsPerDollar", "loyalty.memberMultiplier"] },
  { title: "Birthday Radar", keys: ["leads.priceCents", "leads.minCents", "leads.maxCents"] },
  { title: "Farah Approved", keys: ["cert.assessmentCents", "cert.licenseCents", "cert.renewalCents", "cert.reevaluationCents", "cert.validMonths"] },
  { title: "Merchant trial", keys: ["trial.enabled", "trial.days", "trial.maxMerchants"] },
  { title: "Billing", keys: ["billing.graceDays", "billing.invoiceDueDays", "billing.restrictAfterDaysOverdue", "orders.autoCancelUnpaidHours"] },
  { title: "Payments & support", keys: ["whish.enabled", "support.whatsapp", "support.email"] },
];

export default async function SettingsAdmin() {
  const u = await requireAdmin();
  const t = await getT();
  if (!hasRole(u, "SUPER_ADMIN")) return <p className="text-sm">{t("Only a super admin can change platform settings.")}</p>;
  const values = Object.fromEntries(await Promise.all((Object.keys(DEFAULTS) as SettingKey[]).filter((k) => k !== "hero").map(async (k) => [k, await getSetting(k)])));
  const whishReady = await whishAvailable();
  const whishEnv = !!(process.env.WHISH_API_BASE && process.env.WHISH_CHANNEL && process.env.WHISH_SECRET);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t("Platform settings")} subtitle={t("Amounts in USD. Changes apply immediately and are recorded in the audit log.")} />
      <Panel>
        <p className="text-sm">
          {t("Whish status")}: <b>{whishReady ? t("Live") : whishEnv ? t("Credentials set — switch on below after testing in sandbox") : t("Not configured (no credentials). Online payment shows as unavailable.")}</b>
        </p>
      </Panel>
      <ActionForm action={saveSettingsAction} submit={t("Save settings")} className="space-y-6">
        {GROUPS.map((g) => (
          <Panel key={g.title} title={t(g.title)}>
            <div className="grid gap-4 sm:grid-cols-2">
              {g.keys.map((k) => {
                const v = values[k];
                const isMoney = k.endsWith("Cents");
                if (typeof DEFAULTS[k] === "boolean")
                  return (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={k} defaultChecked={!!v} className="accent-ink" />
                      <code className="text-xs">{k}</code>
                    </label>
                  );
                return (
                  <label key={k} className="block">
                    <span className="label font-mono text-xs">{k}</span>
                    <input name={k} defaultValue={isMoney ? Number(v) / 100 : String(v)} className="input !py-2" inputMode={typeof DEFAULTS[k] === "number" ? "decimal" : undefined} />
                  </label>
                );
              })}
            </div>
          </Panel>
        ))}
      </ActionForm>
    </div>
  );
}
