import { PRIVACY } from "@/content/legal";
import { LegalView } from "@/components/legal-view";
import { getLocale, getT } from "@/i18n/server";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: PRIVACY.title[locale], alternates: alternates("/privacy") };
}

export default async function Page() {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  return <LegalView page={PRIVACY} locale={locale} updatedLabel={t("Last updated")} />;
}
