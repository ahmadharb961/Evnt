import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader } from "@/components/portal/shell";
import { StatusPill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty";
import { BOOKING_STATUS } from "@/lib/status";
import { fmtDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Bookings" };

export default async function MerchantBookings({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; when?: string }> }) {
  const ctx = await requireMerchant();
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const now = new Date();
  const where: Prisma.BookingWhereInput = {
    merchantId: ctx.merchant.id,
    status: sp.status ? (sp.status as Prisma.EnumBookingStatusFilter["equals"]) : { notIn: ["EXPIRED"] },
    ...(sp.when === "past" ? { session: { startsAt: { lt: now } } } : sp.when === "all" ? {} : { session: { startsAt: { gte: new Date(now.getTime() - 6 * 3600_000) } } }),
    ...(sp.q ? { OR: [{ code: { contains: sp.q.toUpperCase() } }, { contactName: { contains: sp.q, mode: "insensitive" } }, { contactPhone: { contains: sp.q.replace(/\D/g, "") || sp.q } }] } : {}),
  };
  const bookings = await prisma.booking.findMany({ where, include: { event: true, session: true, _count: { select: { tickets: true } } }, orderBy: { session: { startsAt: sp.when === "past" ? "desc" : "asc" } }, take: 200 });
  const filters: [string, string][] = [
    ["", t("Upcoming")],
    ["past", t("Past")],
    ["all", t("All")],
  ];
  return (
    <>
      <PageHeader title={t("Bookings")} />
      <form className="mb-4 flex flex-wrap gap-2">
        {filters.map(([v, l]) => (
          <Link key={v} href={`/merchant/bookings${v ? `?when=${v}` : ""}`} className={`chip ${(sp.when ?? "") === v ? "chip-on" : ""}`}>
            {l}
          </Link>
        ))}
        <input name="q" defaultValue={sp.q} placeholder={t("Search code, name or phone")} className="input !h-9 !w-60 !rounded-full !py-0 text-sm" />
        {sp.when && <input type="hidden" name="when" value={sp.when} />}
      </form>
      {bookings.length === 0 ? (
        <EmptyState title={t("No bookings here")} />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-ink/[.06] bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-canvas text-xs text-ink-muted">
              <tr>
                {[t("Code"), t("Activity"), t("Date"), t("Parent"), t("Tickets"), t("Amount"), t("Status")].map((h) => (
                  <th key={h} className="p-3 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-ink/[.06] hover:bg-canvas">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/merchant/bookings/${b.code}`} className="underline-offset-2 hover:underline">
                      {b.code}
                    </Link>
                  </td>
                  <td className="max-w-[220px] truncate p-3">{loc(b.event.title, locale)}</td>
                  <td className="p-3">{fmtDateTime(b.session.startsAt, locale)}</td>
                  <td className="p-3">
                    {b.contactName}
                    <span className="block text-xs text-ink-muted" dir="ltr">
                      +{b.contactPhone}
                    </span>
                  </td>
                  <td className="p-3">{b._count.tickets || "—"}</td>
                  <td className="p-3">{b.subtotalCents ? formatMoney(b.subtotalCents, locale) : t("Free")}</td>
                  <td className="p-3">
                    <StatusPill map={BOOKING_STATUS} status={b.status} t={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
