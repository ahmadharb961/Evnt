import Link from "next/link";
import { ATTRIBUTION, PAYMENT_METHOD, labelOf } from "@/lib/status";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel, Stat } from "@/components/portal/shell";
import { BarList, Donut, StackedBars } from "@/components/admin/charts";
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
  const dayMap = new Map(daily.map((d) => [new Date(d.day).toISOString().slice(0, 10), Number(d.n)]));
  const dayKeys: Date[] = [];
  for (let d = new Date(since); d <= new Date(); d = new Date(d.getTime() + 86400_000)) dayKeys.push(d);
  const dayLabels = dayKeys.map((d) => fmtDate(d, locale, { day: "numeric", month: "short" }));
  const dayValues = dayKeys.map((d) => dayMap.get(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10)) ?? 0);
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
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={t("Checkouts started")} value={funnel[0]} tone="sky" icon="Ticket" />
        <Stat label={t("Bookings confirmed")} value={funnel[1]} hint={t("{p}% of checkouts", { p: funnel[0] ? Math.round((funnel[1] / funnel[0]) * 100) : 0 })} tone="mint" icon="BadgeCheck" />
        <Stat label={t("Holds expired")} value={funnel[2]} hint={t("Families who didn't finish paying in time")} tone="rose" icon="Bell" />
      </div>
      <Panel title={t("Bookings per day")} icon="BarChart3" tone="powder" className="mb-6">
        <StackedBars labels={dayLabels} series={[{ label: t("Bookings"), color: "#7d93c4", values: dayValues }]} format={(n) => String(n)} empty={t("No bookings in this period yet")} />
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("Top merchants")} icon="Store" tone="sky">
          <BarList rows={byMerchant.map((m) => ({ label: `${names.get(m.merchantId) ?? "—"} · ${m._count._all}`, value: m._sum.subtotalCents ?? 0, href: `/admin/merchants/${m.merchantId}` }))} format={money} color="#4fb0e0" empty={t("No bookings in this period yet")} />
        </Panel>
        <Panel title={t("By category")} icon="CalendarDays" tone="peach">
          <BarList rows={byCategory.map((c) => ({ label: `${loc(c.name as never, locale)} · ${Number(c.n)}`, value: Number(c.cents) }))} format={money} color="#f4a46b" empty={t("No bookings in this period yet")} />
        </Panel>
        <Panel title={t("By area")} icon="Home" tone="emerald">
          <BarList rows={byArea.map((a) => ({ label: `${areaName(a.area, locale)} · ${Number(a.n)}`, value: Number(a.cents) }))} format={money} color="#34b37e" empty={t("No bookings in this period yet")} />
        </Panel>
        <Panel title={t("By channel")} icon="Megaphone" tone="blush">
          <Donut
            parts={byChannel.map((c, i) => ({ label: `${t(labelOf(ATTRIBUTION, c.attribution))} · ${t(labelOf(PAYMENT_METHOD, c.paymentMethod))}`, value: c._count._all, color: ["#d77fb3", "#7d93c4", "#5fbf93", "#f2b632", "#9b7be0", "#ee6f86"][i % 6] }))}
            format={(n) => String(n)}
            center={t("bookings")}
            empty={t("No bookings in this period yet")}
          />
        </Panel>
      </div>
    </div>
  );
}
