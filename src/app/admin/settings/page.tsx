import { requireAdmin, hasRole } from "@/server/auth";
import { getSetting, DEFAULTS, type SettingKey } from "@/server/settings";
import { whishAvailable } from "@/server/payments";
import { getT } from "@/i18n/server";
import type { Tone } from "@/lib/tones";
import { SettingsForm, NumberTile, ToggleTile, TextTile } from "@/components/admin/settings-ui";
import { TONES } from "@/lib/tones";
import { saveSettingsAction } from "@/actions/admin";
import { CheckCircle2, AlertCircle, Ticket, Scale, Crown, Cake, ShieldCheck, Sparkles, Receipt, CreditCard, SlidersHorizontal, ShoppingBag } from "lucide-react";

export const metadata = { title: "Platform settings" };

type Unit = "$" | "minutes" | "hours" | "days" | "months" | "%" | "points" | "×" | "businesses" | "text";
/** Plain-language name, explanation and unit for every setting. */
const META: Record<Exclude<SettingKey, "hero">, { label: string; help: string; unit: Unit }> = {
  "booking.holdMinutes": { label: "Seat hold time", help: "When a family starts booking, their spots are kept for them for this long while they pay. After that the spots go back on sale.", unit: "minutes" },
  "booking.feeCents": { label: "Booking fee", help: "Small service fee EVNT adds to each paid booking. EVNT+ members don't pay it. Set 0 to turn it off.", unit: "$" },
  "shop.listingCents": { label: "Shop listing price", help: "What a shop pays per month to have its store and products on EVNT. No commission is taken on shop sales.", unit: "$" },
  "attribution.externalSharePct": { label: "Commission on outside bookings", help: "When a family finds a business on EVNT, contacts them (call / WhatsApp) and books directly, EVNT earns this share of its normal commission.", unit: "%" },
  "attribution.externalWindowHours": { label: "Outside booking window", help: "How long after a family contacts a business a direct booking still counts as coming from EVNT.", unit: "hours" },
  "membership.monthlyCents": { label: "EVNT+ monthly price", help: "What families pay per month for EVNT+.", unit: "$" },
  "membership.yearlyCents": { label: "EVNT+ yearly price", help: "What families pay per year for EVNT+ (usually a discount on 12 months).", unit: "$" },
  "membership.earlyAccessHours": { label: "EVNT+ early access", help: "EVNT+ members can book new activities this long before everyone else.", unit: "hours" },
  "loyalty.pointsPerDollar": { label: "Points per $1 spent", help: "Loyalty points a family earns for every dollar they spend.", unit: "points" },
  "loyalty.memberMultiplier": { label: "EVNT+ points boost", help: "EVNT+ members earn points this many times faster (2 = double points).", unit: "×" },
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

const ICONS = [Ticket, Crown, Scale, Cake, ShieldCheck, Sparkles, Receipt, CreditCard, ShoppingBag];
const GROUPS: { title: string; desc: string; icon: (typeof ICONS)[number]; tone: Tone; keys: Exclude<SettingKey, "hero">[] }[] = [
  { title: "Bookings", desc: "How booking an activity works", icon: ICONS[0], tone: "mint", keys: ["booking.holdMinutes", "booking.feeCents"] },
  { title: "EVNT+ & loyalty", desc: "Family membership and reward points", icon: ICONS[1], tone: "violet", keys: ["membership.monthlyCents", "membership.yearlyCents", "membership.earlyAccessHours", "loyalty.pointsPerDollar", "loyalty.memberMultiplier"] },
  { title: "Shops", desc: "Stores pay a monthly fee to be listed, with no commission on their sales", icon: ICONS[8], tone: "blush", keys: ["shop.listingCents"] },
  { title: "Bookings made outside EVNT", desc: "When families contact a business from EVNT and book with them directly", icon: ICONS[2], tone: "sky", keys: ["attribution.externalSharePct", "attribution.externalWindowHours"] },
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
  const unitLabel = (u: Unit) => (u === "$" || u === "text" ? undefined : t(u));
  return (
    <div className="mx-auto max-w-5xl">
      <div className="relative isolate mb-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-800 via-ink to-violet-900 p-6 text-white sm:p-8">
        <div aria-hidden className="absolute -end-10 -top-16 -z-10 h-56 w-56 rounded-full bg-violet-500/40 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 start-1/4 -z-10 h-56 w-56 rounded-full bg-peach/30 blur-3xl" />
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <SlidersHorizontal className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{t("Platform settings")}</h1>
        <p className="mt-2 max-w-xl text-sm text-white/75">{t("Prices are in US dollars. Changes apply straight away and are recorded in the activity log.")}</p>
        <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${whishReady ? "bg-emerald-400/20 text-emerald-200" : "bg-amber-400/20 text-amber-100"}`}>
          {whishReady ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {t("Online card payments")}: {whishReady ? t("Live") : whishEnv ? t("Credentials set — switch on below after testing in sandbox") : t("Not configured (no credentials). Online payment shows as unavailable.")}
        </div>
      </div>

      <nav className="sticky top-14 z-20 -mx-4 mb-6 flex gap-2 overflow-x-auto bg-canvas/90 px-4 py-3 backdrop-blur [scrollbar-width:none] lg:-mx-8 lg:px-8">
        {GROUPS.map((g, i) => {
          const Icon = g.icon;
          return (
            <a key={g.title} href={`#g${i}`} className={`inline-flex shrink-0 items-center gap-2 rounded-full py-1.5 pe-4 ps-1.5 text-sm font-semibold ring-1 ring-ink/[.06] transition hover:shadow-card ${TONES[g.tone].soft}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-white ${TONES[g.tone].text}`}>
                <Icon className="h-4 w-4" />
              </span>
              {t(g.title)}
            </a>
          );
        })}
      </nav>

      <SettingsForm action={saveSettingsAction}>
        {GROUPS.map((g, i) => {
          const Icon = g.icon;
          const c = TONES[g.tone];
          return (
            <section key={g.title} id={`g${i}`} className={`scroll-mt-32 rounded-[2rem] p-4 sm:p-6 ${c.soft}`}>
              <div className="mb-5 flex items-center gap-3 px-1">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${c.tile} ${c.text}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">{t(g.title)}</h2>
                  <p className="text-sm text-ink-soft">{t(g.desc)}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.keys.map((k) => {
                  const m = META[k];
                  const v = values[k];
                  if (typeof DEFAULTS[k] === "boolean") return <ToggleTile key={k} name={k} label={t(m.label)} help={t(m.help)} defaultChecked={!!v} />;
                  if (m.unit === "text") return <TextTile key={k} name={k} label={t(m.label)} help={t(m.help)} defaultValue={String(v ?? "")} />;
                  const money = k.endsWith("Cents");
                  return <NumberTile key={k} name={k} label={t(m.label)} help={t(m.help)} unit={unitLabel(m.unit)} money={money} defaultValue={money ? Number(v) / 100 : Number(v)} accent={c.deep} />;
                })}
              </div>
            </section>
          );
        })}
      </SettingsForm>
    </div>
  );
}
