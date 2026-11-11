import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { trialAvailable } from "@/server/billing";
import { getSetting } from "@/server/settings";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { onboardingStepAction } from "@/actions/merchant-onboarding";
import { ActionForm } from "@/components/portal/action-form";
import { LocalizedField } from "@/components/localized-field";
import { MediaInput } from "@/components/uploader";
import { AREAS } from "@/lib/areas";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Set up your business" };

const TYPE_LABELS: Record<string, string> = {
  ACTIVITY_PROVIDER: "Activities, workshops & classes",
  VENUE: "Venue or play area",
  EVENT_ORGANIZER: "Shows & events organizer",
  RESTAURANT: "Restaurant or café",
  RETAILER: "Shop (kids' products)",
  BIRTHDAY_SERVICE: "Birthday services",
};

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const ctx = await requireMerchant("OWNER");
  const m = ctx.merchant;
  if (m.status === "APPROVED") redirect("/merchant");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const step = Math.min(Math.max(Number(sp.step) || m.onboardingStep, 2), Math.max(m.onboardingStep, 2));
  const steps = [t("Account"), t("Business type"), t("Business details"), t("Location"), t("Photos"), t("Plan"), t("Offerings"), t("Payouts"), t("Submit"), t("Verification")];
  const loc0 = await prisma.merchantLocation.findFirst({ where: { merchantId: m.id } });
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { monthlyCents: "asc" } });
  const trial = await trialAvailable(m.id);
  const trialDays = await getSetting("trial.days");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">{t("Set up {name}", { name: m.name })}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t("About 10 minutes. You can stop and come back any time.")}</p>
      <ol className="mt-6 flex gap-1.5">
        {steps.map((s, i) => {
          const n = i + 1;
          const done = n < m.onboardingStep || m.status === "PENDING";
          return (
            <li key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${n === step ? "bg-ink" : done ? "bg-mint-deep" : "bg-ink/10"}`} title={s} />
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-ink-muted">
        {t("Step {n} of {total}", { n: m.status === "PENDING" ? 10 : step, total: 10 })} · {steps[(m.status === "PENDING" ? 10 : step) - 1]}
      </p>

      <div className="mt-6 rounded-4xl border border-ink/[.06] bg-white p-5 sm:p-8">
        {m.status === "PENDING" ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint-soft">
              <Check className="h-6 w-6 text-mint-deep" />
            </span>
            <h2 className="mt-4 text-xl font-bold">{t("Submitted for verification")}</h2>
            <p className="mt-2 text-sm text-ink-muted">{t("We usually verify businesses within 2 working days. Meanwhile you can prepare your listings.")}</p>
            <Link href="/merchant" className="btn-primary mt-6">
              {t("Go to dashboard")}
            </Link>
          </div>
        ) : step === 2 ? (
          <ActionForm action={onboardingStepAction} hidden={{ step: "2" }} submit={t("Continue")}>
            <p className="font-semibold">{t("What kind of business are you?")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <label key={k} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink/10 p-4 has-[:checked]:border-ink has-[:checked]:ring-2 has-[:checked]:ring-ink">
                  <input type="radio" name="type" value={k} defaultChecked={m.type === k} className="accent-ink" />
                  <span className="text-sm font-medium">{t(v)}</span>
                </label>
              ))}
            </div>
          </ActionForm>
        ) : step === 3 ? (
          <ActionForm action={onboardingStepAction} hidden={{ step: "3" }} submit={t("Continue")}>
            <label className="block">
              <span className="label">{t("Business name")}</span>
              <input name="name" defaultValue={m.name} required className="input" />
            </label>
            <LocalizedField name="about" label={t("About your business")} initial={m.about as Record<string, string>} multiline />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">{t("Phone")}</span>
                <input name="phone" type="tel" defaultValue={m.phone ? `+${m.phone}` : ""} required className="input" />
              </label>
              <label className="block">
                <span className="label">{t("WhatsApp")}</span>
                <input name="whatsapp" type="tel" defaultValue={m.whatsapp ? `+${m.whatsapp}` : ""} className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Email")}</span>
                <input name="email" type="email" defaultValue={m.email ?? ""} className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Instagram")}</span>
                <input name="instagram" defaultValue={m.instagram ?? ""} placeholder="@yourbusiness" className="input" />
              </label>
            </div>
            <label className="block">
              <span className="label">{t("Website (optional)")}</span>
              <input name="website" type="url" defaultValue={m.website ?? ""} placeholder="https://" className="input" />
            </label>
          </ActionForm>
        ) : step === 4 ? (
          <ActionForm action={onboardingStepAction} hidden={{ step: "4" }} submit={t("Continue")}>
            <label className="block">
              <span className="label">{t("Location name")}</span>
              <input name="locName" defaultValue={loc0?.name ?? "Main"} className="input" />
            </label>
            <label className="block">
              <span className="label">{t("Area")}</span>
              <select name="area" defaultValue={loc0?.area ?? ""} required className="input">
                <option value="">{t("Choose…")}</option>
                {AREAS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a[locale]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">{t("Street address")}</span>
              <input name="address" defaultValue={loc0?.address ?? ""} required className="input" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="label">{t("Latitude (optional)")}</span>
                <input name="lat" defaultValue={loc0?.lat ?? ""} inputMode="decimal" className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Longitude (optional)")}</span>
                <input name="lng" defaultValue={loc0?.lng ?? ""} inputMode="decimal" className="input" />
              </label>
            </div>
            <p className="text-xs text-ink-muted">{t("Tip: in Google Maps, long-press your place and copy the coordinates. You can add more branches later in your profile.")}</p>
          </ActionForm>
        ) : step === 5 ? (
          <ActionForm action={onboardingStepAction} hidden={{ step: "5" }} submit={t("Continue")}>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <MediaInput name="logoId" initial={m.logoId} aspect="aspect-square" label={t("Logo")} />
              <MediaInput name="coverId" initial={m.coverId} aspect="aspect-[16/9]" label={t("Cover photo")} />
            </div>
            <p className="text-xs text-ink-muted">{t("Use bright, real photos of your place and happy kids (with parents' permission).")}</p>
          </ActionForm>
        ) : step === 6 ? (
          <ActionForm action={onboardingStepAction} hidden={{ step: "6" }} submit={t("Continue")}>
            <div className="grid gap-3">
              {plans.map((p) => (
                <label key={p.code} className="flex cursor-pointer items-start gap-3 rounded-3xl border border-ink/10 p-4 has-[:checked]:border-ink has-[:checked]:ring-2 has-[:checked]:ring-ink">
                  <input type="radio" name="plan" value={p.code} defaultChecked={m.plan === p.code} className="mt-1 accent-ink" />
                  <span className="flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-bold">{p.name}</span>
                      <span className="text-sm font-semibold">{p.monthlyCents ? t("{price}/month", { price: formatMoney(p.monthlyCents, locale) }) : t("Free")}</span>
                    </span>
                    <span className="mt-1 block text-xs text-ink-muted">{(p.features as Record<string, string>[]).map((f) => loc(f, locale)).join(" · ")}</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="interval" value="YEARLY" className="accent-ink" />
              {t("Pay yearly (2 months free)")}
            </label>
            {trial && (
              <label className="flex items-center gap-2 rounded-2xl bg-mint-soft p-3 text-sm font-medium text-mint-deep">
                <input type="checkbox" name="trial" defaultChecked className="accent-ink" />
                {t("Start with a free {n}-day trial of Pro or Featured (launch offer)", { n: trialDays })}
              </label>
            )}
            <p className="text-xs text-ink-muted">{t("Paid plans start once the invoice is paid. Advertising placements are sold separately.")}</p>
          </ActionForm>
        ) : step === 7 ? (
          <ActionForm action={onboardingStepAction} hidden={{ step: "7" }} submit={t("Continue")}>
            <p className="font-semibold">{t("What will you offer on EVNT?")}</p>
            <p className="text-sm text-ink-muted">{t("You can add your first listings now or after verification. They'll go live once your business is approved.")}</p>
            <div className="flex flex-wrap gap-2">
              {m.type !== "RETAILER" && m.type !== "RESTAURANT" && (
                <Link href="/merchant/events/new" className="btn-outline">
                  {t("Add an activity or event")}
                </Link>
              )}
              {m.type === "RESTAURANT" && (
                <Link href="/merchant/restaurant" className="btn-outline">
                  {t("Set up your restaurant page")}
                </Link>
              )}
              {(m.type === "RETAILER" || m.type === "BIRTHDAY_SERVICE") && (
                <Link href="/merchant/products/new" className="btn-outline">
                  {t("Add a product")}
                </Link>
              )}
            </div>
          </ActionForm>
        ) : step === 8 ? (
          <ActionForm action={onboardingStepAction} hidden={{ step: "8" }} submit={t("Continue")}>
            <p className="text-sm text-ink-muted">{t("Where should we send money from online bookings and orders paid through EVNT?")}</p>
            <div className="flex gap-3">
              {["whish", "bank"].map((v) => (
                <label key={v} className="flex flex-1 cursor-pointer items-center gap-2 rounded-2xl border border-ink/10 p-4 has-[:checked]:border-ink has-[:checked]:ring-2 has-[:checked]:ring-ink">
                  <input type="radio" name="payoutMethod" value={v} defaultChecked={(m.payoutMethod ?? "whish") === v} className="accent-ink" />
                  <span className="text-sm font-medium">{v === "whish" ? t("Whish account") : t("Bank transfer")}</span>
                </label>
              ))}
            </div>
            <label className="block">
              <span className="label">{t("Account holder name")}</span>
              <input name="payoutName" defaultValue={m.payoutName ?? ""} required className="input" />
            </label>
            <label className="block">
              <span className="label">{t("Whish number or IBAN")}</span>
              <input name="payoutAccount" defaultValue={m.payoutAccount ?? ""} required className="input" />
            </label>
          </ActionForm>
        ) : (
          <ActionForm action={onboardingStepAction} hidden={{ step: "9" }} submit={t("Submit for verification")}>
            <p className="font-semibold">{t("Ready to go live?")}</p>
            <p className="text-sm text-ink-muted">{t("Our team checks every business before it appears on EVNT. We may call you to confirm a few details.")}</p>
          </ActionForm>
        )}
      </div>
      {step > 2 && m.status !== "PENDING" && (
        <Link href={`/merchant/onboarding?step=${step - 1}`} className="mt-4 inline-block text-sm text-ink-muted hover:text-ink">
          ← {t("Back")}
        </Link>
      )}
    </div>
  );
}
