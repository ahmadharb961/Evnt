import { REFUNDS } from "@/content/legal";
import { LegalView } from "@/components/legal-view";
import { getLocale, getT } from "@/i18n/server";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: REFUNDS.title[locale], alternates: alternates("/refunds") };
}

export default async function Page() {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  return <LegalView page={REFUNDS} locale={locale} updatedLabel={t("Last updated")} />;
}
