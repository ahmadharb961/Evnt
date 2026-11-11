import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { resolveDisputeAction } from "@/actions/admin";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Commissions" };

export default async function CommissionsAdmin() {
  await requireAdmin("FINANCE");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const [recent, disputes, byAttr, external] = await Promise.all([
    prisma.commission.findMany({ include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.commissionDispute.findMany({ where: { status: "OPEN" }, include: { commission: { include: { merchant: { select: { name: true } } } } } }),
    prisma.commission.groupBy({ by: ["attribution"], where: { status: { in: ["EARNED", "INVOICED", "SETTLED"] } }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.externalBooking.findMany({ include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const money = (c: number) => formatMoney(c, locale);
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("Commissions")} subtitle={t("Rates are set in Plans & pricing. External bookings are recorded from a merchant's page (contact clicks within 72 hours).")} />
      <div className="grid gap-3 sm:grid-cols-3">
        {byAttr.map((a) => (
          <div key={a.attribution} className="rounded-3xl border border-ink/[.06] bg-white p-5">
            <p className="text-xs text-ink-muted">{a.attribution}</p>
            <p className="mt-1 text-2xl font-bold">{money(a._sum.amountCents ?? 0)}</p>
            <p className="text-xs text-ink-muted">{t("{n} transactions", { n: a._count._all })}</p>
          </div>
        ))}
      </div>
      <Panel title={t("Open disputes")}>
        {!disputes.length ? (
          <p className="text-sm text-ink-muted">{t("No open disputes.")}</p>
        ) : (
          <ul className="divide-y divide-ink/[.06] text-sm">
            {disputes.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  {d.commission.merchant.name} · {money(d.commission.amountCents)} · {d.reason}
                </span>
                <span className="flex gap-2">
                  <ActionButton action={resolveDisputeAction.bind(null, d.id, true)} className="btn-primary btn-sm" prompt={t("Resolution note:")}>
                    {t("Uphold (reverse)")}
                  </ActionButton>
                  <ActionButton action={resolveDisputeAction.bind(null, d.id, false)} className="btn-ghost btn-sm" prompt={t("Why is the commission kept?")}>
                    {t("Reject")}
                  </ActionButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {external.length > 0 && (
        <Panel title={t("Verified external bookings")}>
          <ul className="divide-y divide-ink/[.06] text-sm">
            {external.map((e) => (
              <li key={e.id} className="flex justify-between py-2">
                <span>
                  {e.merchant.name} · {e.category}
                </span>
                <span>
                  {money(e.amountCents)} · {fmtDate(e.bookedAt, locale, { day: "numeric", month: "short" })} · {e.status}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title={t("Latest commissions")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-xs text-ink-muted">
              <tr>
                {[t("Merchant"), t("Source"), t("Category"), t("Plan"), t("Attribution"), t("Rate"), t("Base"), t("Commission"), t("Status")].map((h) => (
                  <th key={h} className="pb-2 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id} className="border-t border-ink/[.06]">
                  <td className="py-2">{c.merchant.name}</td>
                  <td className="py-2">{c.source}</td>
                  <td className="py-2 text-xs">{c.category ?? "—"}</td>
                  <td className="py-2">{c.plan}</td>
                  <td className="py-2 text-xs">{c.attribution}</td>
                  <td className="py-2">{c.source === "RESERVATION" ? t("{n} guests", { n: c.guests ?? 0 }) : `${c.rateBps / 100}%`}</td>
                  <td className="py-2">{c.baseCents ? money(c.baseCents) : "—"}</td>
                  <td className="py-2 font-semibold">
                    {money(c.amountCents)}
                    {c.leadCreditCents > 0 && <span className="block text-xs font-normal text-ink-muted">{t("lead credit {amount}", { amount: money(c.leadCreditCents) })}</span>}
                  </td>
                  <td className="py-2 text-xs">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
