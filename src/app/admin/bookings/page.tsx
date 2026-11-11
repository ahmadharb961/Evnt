import type { BookingStatus } from "@prisma/client";
import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader } from "@/components/portal/shell";
import { StatusPill } from "@/components/status-pill";
import { BOOKING_STATUS } from "@/lib/status";
import { fmtDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Bookings" };

export default async function BookingsAdmin({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin("ADMIN");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const status = Object.keys(BOOKING_STATUS).includes(sp.status ?? "") ? (sp.status as BookingStatus) : undefined;
  const [bookings, scans] = await Promise.all([
    prisma.booking.findMany({
      where: { ...(status ? { status } : {}), ...(sp.q ? { OR: [{ code: { contains: sp.q.toUpperCase() } }, { contactEmail: { contains: sp.q, mode: "insensitive" } }] } : {}) },
      include: { event: true, session: true, merchant: { select: { name: true } }, items: true, _count: { select: { tickets: { where: { status: "USED" } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.ticket.count({ where: { scannedAt: { gt: new Date(Date.now() - 86400_000) } } }),
  ]);
  return (
    <div className="max-w-6xl">
      <PageHeader title={t("Bookings")} subtitle={t("{n} tickets scanned in the last 24h", { n: scans })} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/bookings" className={`chip ${!status ? "chip-on" : ""}`}>
          {t("All")}
        </Link>
        {Object.keys(BOOKING_STATUS).map((s) => (
          <Link key={s} href={`/admin/bookings?status=${s}`} className={`chip ${status === s ? "chip-on" : ""}`}>
            {t(BOOKING_STATUS[s].label)}
          </Link>
        ))}
        <input name="q" defaultValue={sp.q} placeholder={t("Code or email")} className="input !h-9 !w-48 !rounded-full !py-0 text-sm" />
      </form>
      <div className="overflow-x-auto rounded-3xl border border-ink/[.06] bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-canvas text-xs text-ink-muted">
            <tr>
              {[t("Code"), t("Activity"), t("Merchant"), t("Session"), t("Seats"), t("Total"), t("Payment"), t("Source"), t("Checked in"), t("Status")].map((h) => (
                <th key={h} className="p-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-ink/[.06]">
                <td className="p-3 font-mono text-xs">{b.code}</td>
                <td className="max-w-[200px] truncate p-3">{loc(b.event.title, locale)}</td>
                <td className="p-3">{b.merchant.name}</td>
                <td className="p-3">{fmtDateTime(b.session.startsAt, locale)}</td>
                <td className="p-3 text-xs">{b.items.flatMap((i) => i.seatIds).length || "—"}</td>
                <td className="p-3">{formatMoney(b.totalCents, locale)}</td>
                <td className="p-3 text-xs">{b.paymentMethod}</td>
                <td className="p-3 text-xs">{b.attribution}</td>
                <td className="p-3">{b._count.tickets}</td>
                <td className="p-3">
                  <StatusPill map={BOOKING_STATUS} status={b.status} t={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
