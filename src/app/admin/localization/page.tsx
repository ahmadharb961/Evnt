import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getT } from "@/i18n/server";
import { AR } from "@/i18n/ar";
import { FR } from "@/i18n/fr";
import KEYS from "@/i18n/keys.json";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { saveTranslationAction } from "@/actions/admin";

export const metadata = { title: "Localization" };

export default async function LocalizationPage({ searchParams }: { searchParams: Promise<{ q?: string; missing?: string; lang?: string }> }) {
  await requireAdmin("CONTENT", "ADMIN");
  const [t, sp] = await Promise.all([getT(), searchParams]);
  const lang = sp.lang === "fr" ? "fr" : "ar";
  const base = lang === "fr" ? FR : AR;
  const overrides = new Map((await prisma.translationOverride.findMany({ where: { locale: lang } })).map((o) => [o.key, o.value]));
  const keys = (KEYS as string[]).filter((k) => (!sp.q || k.toLowerCase().includes(sp.q.toLowerCase()) || (base[k] ?? "").includes(sp.q)) && (!sp.missing || (!base[k] && !overrides.has(k))));
  const missingCount = (KEYS as string[]).filter((k) => !base[k] && !overrides.has(k)).length;
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("Localization")} subtitle={t("Interface texts in Arabic and French. Overrides apply within a minute. Listing content is translated on each listing (EN / عربي / FR tabs).")} />
      <form className="flex flex-wrap gap-2">
        <select name="lang" defaultValue={lang} className="input !h-10 !w-36 !py-0">
          <option value="ar">العربية</option>
          <option value="fr">Français</option>
        </select>
        <input name="q" defaultValue={sp.q} placeholder={t("Search texts")} className="input !h-10 !w-64 !py-0" />
        <label className="chip">
          <input type="checkbox" name="missing" value="1" defaultChecked={!!sp.missing} className="accent-ink" />
          {t("Missing only ({n})", { n: missingCount })}
        </label>
        <button className="btn-primary !min-h-10">{t("Filter")}</button>
      </form>
      <Panel>
        <ul className="divide-y divide-ink/[.06]">
          {keys.slice(0, 150).map((k) => (
            <li key={k} className="py-3">
              <p className="text-sm">{k}</p>
              <ActionForm action={saveTranslationAction} hidden={{ locale: lang, key: k }} submit={t("Save")} submitClass="btn-outline btn-sm" className="mt-1.5 flex gap-2">
                <input name="value" defaultValue={overrides.get(k) ?? base[k] ?? ""} dir={lang === "ar" ? "rtl" : "ltr"} className={`input !py-2 ${!base[k] && !overrides.has(k) ? "border-peach" : ""}`} />
              </ActionForm>
            </li>
          ))}
        </ul>
        {keys.length > 150 && <p className="mt-3 text-xs text-ink-muted">{t("Showing 150 of {n}. Use search to narrow down.", { n: keys.length })}</p>}
      </Panel>
    </div>
  );
}
