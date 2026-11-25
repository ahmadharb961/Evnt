import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ArrowRight, CalendarPlus, UserPlus, ShieldPlus, LayoutTemplate, Settings, Store, Megaphone, Wallet } from "lucide-react";
import { requireAdmin, hasRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { platformFinancials } from "@/server/reports";
import { getLocale, getT } from "@/i18n/server";
import { Panel, Stat } from "@/components/portal/shell";
import { BarList, Donut, StackedBars } from "@/components/admin/charts";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Admin" };

type Row = { d: Date; v: bigint | number | null };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const me = await requireAdmin();
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const days = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = new Date(Date.now() - days * 86400_000);
  const prev = new Date(since.getTime() - days * 86400_000);
  const unit = days > 90 ? "month" : days > 30 ? "week" : "day";
  const [f, fPrev, users, newUsers, newUsersPrev, merchants, members, pendingMerchants, pendingAds, refunds, bookingsByDay, ordersByDay, usersByDay, topMerchants, liveListings] = await Promise.all([
    platformFinancials(since),
    platformFinancials(prev, since),
    prisma.user.count({ where: { disabled: false } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: prev, lt: since } } }),
    prisma.merchant.groupBy({ by: ["plan"], where: { status: "APPROVED" }, _count: { _all: true } }),
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.merchant.count({ where: { status: "PENDING" } }),
    prisma.adCampaign.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.refund.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
    prisma.$queryRaw<Row[]>(Prisma.sql`SELECT date_trunc(${unit}, "confirmedAt") AS d, SUM("subtotalCents") AS v FROM "Booking" WHERE status IN ('CONFIRMED','COMPLETED') AND "confirmedAt" >= ${since} GROUP BY 1`),
    prisma.$queryRaw<Row[]>(Prisma.sql`SELECT date_trunc(${unit}, COALESCE("paidAt","codCollectedAt")) AS d, SUM("subtotalCents") AS v FROM "Order" WHERE status NOT IN ('CANCELED','REFUNDED') AND COALESCE("paidAt","codCollectedAt") >= ${since} GROUP BY 1`),
    prisma.$queryRaw<Row[]>(Prisma.sql`SELECT date_trunc(${unit}, "createdAt") AS d, COUNT(*) AS v FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1`),
    prisma.booking.groupBy({ by: ["merchantId"], where: { status: { in: ["CONFIRMED", "COMPLETED"] }, confirmedAt: { gte: since } }, _sum: { subtotalCents: true }, orderBy: { _sum: { subtotalCents: "desc" } }, take: 6 }),
    Promise.all([prisma.event.count({ where: { status: "PUBLISHED" } }), prisma.restaurant.count({ where: { status: "PUBLISHED" } }), prisma.product.count({ where: { status: "PUBLISHED" } })]),
  ]);
  const names = await prisma.merchant.findMany({ where: { id: { in: topMerchants.map((m) => m.merchantId) } }, select: { id: true, name: true } });
  const money = (c: number) => formatMoney(c, locale);
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
  const plan = (p: string) => merchants.find((m) => m.plan === p)?._count._all ?? 0;

  // Time buckets for the chart.
  const buckets: Date[] = [];
  const start = new Date(since);
  start.setUTCHours(0, 0, 0, 0);
  if (unit === "month") start.setUTCDate(1);
  if (unit === "week") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  for (const d = new Date(start); d <= new Date(); unit === "month" ? d.setUTCMonth(d.getUTCMonth() + 1) : d.setUTCDate(d.getUTCDate() + (unit === "week" ? 7 : 1))) buckets.push(new Date(d));
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const pick = (rows: Row[]) => {
    const m = new Map(rows.map((r) => [key(new Date(r.d)), Number(r.v ?? 0)]));
    return buckets.map((b) => m.get(key(b)) ?? 0);
  };
  const fmtLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-LB" : locale, unit === "month" ? { month: "short" } : { day: "numeric", month: "short" });
  const labels = buckets.map((b) => fmtLabel.format(b));
  const signups = pick(usersByDay);

  const todo = [
    { n: pendingMerchants, label: t("businesses to verify"), href: "/admin/merchants?status=PENDING", icon: Store, cls: "bg-sky-100 text-sky-900" },
    { n: pendingAds, label: t("campaigns to review"), href: "/admin/ads", icon: Megaphone, cls: "bg-peach-soft text-peach-deep" },
    { n: refunds, label: t("refunds to process"), href: "/admin/finance", icon: Wallet, cls: "bg-rose-100 text-rose-900" },
  ].filter((x) => x.n > 0);
  const quick = [
    { href: "/admin/create", label: t("New activity"), icon: CalendarPlus, cls: "bg-peach text-peach-deep" },
    { href: "/admin/users", label: t("New user"), icon: UserPlus, cls: "bg-powder text-powder-deep" },
    ...(hasRole(me, "SUPER_ADMIN") ? [{ href: "/admin/team", label: t("New admin"), icon: ShieldPlus, cls: "bg-violet-200 text-violet-800" }] : []),
    { href: "/admin/cms", label: t("Edit homepage"), icon: LayoutTemplate, cls: "bg-amber-200 text-amber-800" },
    ...(hasRole(me, "SUPER_ADMIN") ? [{ href: "/admin/settings", label: t("Settings"), icon: Settings, cls: "bg-slate-200 text-slate-700" }] : []),
  ];
  const hour = new Date().getHours();
  const hello = hour < 12 ? t("Good morning") : hour < 18 ? t("Good afternoon") : t("Good evening");
  const streams = [
    { k: "commissions", label: t("Commissions"), color: "#7d93c4" },
    { k: "subscriptions", label: t("Merchant subscriptions"), color: "#5fbf93" },
    { k: "bookingFees", label: t("Booking fees"), color: "#f4a46b" },
    { k: "memberships", label: "EVNT+", color: "#9b7be0" },
    { k: "advertising", label: t("Advertising"), color: "#d77fb3" },
    { k: "reports", label: t("Market reports"), color: "#f2b632" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-200 via-blush-soft to-peach-soft p-6 sm:p-8">
        <div aria-hidden className="absolute -end-16 -top-16 -z-10 h-56 w-56 rounded-full bg-white/50 blur-2xl" />
        <div aria-hidden className="absolute -bottom-20 start-1/3 -z-10 h-56 w-56 rounded-full bg-mint/60 blur-3xl" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-soft">
              {hello}, {me.name.split(" ")[0]} 👋
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t("Here's how EVNT is doing")}</h1>
          </div>
          <div className="flex gap-1 rounded-full bg-white/70 p-1 backdrop-blur">
            {[7, 30, 90, 365].map((d) => (
              <Link key={d} href={`/admin?days=${d}`} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${d === days ? "bg-ink text-white" : "text-ink-soft hover:bg-white"}`}>
                {d === 365 ? t("1 year") : t("{n} days", { n: d })}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {quick.map((q) => (
            <Link key={q.href + q.label} href={q.href} className="inline-flex items-center gap-2 rounded-full bg-white/85 py-1.5 pe-4 ps-1.5 text-sm font-semibold shadow-sm transition hover:bg-white hover:shadow-card">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${q.cls}`}>
                <q.icon className="h-4 w-4" />
              </span>
              {q.label}
            </Link>
          ))}
        </div>
      </div>

      {todo.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-ink-soft">{t("Needs your attention")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {todo.map((x) => (
              <Link key={x.href} href={x.href} className={`group flex items-center gap-3 rounded-3xl p-4 transition hover:shadow-card ${x.cls}`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70">
                  <x.icon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-2xl font-bold leading-none">{x.n}</span>
                  <span className="text-xs font-medium">{x.label}</span>
                </span>
                <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5 rtl:rotate-180" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("EVNT revenue")} value={money(f.gross)} trend={pct(f.gross, fPrev.gross)} hint={fPrev.gross ? t("vs previous period") : undefined} tone="violet" icon="Wallet" />
        <Stat label={t("Booking value")} value={money(f.gmv.bookings)} trend={pct(f.gmv.bookings, fPrev.gmv.bookings)} hint={t("{n} bookings", { n: f.gmv.bookingCount })} tone="mint" icon="Ticket" />
        <Stat label={t("Shop sales")} value={money(f.gmv.orders)} trend={pct(f.gmv.orders, fPrev.gmv.orders)} hint={t("{n} orders", { n: f.gmv.orderCount })} tone="blush" icon="ShoppingBag" />
        <Stat label={t("New users")} value={newUsers} trend={pct(newUsers, newUsersPrev)} hint={t("{n} in total", { n: users })} tone="sky" icon="Users" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("Sales over time")} subtitle={t("Bookings and shop sales paid in this period")} icon="BarChart3" tone="mint" className="lg:col-span-2">
          <StackedBars
            labels={labels}
            series={[
              { label: t("Bookings"), color: "#5fbf93", values: pick(bookingsByDay) },
              { label: t("Shop"), color: "#d77fb3", values: pick(ordersByDay) },
            ]}
            format={money}
            empty={t("No sales in this period yet")}
          />
        </Panel>
        <Panel title={t("Where EVNT's money comes from")} icon="Wallet" tone="violet">
          <Donut parts={streams.map((s) => ({ label: s.label, value: f.revenue[s.k], color: s.color }))} format={money} center={t("total")} empty={t("No revenue in this period yet")} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("Top businesses")} subtitle={t("By booking value")} icon="Store" tone="sky">
          <BarList rows={topMerchants.map((m) => ({ label: names.find((n) => n.id === m.merchantId)?.name ?? "—", value: m._sum.subtotalCents ?? 0, href: `/admin/merchants/${m.merchantId}` }))} format={money} color="#4fb0e0" empty={t("No bookings in this period yet")} />
        </Panel>
        <Panel title={t("New sign-ups")} icon="UserPlus" tone="powder">
          <StackedBars labels={labels} series={[{ label: t("New users"), color: "#7d93c4", values: signups }]} format={(n) => String(n)} empty={t("No new sign-ups in this period")} />
        </Panel>
        <Panel title={t("Marketplace")} icon="Sparkles" tone="peach">
          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              [liveListings[0], t("Live activities"), "bg-peach-soft text-peach-deep"],
              [liveListings[1], t("Live restaurants"), "bg-mint-soft text-mint-deep"],
              [liveListings[2], t("Live products"), "bg-blush-soft text-blush-deep"],
              [members, t("EVNT+ members"), "bg-violet-50 text-violet-800"],
            ].map(([n, l, cls]) => (
              <div key={String(l)} className={`rounded-2xl p-3 ${cls}`}>
                <p className="text-2xl font-bold">{n}</p>
                <p className="text-[11px] font-medium">{l}</p>
              </div>
            ))}
          </div>
          <p className="mb-2 mt-4 text-xs font-semibold text-ink-soft">{t("Businesses by plan")}</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-canvas">
            {[
              { p: "FEATURED", c: "#9b7be0" },
              { p: "PRO", c: "#4fb0e0" },
              { p: "BASIC", c: "#cbd5e1" },
            ].map(({ p, c }) => (
              <div key={p} style={{ flexGrow: plan(p), background: c }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-soft">
            <span>
              <b className="text-violet-700">●</b> Featured {plan("FEATURED")}
            </span>
            <span>
              <b className="text-sky-600">●</b> Pro {plan("PRO")}
            </span>
            <span>
              <b className="text-slate-400">●</b> Basic {plan("BASIC")}
            </span>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("Refunds processed")} value={money(f.refunds)} tone="rose" icon="Receipt" />
        <Stat label={t("Cash on delivery not yet collected")} value={money(f.codUncollected.cents)} hint={t("{n} orders — not counted as revenue", { n: f.codUncollected.count })} tone="amber" icon="ShoppingBag" />
        <Stat label={t("Paying businesses")} value={plan("PRO") + plan("FEATURED")} hint={t("{n} on the free plan", { n: plan("BASIC") })} tone="emerald" icon="Crown" />
      </div>
      <p className="text-xs text-ink-muted">{t("Actual money received in the period. Unpaid invoices, pending payments and uncollected cash are excluded.")}</p>
    </div>
  );
}
