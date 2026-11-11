import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { platformFinancials } from "@/server/reports";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel, Stat } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { StatusPill } from "@/components/status-pill";
import { processRefundAction, recordInvoicePaymentAction, voidInvoiceAction } from "@/actions/admin";
import { PAYMENT_STATUS } from "@/lib/status";
import { formatMoney } from "@/lib/money";
import { fmtDateTime, fmtDate } from "@/lib/dates";

export const metadata = { title: "Payments & finance" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin("FINANCE");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const tab = sp.tab ?? "refunds";
  const since = new Date(Date.now() - 30 * 86400_000);
  const f = await platformFinancials(since);
  const money = (c: number) => formatMoney(c, locale);
  const [refunds, invoices, payments, cod, balances] = await Promise.all([
    prisma.refund.findMany({ where: { status: { in: ["REQUESTED", "APPROVED"] } }, include: { payment: true }, orderBy: { createdAt: "asc" } }),
    prisma.invoice.findMany({ where: { status: { in: ["OPEN", "OVERDUE"] } }, include: { merchant: { select: { name: true } } }, orderBy: { dueAt: "asc" }, take: 200 }),
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.order.findMany({ where: { paymentMethod: "COD", status: { in: ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"] } }, include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.ledgerEntry.groupBy({ by: ["merchantId"], where: { settlementId: null }, _sum: { amountCents: true } }),
  ]);
  const names = new Map((await prisma.merchant.findMany({ where: { id: { in: balances.map((b) => b.merchantId) } }, select: { id: true, name: true } })).map((m) => [m.id, m.name]));
  const tabs = [
    ["refunds", t("Refunds")],
    ["invoices", t("Unpaid invoices")],
    ["balances", t("Merchant balances")],
    ["cod", t("COD reconciliation")],
    ["payments", t("Payments")],
  ];
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("Payments & finance")} subtitle={t("Last 30 days")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Whish payments received")} value={money(f.whish.cents)} hint={t("{n} payments", { n: f.whish.count })} />
        <Stat label={t("COD collected by merchants")} value={money(f.codCollected.cents)} hint={t("{n} orders", { n: f.codCollected.count })} />
        <Stat label={t("COD not yet collected")} value={money(f.codUncollected.cents)} hint={t("Not revenue until collected")} />
        <Stat label={t("Refunds processed")} value={money(f.refunds)} />
      </div>
      <div className="flex gap-1 border-b border-ink/[.06]">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/admin/finance?tab=${k}`} className={`border-b-2 px-3 pb-3 text-sm font-medium ${tab === k ? "border-ink" : "border-transparent text-ink-muted"}`}>
            {l}
          </Link>
        ))}
      </div>
      {tab === "refunds" && (
        <Panel>
          {!refunds.length ? (
            <p className="text-sm text-ink-muted">{t("No refunds waiting.")}</p>
          ) : (
            <ul className="divide-y divide-ink/[.06] text-sm">
              {refunds.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span>
                    <b>{money(r.amountCents)}</b> · {r.reason}
                    <span className="block text-xs text-ink-muted">
                      {r.payment ? `${r.payment.method} ${r.payment.providerRef ?? r.payment.id}` : t("No online payment")} · {fmtDateTime(r.createdAt, locale)} · {r.status}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <ActionButton action={processRefundAction.bind(null, r.id, true)} className="btn-primary btn-sm" prompt={t("Refund reference (Whish refund ID or note):")}>
                      {t("Mark refunded")}
                    </ActionButton>
                    <ActionButton action={processRefundAction.bind(null, r.id, false)} className="btn-ghost btn-sm" prompt={t("Reason for declining:")}>
                      {t("Decline")}
                    </ActionButton>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      {tab === "invoices" && (
        <Panel>
          <ul className="divide-y divide-ink/[.06] text-sm">
            {invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <b>{i.number}</b> · {i.merchant.name} · {money(i.totalCents)}
                  <span className={`block text-xs ${i.status === "OVERDUE" ? "text-red-600" : "text-ink-muted"}`}>
                    {i.status} · {t("due {date}", { date: fmtDate(i.dueAt, locale, { day: "numeric", month: "short" }) })}
                  </span>
                </span>
                <span className="flex gap-2">
                  <ActionButton action={recordInvoicePaymentAction.bind(null, i.id)} className="btn-primary btn-sm" prompt={t("Payment reference (bank transfer / Whish receipt):")}>
                    {t("Record payment")}
                  </ActionButton>
                  <ActionButton action={voidInvoiceAction.bind(null, i.id)} className="btn-ghost btn-sm" prompt={t("Reason for voiding:")}>
                    {t("Void")}
                  </ActionButton>
                </span>
              </li>
            ))}
            {!invoices.length && <li className="py-3 text-ink-muted">{t("All invoices are paid.")}</li>}
          </ul>
        </Panel>
      )}
      {tab === "balances" && (
        <Panel>
          <ul className="divide-y divide-ink/[.06] text-sm">
            {balances
              .filter((b) => (b._sum.amountCents ?? 0) !== 0)
              .sort((a, b) => (a._sum.amountCents ?? 0) - (b._sum.amountCents ?? 0))
              .map((b) => (
                <li key={b.merchantId} className="flex justify-between py-2.5">
                  <Link href={`/admin/merchants/${b.merchantId}`} className="hover:underline">
                    {names.get(b.merchantId)}
                  </Link>
                  <span className={(b._sum.amountCents ?? 0) < 0 ? "text-red-600" : "text-mint-deep"}>
                    {(b._sum.amountCents ?? 0) < 0 ? t("owes EVNT {amount}", { amount: money(-(b._sum.amountCents ?? 0)) }) : t("EVNT owes {amount}", { amount: money(b._sum.amountCents ?? 0) })}
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
      )}
      {tab === "cod" && (
        <Panel>
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-muted">
              <tr>
                {[t("Order"), t("Merchant"), t("Total"), t("Status"), t("Collected")].map((h) => (
                  <th key={h} className="pb-2 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cod.map((o) => (
                <tr key={o.id} className="border-t border-ink/[.06]">
                  <td className="py-2 font-mono text-xs">{o.number}</td>
                  <td className="py-2">{o.merchant.name}</td>
                  <td className="py-2">{money(o.totalCents)}</td>
                  <td className="py-2">{o.status}</td>
                  <td className={`py-2 ${o.codCollectedAt ? "text-mint-deep" : "text-peach-deep"}`}>{o.codCollectedAt ? money(o.codCollectedCents ?? 0) : t("Not yet")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      {tab === "payments" && (
        <Panel>
          <ul className="divide-y divide-ink/[.06] text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {p.purpose} · {p.method} · {money(p.amountCents)}
                  <span className="block text-xs text-ink-muted">
                    {p.id} · {fmtDateTime(p.createdAt, locale)}
                    {p.failureReason ? ` · ${p.failureReason}` : ""}
                  </span>
                </span>
                <StatusPill map={PAYMENT_STATUS} status={p.status} t={t} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
