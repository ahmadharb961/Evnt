import { TERMS } from "@/content/legal";
import { LegalView } from "@/components/legal-view";
import { getLocale, getT } from "@/i18n/server";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: TERMS.title[locale], alternates: alternates("/terms") };
}

export default async function Page() {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  return <LegalView page={TERMS} locale={locale} updatedLabel={t("Last updated")} />;
}
