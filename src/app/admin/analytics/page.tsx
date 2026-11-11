import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { formatMoney } from "@/lib/money";
import { areaName } from "@/lib/areas";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Analytics" };

export default async function AnalyticsAdmin({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin("ADMIN", "FINANCE");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const days = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = new Date(Date.now() - days * 86400_000);
  const [byMerchant, byCategory, byArea, byChannel, daily, funnel] = await Promise.all([
    prisma.booking.groupBy({ by: ["merchantId"], where: { status: { in: ["CONFIRMED", "COMPLETED"] }, confirmedAt: { gte: since } }, _sum: { subtotalCents: true }, _count: { _all: true }, orderBy: { _sum: { subtotalCents: "desc" } }, take: 10 }),
    prisma.$queryRaw<{ name: unknown; cents: bigint; n: bigint }[]>`
      SELECT COALESCE(p.name, c.name) AS name, SUM(b."subtotalCents") AS cents, COUNT(*) AS n FROM "Booking" b
      JOIN "Event" e ON e.id = b."eventId" JOIN "Category" c ON c.id = e."categoryId" LEFT JOIN "Category" p ON p.id = c."parentId"
      WHERE b.status IN ('CONFIRMED','COMPLETED') AND b."confirmedAt" >= ${since} GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw<{ area: string; n: bigint; cents: bigint }[]>`
      SELECT l.area, COUNT(*) AS n, SUM(b."subtotalCents") AS cents FROM "Booking" b JOIN "Event" e ON e.id = b."eventId" JOIN "MerchantLocation" l ON l.id = e."locationId"
      WHERE b.status IN ('CONFIRMED','COMPLETED') AND b."confirmedAt" >= ${since} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    prisma.booking.groupBy({ by: ["attribution", "paymentMethod"], where: { status: { in: ["CONFIRMED", "COMPLETED", "RESERVED_PAY_AT_VENUE"] }, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n FROM "Booking" WHERE status IN ('CONFIRMED','COMPLETED','RESERVED_PAY_AT_VENUE') AND "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    Promise.all([
      prisma.booking.count({ where: { createdAt: { gte: since } } }),
      prisma.booking.count({ where: { createdAt: { gte: since }, status: { in: ["CONFIRMED", "COMPLETED", "RESERVED_PAY_AT_VENUE"] } } }),
      prisma.booking.count({ where: { createdAt: { gte: since }, status: "EXPIRED" } }),
    ]),
  ]);
  const names = new Map((await prisma.merchant.findMany({ where: { id: { in: byMerchant.map((m) => m.merchantId) } }, select: { id: true, name: true } })).map((m) => [m.id, m.name]));
  const max = Math.max(1, ...daily.map((d) => Number(d.n)));
  const money = (c: number) => formatMoney(c, locale);
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title={t("Analytics")}
        actions={[7, 30, 90, 365].map((d) => (
          <Link key={d} href={`/admin/analytics?days=${d}`} className={`chip ${d === days ? "chip-on" : ""}`}>
            {t("{n} days", { n: d })}
          </Link>
        ))}
      />
      <Panel title={t("Bookings per day")}>
        <div className="flex h-36 items-end gap-1" dir="ltr">
          {daily.map((d) => (
            <div key={String(d.day)} title={`${fmtDate(d.day, locale, { day: "numeric", month: "short" })}: ${Number(d.n)}`} className="flex-1 rounded-t-md bg-powder-deep/60" style={{ height: `${(Number(d.n) / max) * 130 + 2}px` }} />
          ))}
          {!daily.length && <p className="text-sm text-ink-muted">—</p>}
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          {t("Checkout funnel: {a} started → {b} confirmed ({p}%) · {c} holds expired", { a: funnel[0], b: funnel[1], p: funnel[0] ? Math.round((funnel[1] / funnel[0]) * 100) : 0, c: funnel[2] })}
        </p>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("Top merchants")}>
          <ul className="space-y-2 text-sm">
            {byMerchant.map((m) => (
              <li key={m.merchantId} className="flex justify-between">
                <Link href={`/admin/merchants/${m.merchantId}`} className="hover:underline">
                  {names.get(m.merchantId)}
                </Link>
                <span>
                  {money(m._sum.subtotalCents ?? 0)} · {m._count._all}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("By category")}>
          <ul className="space-y-2 text-sm">
            {byCategory.map((c, i) => (
              <li key={i} className="flex justify-between">
                <span>{loc(c.name, locale)}</span>
                <span>
                  {money(Number(c.cents))} · {Number(c.n)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("By area")}>
          <ul className="space-y-2 text-sm">
            {byArea.map((a) => (
              <li key={a.area} className="flex justify-between">
                <span>{areaName(a.area, locale)}</span>
                <span>
                  {money(Number(a.cents))} · {Number(a.n)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("By channel")}>
          <ul className="space-y-2 text-sm">
            {byChannel.map((c) => (
              <li key={c.attribution + c.paymentMethod} className="flex justify-between">
                <span>
                  {c.attribution} · {c.paymentMethod}
                </span>
                <span>{c._count._all}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
