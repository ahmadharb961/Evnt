import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel, Stat } from "@/components/portal/shell";
import { StatusPill } from "@/components/status-pill";
import { RESERVATION_STATUS } from "@/lib/status";
import { fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Restaurants" };

export default async function ReservationsAdmin() {
  await requireAdmin("ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const since = new Date(Date.now() - 30 * 86400_000);
  const [list, completed, guests] = await Promise.all([
    prisma.restaurantReservation.findMany({ include: { restaurant: { select: { name: true } }, user: { select: { name: true } } }, orderBy: { startsAt: "desc" }, take: 200 }),
    prisma.restaurantReservation.count({ where: { status: "COMPLETED", startsAt: { gte: since } } }),
    prisma.restaurantReservation.aggregate({ where: { status: "COMPLETED", startsAt: { gte: since } }, _sum: { completedGuests: true } }),
  ]);
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("Restaurant reservations")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label={t("Completed reservations (30 days)")} value={completed} />
        <Stat label={t("Verified guests (30 days)")} value={guests._sum.completedGuests ?? 0} />
      </div>
      <Panel>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2.5">
              <span>
                {r.restaurant.name} · {r.user.name} · {r.adults + r.children} {t("guests")}
                <span className="block text-xs text-ink-muted">
                  {r.code} · {fmtDateTime(r.startsAt, locale)}
                  {r.completedGuests != null ? ` · ${t("{n} verified", { n: r.completedGuests })}` : ""}
                </span>
              </span>
              <StatusPill map={RESERVATION_STATUS} status={r.status} t={t} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
