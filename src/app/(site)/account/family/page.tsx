import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { saveFamilyAction, deleteFamilyAction } from "@/actions/account";
import { AGE_BANDS, AREAS } from "@/lib/areas";

export const metadata = { title: "Family preferences", robots: { index: false } };

export default async function FamilyPage() {
  const user = await requireUser("/account/family");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const [f, cats] = await Promise.all([prisma.familyProfile.findUnique({ where: { userId: user.id } }), prisma.category.findMany({ where: { parentId: null, active: true, kind: { in: ["EVENT", "RESTAURANT", "PRODUCT"] } }, orderBy: { sort: "asc" } })]);
  const chip = "chip cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white";
  return (
    <div className="max-w-2xl">
      <h1 className="h-section">{t("Family preferences")}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t("Optional. We only use age ranges — never your children's names or birth dates.")}</p>
      <div className="card mt-6 p-6">
        <ActionForm action={saveFamilyAction} submit={t("Save preferences")}>
          <div>
            <p className="label">{t("Kids' ages")}</p>
            <div className="flex flex-wrap gap-2">
              {AGE_BANDS.map((b) => (
                <label key={b.key} className={chip}>
                  <input type="checkbox" name="ageBands" value={b.key} defaultChecked={f?.ageBands.includes(b.key)} className="sr-only" />
                  {t(b.en)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="label">{t("Interests")}</p>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <label key={c.id} className={chip}>
                  <input type="checkbox" name="interests" value={c.slug} defaultChecked={f?.interests.includes(c.slug)} className="sr-only" />
                  {loc(c.name, locale)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="label">{t("Preferred areas (up to 5)")}</p>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <label key={a.slug} className={chip}>
                  <input type="checkbox" name="areas" value={a.slug} defaultChecked={f?.preferredAreas.includes(a.slug)} className="sr-only" />
                  {a[locale]}
                </label>
              ))}
            </div>
          </div>
          <label className="block max-w-xs">
            <span className="label">{t("Usual budget per activity (USD, optional)")}</span>
            <input name="budget" inputMode="decimal" defaultValue={f?.maxBudgetCents ? (f.maxBudgetCents / 100).toString() : ""} className="input" />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" name="consent" defaultChecked={!!f} className="mt-1 accent-ink" />
            {t("I'm the parent or guardian and agree that EVNT stores these preferences to personalise suggestions. I can delete them any time.")}
          </label>
        </ActionForm>
      </div>
      {f && (
        <div className="mt-4">
          <ActionButton action={deleteFamilyAction} className="btn-ghost btn-sm" confirm={t("Delete your family preferences?")}>
            {t("Delete my preferences")}
          </ActionButton>
        </div>
      )}
    </div>
  );
}
