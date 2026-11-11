import Link from "next/link";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { merchantFeatures } from "@/server/features";
import { merchantKpis } from "@/server/analytics";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel, Stat } from "@/components/portal/shell";
import { formatMoney } from "@/lib/money";
import { areaName } from "@/lib/areas";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await requireMerchant();
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const days = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = new Date(Date.now() - days * 86400_000);
  const m = ctx.merchant;
  const f = await merchantFeatures(m);
  const k = await merchantKpis(m.id, since);
  const money = (c: number) => formatMoney(c, locale);
  // Daily series (bookings revenue) — simple bars, no chart library.
  const daily = await prisma.$queryRaw<{ day: Date; cents: bigint; n: bigint }[]>`
    SELECT date_trunc('day', "confirmedAt") AS day, COALESCE(SUM("subtotalCents"),0) AS cents, COUNT(*) AS n
    FROM "Booking" WHERE "merchantId" = ${m.id} AND status IN ('CONFIRMED','COMPLETED') AND "confirmedAt" >= ${since}
    GROUP BY 1 ORDER BY 1`;
  const max = Math.max(1, ...daily.map((d) => Number(d.cents)));
  const [topListings, sources, areas] = f.advancedAnalytics
    ? await Promise.all([
        prisma.booking.groupBy({ by: ["eventId"], where: { merchantId: m.id, status: { in: ["CONFIRMED", "COMPLETED"] }, confirmedAt: { gte: since } }, _sum: { subtotalCents: true }, _count: { _all: true }, orderBy: { _sum: { subtotalCents: "desc" } }, take: 5 }),
        prisma.booking.groupBy({ by: ["attribution"], where: { merchantId: m.id, status: { in: ["CONFIRMED", "COMPLETED"] }, confirmedAt: { gte: since } }, _count: { _all: true } }),
        f.demandIntelligence
          ? prisma.$queryRaw<{ area: string; n: bigint }[]>`SELECT o.area, COUNT(*) AS n FROM "Order" o WHERE o."merchantId" = ${m.id} AND o."createdAt" >= ${since} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`
          : Promise.resolve([]),
      ])
    : [[], [], []];
  const titles = topListings.length ? new Map((await prisma.event.findMany({ where: { id: { in: topListings.map((x) => x.eventId) } }, select: { id: true, title: true } })).map((e) => [e.id, loc(e.title, locale)])) : new Map();
  const srcLabel: Record<string, string> = { EVNT: t("EVNT"), EVNT_EXTERNAL: t("EVNT (completed directly)"), MERCHANT_LINK: t("Your own link") };
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={t("Analytics")}
        actions={[7, 30, 90, 365].map((d) => (
          <Link key={d} href={`/merchant/analytics?days=${d}`} className={`chip ${d === days ? "chip-on" : ""}`}>
            {t("{n} days", { n: d })}
          </Link>
        ))}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Revenue")} value={money(k.revenueCents)} />
        <Stat label={t("Bookings")} value={k.bookings} />
        <Stat label={t("Views")} value={k.views} />
        <Stat label={t("Conversion rate")} value={`${k.conversionPct}%`} />
      </div>
      <Panel title={t("Daily booking revenue")}>
        {daily.length ? (
          <div className="flex h-40 items-end gap-1" dir="ltr">
            {daily.map((d) => (
              <div key={String(d.day)} className="group relative flex-1">
                <div className="rounded-t-md bg-mint-deep/70 transition group-hover:bg-mint-deep" style={{ height: `${(Number(d.cents) / max) * 150 + 2}px` }} />
                <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-white group-hover:block">
                  {fmtDate(d.day, locale, { day: "numeric", month: "short" })}: {money(Number(d.cents))} ({Number(d.n)})
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{t("No bookings in this period.")}</p>
        )}
      </Panel>
      {f.advancedAnalytics ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t("Top listings")}>
            <ul className="space-y-2 text-sm">
              {topListings.map((x) => (
                <li key={x.eventId} className="flex justify-between gap-3">
                  <span className="truncate">{titles.get(x.eventId)}</span>
                  <span>
                    {money(x._sum.subtotalCents ?? 0)} · {x._count._all}
                  </span>
                </li>
              ))}
              {!topListings.length && <li className="text-ink-muted">—</li>}
            </ul>
          </Panel>
          <Panel title={t("Where bookings come from")}>
            <ul className="space-y-2 text-sm">
              {sources.map((s) => (
                <li key={s.attribution} className="flex justify-between">
                  <span>{srcLabel[s.attribution]}</span>
                  <span>{s._count._all}</span>
                </li>
              ))}
              {!sources.length && <li className="text-ink-muted">—</li>}
            </ul>
          </Panel>
          {f.demandIntelligence && (
            <Panel title={t("Demand by area (orders)")}>
              <ul className="space-y-2 text-sm">
                {areas.map((a) => (
                  <li key={a.area} className="flex justify-between">
                    <span>{areaName(a.area, locale)}</span>
                    <span>{Number(a.n)}</span>
                  </li>
                ))}
                {!areas.length && <li className="text-ink-muted">—</li>}
              </ul>
            </Panel>
          )}
        </div>
      ) : (
        <Panel>
          <p className="text-sm">{t("Top listings, booking sources and sales reports are part of the Pro plan. Demand intelligence comes with Featured.")}</p>
          <Link href="/merchant/subscription" className="btn-primary btn-sm mt-3">
            {t("See plans")}
          </Link>
        </Panel>
      )}
    </div>
  );
}
