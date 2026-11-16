import { requireAdmin, hasRole } from "@/server/auth";
import { getSetting, DEFAULTS, type SettingKey } from "@/server/settings";
import { whishAvailable } from "@/server/payments";
import { getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import type { Tone } from "@/lib/tones";
import { ActionForm } from "@/components/portal/action-form";
import { saveSettingsAction } from "@/actions/admin";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const metadata = { title: "Platform settings" };

type Unit = "$" | "minutes" | "hours" | "days" | "months" | "%" | "points" | "×" | "businesses" | "text";
/** Plain-language name, explanation and unit for every setting. */
const META: Record<Exclude<SettingKey, "hero">, { label: string; help: string; unit: Unit }> = {
  "booking.holdMinutes": { label: "Seat hold time", help: "When a family starts booking, their spots are kept for them for this long while they pay. After that the spots go back on sale.", unit: "minutes" },
  "booking.feeCents": { label: "Booking fee", help: "Small service fee EVNT adds to each paid booking. EVNT+ members don't pay it. Set 0 to turn it off.", unit: "$" },
  "attribution.externalSharePct": { label: "Commission on outside bookings", help: "When a family finds a business on EVNT, contacts them (call / WhatsApp) and books directly, EVNT earns this share of its normal commission.", unit: "%" },
  "attribution.externalWindowHours": { label: "Outside booking window", help: "How long after a family contacts a business a direct booking still counts as coming from EVNT.", unit: "hours" },
  "membership.monthlyCents": { label: "EVNT+ monthly price", help: "What families pay per month for EVNT+.", unit: "$" },
  "membership.yearlyCents": { label: "EVNT+ yearly price", help: "What families pay per year for EVNT+ (usually a discount on 12 months).", unit: "$" },
  "membership.earlyAccessHours": { label: "EVNT+ early access", help: "EVNT+ members can book new activities this long before everyone else.", unit: "hours" },
  "loyalty.pointsPerDollar": { label: "Points per $1 spent", help: "Loyalty points a family earns for every dollar they spend.", unit: "points" },
  "loyalty.memberMultiplier": { label: "EVNT+ points boost", help: "EVNT+ members earn points this many times faster (2 = double points).", unit: "×" },
  "leads.priceCents": { label: "Birthday lead price", help: "What a business pays to see the contact of a family planning a birthday party.", unit: "$" },
  "leads.minCents": { label: "Lowest lead price", help: "The lead price never goes below this.", unit: "$" },
  "leads.maxCents": { label: "Highest lead price", help: "The lead price never goes above this.", unit: "$" },
  "cert.assessmentCents": { label: "Assessment fee", help: "One-time fee a business pays for the first Farah Approved inspection.", unit: "$" },
  "cert.licenseCents": { label: "Yearly badge licence", help: "Paid once approved, to show the Farah Approved badge for a year.", unit: "$" },
  "cert.renewalCents": { label: "Renewal fee", help: "Fee to renew the badge when it expires.", unit: "$" },
  "cert.reevaluationCents": { label: "Re-inspection fee", help: "Fee if a business asks to be inspected again (e.g. after failing).", unit: "$" },
  "cert.validMonths": { label: "Badge valid for", help: "How long a Farah Approved badge lasts before renewal.", unit: "months" },
  "trial.enabled": { label: "Free trial for new businesses", help: "New businesses get a paid plan free for a while to try EVNT.", unit: "text" },
  "trial.days": { label: "Trial length", help: "How long the free trial lasts.", unit: "days" },
  "trial.maxMerchants": { label: "Trial spots", help: "Maximum number of businesses that can get the free trial in total.", unit: "businesses" },
  "billing.graceDays": { label: "Late payment grace", help: "If a business doesn't pay its plan on time, it keeps its features this many extra days before going back to the free Basic plan.", unit: "days" },
  "billing.invoiceDueDays": { label: "Invoice due in", help: "How many days a business has to pay an invoice.", unit: "days" },
  "billing.restrictAfterDaysOverdue": { label: "Pause unpaid businesses after", help: "If an invoice is this many days late, the business can't take new bookings until it pays.", unit: "days" },
  "orders.autoCancelUnpaidHours": { label: "Cancel unpaid shop orders after", help: "Online-payment shop orders that are still unpaid after this long are cancelled and stock goes back.", unit: "hours" },
  "whish.enabled": { label: "Online card payments (Whish)", help: "Turn on only after testing. When off, families pay at the venue or cash on delivery.", unit: "text" },
  "support.whatsapp": { label: "Support WhatsApp number", help: "Shown to families and businesses who need help. Include the country code, e.g. 96170123456.", unit: "text" },
  "support.email": { label: "Support email", help: "Where help requests go.", unit: "text" },
};

const ICONS = ["Ticket", "Crown", "Scale", "Cake", "ShieldCheck", "Sparkles", "Receipt", "CreditCard"] as const;
const GROUPS: { title: string; desc: string; icon: (typeof ICONS)[number]; tone: Tone; keys: Exclude<SettingKey, "hero">[] }[] = [
  { title: "Bookings", desc: "How booking an activity works", icon: ICONS[0], tone: "mint", keys: ["booking.holdMinutes", "booking.feeCents"] },
  { title: "EVNT+ & loyalty", desc: "Family membership and reward points", icon: ICONS[1], tone: "violet", keys: ["membership.monthlyCents", "membership.yearlyCents", "membership.earlyAccessHours", "loyalty.pointsPerDollar", "loyalty.memberMultiplier"] },
  { title: "Bookings made outside EVNT", desc: "When families contact a business from EVNT and book with them directly", icon: ICONS[2], tone: "sky", keys: ["attribution.externalSharePct", "attribution.externalWindowHours"] },
  { title: "Birthday Radar", desc: "Businesses pay to reach families planning a party", icon: ICONS[3], tone: "rose", keys: ["leads.priceCents", "leads.minCents", "leads.maxCents"] },
  { title: "Farah Approved", desc: "Safety & quality badge fees", icon: ICONS[4], tone: "emerald", keys: ["cert.assessmentCents", "cert.licenseCents", "cert.renewalCents", "cert.reevaluationCents", "cert.validMonths"] },
  { title: "Free trial for businesses", desc: "Help new businesses get started", icon: ICONS[5], tone: "peach", keys: ["trial.enabled", "trial.days", "trial.maxMerchants"] },
  { title: "Invoices & late payments", desc: "What happens when businesses or orders aren't paid", icon: ICONS[6], tone: "amber", keys: ["billing.invoiceDueDays", "billing.graceDays", "billing.restrictAfterDaysOverdue", "orders.autoCancelUnpaidHours"] },
  { title: "Payments & support", desc: "Card payments and how people reach you", icon: ICONS[7], tone: "powder", keys: ["whish.enabled", "support.whatsapp", "support.email"] },
];

export default async function SettingsAdmin() {
  const u = await requireAdmin();
  const t = await getT();
  if (!hasRole(u, "SUPER_ADMIN")) return <p className="text-sm">{t("Only a super admin can change platform settings.")}</p>;
  const values = Object.fromEntries(await Promise.all((Object.keys(META) as SettingKey[]).map(async (k) => [k, await getSetting(k)])));
  const whishReady = await whishAvailable();
  const whishEnv = !!(process.env.WHISH_API_BASE && process.env.WHISH_CHANNEL && process.env.WHISH_SECRET);
  const unitLabel = (u: Unit) => (u === "$" || u === "text" ? "" : t(u));
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t("Platform settings")} subtitle={t("Prices are in US dollars. Changes apply straight away and are recorded in the activity log.")} />
      <div className={`flex items-start gap-3 rounded-3xl p-4 text-sm ${whishReady ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
        {whishReady ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
        <p>
          <b>{t("Online card payments")}:</b> {whishReady ? t("Live") : whishEnv ? t("Credentials set — switch on below after testing in sandbox") : t("Not configured (no credentials). Online payment shows as unavailable.")}
        </p>
      </div>
      <ActionForm action={saveSettingsAction} submit={t("Save settings")} className="space-y-6">
        {GROUPS.map((g) => (
          <Panel key={g.title} title={t(g.title)} subtitle={t(g.desc)} icon={g.icon} tone={g.tone}>
            <div className="grid gap-4 sm:grid-cols-2">
              {g.keys.map((k) => {
                const m = META[k];
                const v = values[k];
                if (typeof DEFAULTS[k] === "boolean")
                  return (
                    <label key={k} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-canvas p-4 sm:col-span-2">
                      <input type="checkbox" name={k} defaultChecked={!!v} className="peer sr-only" />
                      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-ink/20 transition after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5" />
                      <span>
                        <span className="block text-sm font-semibold">{t(m.label)}</span>
                        <span className="mt-0.5 block text-xs text-ink-muted">{t(m.help)}</span>
                      </span>
                    </label>
                  );
                const isMoney = k.endsWith("Cents");
                const isNum = typeof DEFAULTS[k] === "number";
                return (
                  <label key={k} className={`flex flex-col rounded-2xl bg-canvas p-4 ${m.unit === "text" ? "sm:col-span-2" : ""}`}>
                    <span className="block text-sm font-semibold">{t(m.label)}</span>
                    <span className="mb-2.5 mt-0.5 block text-xs leading-relaxed text-ink-muted">{t(m.help)}</span>
                    <span className="mt-auto flex items-center overflow-hidden rounded-2xl border border-ink/10 bg-white focus-within:ring-2 focus-within:ring-ink/20">
                      {isMoney && <span className="ps-4 text-sm font-semibold text-ink-muted">$</span>}
                      <input name={k} defaultValue={isMoney ? Number(v) / 100 : String(v)} className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-semibold outline-none" inputMode={isNum ? "decimal" : undefined} dir={m.unit === "text" ? "ltr" : undefined} />
                      {unitLabel(m.unit) && <span className="pe-4 text-xs font-medium text-ink-muted">{unitLabel(m.unit)}</span>}
                    </span>
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
