import { notFound } from "next/navigation";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { SeatingEditor } from "@/components/portal/seating-editor";

export const metadata = { title: "Seating map" };

export default async function SeatingEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMerchant("MANAGER");
  const t = await getT();
  if (id === "new")
    return (
      <>
        <PageHeader title={t("New seating map")} />
        <SeatingEditor />
      </>
    );
  const m = await prisma.seatingMap.findUnique({ where: { id }, include: { seats: true } });
  if (!m || m.merchantId !== ctx.merchant.id) notFound();
  return (
    <>
      <PageHeader title={m.name} subtitle={t("Places with bookings can be moved, re-zoned or blocked, but not removed.")} />
      <SeatingEditor
        initial={{
          id: m.id,
          name: m.name,
          width: m.width,
          height: m.height,
          zones: m.zones as { key: string; name: string; color: string }[],
          labels: (m.labels ?? []) as { text: string; x: number; y: number; w: number }[],
          seats: m.seats.map((s) => ({ x: s.x, y: s.y, kind: s.kind, zone: s.zone, accessible: s.accessible, blocked: s.blocked })),
        }}
      />
    </>
  );
}
