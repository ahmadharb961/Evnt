import Link from "next/link";
import { requireMerchant } from "@/server/auth";
import { merchantKpis } from "@/server/analytics";
import { activeSubscription } from "@/server/billing";
import { prisma } from "@/server/db";
import { appUrl } from "@/server/urls";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel, Stat } from "@/components/portal/shell";
import { StatusPill } from "@/components/status-pill";
import { formatMoney } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";
import { BOOKING_STATUS } from "@/lib/status";
import { CopyText } from "@/components/copy-text";

export const metadata = { title: "Merchant dashboard" };

export default async function MerchantHome({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await requireMerchant();
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = new Date(Date.now() - days * 86400_000);
  const m = ctx.merchant;
  const [k, sub, recent] = await Promise.all([
    merchantKpis(m.id, since),
    activeSubscription(m.id),
    prisma.booking.findMany({ where: { merchantId: m.id, status: { not: "EXPIRED" } }, include: { event: true, session: true }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const money = (c: number) => formatMoney(c, locale);
  return (
    <>
      <PageHeader
        title={t("Hello, {name}", { name: ctx.user.name.split(" ")[0] })}
        subtitle={t("Here's how {business} is doing.", { business: m.name })}
        actions={[7, 30, 90].map((d) => (
          <Link key={d} href={`/merchant?days=${d}`} className={`chip ${d === days ? "chip-on" : ""}`}>
            {t("{n} days", { n: d })}
          </Link>
        ))}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Total revenue")} value={money(k.revenueCents)} hint={t("Paid bookings & collected orders")} />
        <Stat label={t("EVNT-generated revenue")} value={money(k.evntRevenueCents)} />
        <Stat label={t("Bookings")} value={k.bookings} />
        <Stat label={t("Product orders")} value={k.orders} />
        <Stat label={t("Leads & quote requests")} value={k.leads} />
        <Stat label={t("Profile & listing views")} value={k.views} />
        <Stat label={t("Conversion rate")} value={`${k.conversionPct}%`} />
        <Stat label={k.commissionPayableCents ? t("Commission payable") : t("Payout due to you")} value={money(k.commissionPayableCents || k.payoutDueCents)} />
      </div>

      <div className="mt-6 grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title={t("Latest bookings")} actions={<Link href="/merchant/bookings" className="text-sm font-semibold">{t("See all")}</Link>}>
          {recent.length ? (
            <ul className="divide-y divide-ink/[.06]">
              {recent.map((b) => (
                <li key={b.id}>
                  <Link href={`/merchant/bookings/${b.code}`} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{loc(b.event.title, locale)}</span>
                      <span className="text-xs text-ink-muted">
                        {b.contactName} · {fmtDateTime(b.session.startsAt, locale)}
                      </span>
                    </span>
                    <StatusPill map={BOOKING_STATUS} status={b.status} t={t} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">{t("No bookings yet. Publish an activity to start receiving bookings.")}</p>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title={t("Your plan")}>
            <p className="text-lg font-bold">{m.plan === "BASIC" ? "Basic" : m.plan === "PRO" ? "Pro" : "Featured"}</p>
            {sub && sub.plan !== "BASIC" && (
              <p className="mt-1 text-sm text-ink-muted">
                {sub.status === "TRIALING" ? t("Free trial until {date}", { date: fmtDateTime(sub.currentPeriodEnd, locale) }) : t("Renews {date}", { date: fmtDateTime(sub.currentPeriodEnd, locale) })}
              </p>
            )}
            <Link href="/merchant/subscription" className="btn-soft btn-sm mt-4">
              {t("Manage plan")}
            </Link>
          </Panel>
          <Panel title={t("Your EVNT link")}>
            <p className="text-sm text-ink-muted">{t("Share it with your own customers: bookings that come through it are commission-free.")}</p>
            <CopyText text={`${appUrl()}/r/${m.attributionCode}`} />
          </Panel>
          <Panel title={t("Advertising")}>
            <p className="text-sm">
              {t("{i} impressions · {c} clicks", { i: k.adImpressions, c: k.adClicks })}
            </p>
            <Link href="/merchant/ads" className="btn-soft btn-sm mt-3">
              {t("Promote your business")}
            </Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
