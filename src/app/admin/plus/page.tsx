import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel, Stat } from "@/components/portal/shell";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "EVNT+" };

export default async function PlusAdmin() {
  await requireAdmin("ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const since = new Date(Date.now() - 30 * 86400_000);
  const [active, cancelling, revenue, list] = await Promise.all([
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.membership.count({ where: { status: "ACTIVE", cancelAtPeriodEnd: true } }),
    prisma.payment.aggregate({ where: { purpose: "MEMBERSHIP", status: "SUCCEEDED", confirmedAt: { gte: since } }, _sum: { amountCents: true } }),
    prisma.membership.findMany({ include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { startedAt: "desc" }, take: 200 }),
  ]);
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="EVNT+" subtitle={t("Prices are in Platform settings. Grant memberships from a user's page.")} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("Active members")} value={active} />
        <Stat label={t("Cancelling at period end")} value={cancelling} />
        <Stat label={t("Membership revenue (30 days)")} value={formatMoney(revenue._sum.amountCents ?? 0, locale)} />
      </div>
      <Panel>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {list.map((m) => (
            <li key={m.id} className="flex justify-between py-2">
              <Link href={`/admin/users/${m.user.id}`} className="hover:underline">
                {m.user.name} <span className="text-xs text-ink-muted">{m.user.email}</span>
              </Link>
              <span className="text-ink-muted">
                {m.status} · {m.interval} · {m.priceCents ? formatMoney(m.priceCents, locale) : t("granted")} · {m.currentPeriodEnd ? fmtDate(m.currentPeriodEnd, locale, { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
