import { requireMerchant } from "@/server/auth";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { Scanner } from "@/components/portal/scanner";

export const metadata = { title: "Scan tickets" };

export default async function ScanPage() {
  await requireMerchant("STAFF");
  const t = await getT();
  return (
    <>
      <PageHeader title={t("Scan tickets")} subtitle={t("Point the camera at the QR code, or type the code under it.")} />
      <Scanner />
    </>
  );
}
