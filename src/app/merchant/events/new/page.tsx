import { requireMerchant } from "@/server/auth";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { EventForm } from "@/components/portal/event-form";

export const metadata = { title: "New listing" };

export default async function NewEvent() {
  const ctx = await requireMerchant("MANAGER");
  const t = await getT();
  return (
    <div className="max-w-3xl">
      <PageHeader title={t("New listing")} subtitle={t("Step 1 of 3: details. Next you'll add tickets and dates.")} />
      <EventForm merchantId={ctx.merchant.id} />
    </div>
  );
}
