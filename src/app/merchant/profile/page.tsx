import Link from "next/link";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import type { Localized } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { LocalizedField } from "@/components/localized-field";
import { MediaInput } from "@/components/uploader";
import { addLocationAction, removeLocationAction, saveProfileAction } from "@/actions/merchant-growth";
import { switchMerchantAction } from "@/actions/merchant-onboarding";
import { AREAS, areaName } from "@/lib/areas";

export const metadata = { title: "Business profile" };

export default async function ProfilePage() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const m = ctx.merchant;
  const locations = await prisma.merchantLocation.findMany({ where: { merchantId: m.id } });
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t("Business profile")} actions={m.status === "APPROVED" ? <Link href={`/m/${m.slug}`} target="_blank" className="btn-outline btn-sm">{t("View public page")}</Link> : undefined} />
      {ctx.memberships.length > 1 && (
        <Panel title={t("Switch business")}>
          <div className="flex flex-wrap gap-2">
            {ctx.memberships.map((x) => (
              <ActionButton key={x.id} action={switchMerchantAction.bind(null, x.id)} className={`chip ${x.id === m.id ? "chip-on" : ""}`}>
                {x.name}
              </ActionButton>
            ))}
          </div>
        </Panel>
      )}
      <ActionForm action={saveProfileAction} submit={t("Save")} className="space-y-6">
        <Panel title={t("Details")}>
          <div className="space-y-5">
            <label className="block">
              <span className="label">{t("Business name")}</span>
              <input name="name" defaultValue={m.name} required className="input" />
            </label>
            <LocalizedField name="about" label={t("About your business")} initial={(m.about ?? {}) as Localized} multiline />
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
                <input name="instagram" defaultValue={m.instagram ?? ""} className="input" />
              </label>
            </div>
            <label className="block">
              <span className="label">{t("Website (optional)")}</span>
              <input name="website" type="url" defaultValue={m.website ?? ""} className="input" />
            </label>
          </div>
        </Panel>
        <Panel title={t("Photos")}>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <MediaInput name="logoId" initial={m.logoId} aspect="aspect-square" label={t("Logo")} />
            <MediaInput name="coverId" initial={m.coverId} aspect="aspect-[16/9]" label={t("Cover photo")} />
          </div>
        </Panel>
        {ctx.staffRole === "OWNER" && (
          <Panel title={t("Payout details")}>
            <div className="grid gap-4 sm:grid-cols-3">
              <select name="payoutMethod" defaultValue={m.payoutMethod ?? "whish"} className="input">
                <option value="whish">Whish</option>
                <option value="bank">{t("Bank transfer")}</option>
              </select>
              <input name="payoutName" defaultValue={m.payoutName ?? ""} placeholder={t("Account holder name")} className="input" />
              <input name="payoutAccount" defaultValue={m.payoutAccount ?? ""} placeholder={t("Whish number or IBAN")} className="input" />
            </div>
          </Panel>
        )}
      </ActionForm>
      <Panel title={t("Locations")}>
        <ul className="mb-4 divide-y divide-ink/[.06] text-sm">
          {locations.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
              <span>
                <b>{l.name}</b> · {l.address}, {areaName(l.area, locale)}
              </span>
              <ActionButton action={removeLocationAction.bind(null, l.id)} className="btn-ghost btn-sm" confirm={t("Remove this location?")}>
                {t("Remove")}
              </ActionButton>
            </li>
          ))}
        </ul>
        <ActionForm action={addLocationAction} submit={t("Add location")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="name" placeholder={t("Branch name")} className="input" />
            <select name="area" required defaultValue="" className="input">
              <option value="" disabled>
                {t("Area")}
              </option>
              {AREAS.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a[locale]}
                </option>
              ))}
            </select>
            <input name="address" required placeholder={t("Street address")} className="input sm:col-span-2" />
            <input name="lat" inputMode="decimal" placeholder={t("Latitude (optional)")} className="input" />
            <input name="lng" inputMode="decimal" placeholder={t("Longitude (optional)")} className="input" />
          </div>
        </ActionForm>
      </Panel>
    </div>
  );
}
