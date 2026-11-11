import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getSettings } from "@/server/settings";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { RevenueSimulator } from "@/components/admin/simulator";
import { DEFAULT_SCENARIO } from "@/lib/revenue";

export const metadata = { title: "Revenue simulator" };

export default async function SimulatorPage() {
  await requireAdmin("ADMIN", "FINANCE");
  const t = await getT();
  // Prices come from current settings; volumes start at the brief's default scenario.
  const [plans, s] = await Promise.all([prisma.subscriptionPlan.findMany(), getSettings(["membership.monthlyCents", "cert.assessmentCents"])]);
  const price = (c: string) => plans.find((p) => p.code === c)?.monthlyCents;
  return (
    <div className="max-w-6xl">
      <PageHeader title={t("Revenue simulator")} subtitle={t("Edit any assumption to explore scenarios. Forecasts are illustrative scenarios, not actual or guaranteed revenue.")} />
      <RevenueSimulator initial={{ ...DEFAULT_SCENARIO, proMonthlyCents: price("PRO") ?? 7900, featuredMonthlyCents: price("FEATURED") ?? 19900, memberMonthlyCents: s["membership.monthlyCents"], assessmentCents: s["cert.assessmentCents"] }} />
    </div>
  );
}
