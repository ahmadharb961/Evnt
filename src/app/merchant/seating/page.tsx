import Link from "next/link";
import { Plus, Armchair } from "lucide-react";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { EmptyState } from "@/components/empty";
import { ActionButton } from "@/components/portal/action-button";
import { deleteSeatingMapAction } from "@/actions/seating";

export const metadata = { title: "Seating maps" };

export default async function SeatingList() {
  const ctx = await requireMerchant();
  const t = await getT();
  const maps = await prisma.seatingMap.findMany({ where: { merchantId: ctx.merchant.id }, include: { _count: { select: { seats: true, events: true } } }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader
        title={t("Seating maps")}
        subtitle={t("Build a map of seats, tables, spots or stations once and reuse it for any listing.")}
        actions={
          <Link href="/merchant/seating/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            {t("New map")}
          </Link>
        }
      />
      {maps.length === 0 ? (
        <EmptyState icon={Armchair} title={t("No seating maps yet")} body={t("Only needed if parents should pick specific seats or spots. Ticket quantities work without a map.")} cta={{ href: "/merchant/seating/new", label: t("Create a map") }} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((m) => (
            <div key={m.id} className="rounded-3xl border border-ink/[.06] bg-white p-5">
              <p className="font-semibold">{m.name}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {t("{n} places", { n: m._count.seats })} · {t("Used by {n} listings", { n: m._count.events })}
              </p>
              <div className="mt-4 flex gap-2">
                <Link href={`/merchant/seating/${m.id}`} className="btn-outline btn-sm">
                  {t("Edit")}
                </Link>
                {m._count.events === 0 && (
                  <ActionButton action={deleteSeatingMapAction.bind(null, m.id)} className="btn-ghost btn-sm" confirm={t("Delete this map?")}>
                    {t("Delete")}
                  </ActionButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
