import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { platformFinancials } from "@/server/reports";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel, Stat } from "@/components/portal/shell";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Admin" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const days = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = new Date(Date.now() - days * 86400_000);
  const prev = new Date(since.getTime() - days * 86400_000);
  const [f, fPrev, users, newUsers, merchants, members, pendingMerchants, pendingAds, refunds, farah] = await Promise.all([
    platformFinancials(since),
    platformFinancials(prev, since),
    prisma.user.count({ where: { disabled: false } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.merchant.groupBy({ by: ["plan"], where: { status: "APPROVED" }, _count: { _all: true } }),
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.merchant.count({ where: { status: "PENDING" } }),
    prisma.adCampaign.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.refund.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
    prisma.certification.count({ where: { status: { in: ["PAID", "ASSESSED"] } } }),
  ]);
  const money = (c: number) => formatMoney(c, locale);
  const growth = fPrev.gross ? Math.round(((f.gross - fPrev.gross) / fPrev.gross) * 100) : null;
  const plan = (p: string) => merchants.find((m) => m.plan === p)?._count._all ?? 0;
  const todo = [
    { n: pendingMerchants, label: t("businesses to verify"), href: "/admin/merchants?status=PENDING" },
    { n: pendingAds, label: t("campaigns to review"), href: "/admin/ads" },
    { n: refunds, label: t("refunds to process"), href: "/admin/finance" },
    { n: farah, label: t("Farah Approved applications to action"), href: "/admin/farah" },
  ].filter((x) => x.n > 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Platform overview")}
        actions={[7, 30, 90, 365].map((d) => (
          <Link key={d} href={`/admin?days=${d}`} className={`chip ${d === days ? "chip-on" : ""}`}>
            {t("{n} days", { n: d })}
          </Link>
        ))}
      />
      {todo.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {todo.map((x) => (
            <Link key={x.href} href={x.href} className="rounded-full bg-peach-soft px-4 py-2 text-sm font-semibold text-peach-deep">
              {x.n} {x.label} →
            </Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("EVNT gross revenue")} value={money(f.gross)} hint={growth != null ? t("{n}% vs previous period", { n: growth }) : undefined} />
        <Stat label={t("Booking value (GMV)")} value={money(f.gmv.bookings)} hint={t("{n} bookings", { n: f.gmv.bookingCount })} />
        <Stat label={t("Shop value (collected)")} value={money(f.gmv.orders)} hint={t("{n} orders", { n: f.gmv.orderCount })} />
        <Stat label={t("Refunds processed")} value={money(f.refunds)} />
        <Stat label={t("Users")} value={users} hint={t("+{n} new", { n: newUsers })} />
        <Stat label={t("Paying merchants")} value={plan("PRO") + plan("FEATURED")} hint={`Pro ${plan("PRO")} · Featured ${plan("FEATURED")} · Basic ${plan("BASIC")}`} />
        <Stat label={t("EVNT+ members")} value={members} />
        <Stat label={t("COD not yet collected")} value={money(f.codUncollected.cents)} hint={t("{n} orders — not counted as revenue", { n: f.codUncollected.count })} />
      </div>
      <Panel title={t("Revenue by stream")}>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {(
            [
              ["subscriptions", t("Merchant subscriptions")],
              ["commissions", t("Commissions")],
              ["bookingFees", t("Booking fees")],
              ["memberships", "EVNT+"],
              ["advertising", t("Advertising")],
              ["leads", t("Birthday Radar leads")],
              ["certifications", t("Farah Approved")],
              ["reports", t("Market reports")],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="flex justify-between rounded-2xl bg-canvas px-4 py-3">
              <span>{l}</span>
              <b>{money(f.revenue[k])}</b>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-muted">{t("Actual money received in the period. Unpaid invoices, pending payments and uncollected cash are excluded.")}</p>
      </Panel>
    </div>
  );
}
