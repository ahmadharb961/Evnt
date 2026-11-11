import Link from "next/link";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel, Stat } from "@/components/portal/shell";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Billing & payouts" };

const LEDGER: Record<string, string> = { SALE: "Online sale collected by EVNT", COMMISSION: "EVNT commission", REFUND: "Refund", PAYOUT: "Payout", COD_COMMISSION: "Commission on cash you collected", ADJUSTMENT: "Adjustment" };

export default async function BillingPage() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const id = ctx.merchant.id;
  const [invoices, ledger, balance, settlements] = await Promise.all([
    prisma.invoice.findMany({ where: { merchantId: id }, orderBy: { issuedAt: "desc" }, take: 100 }),
    prisma.ledgerEntry.findMany({ where: { merchantId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.ledgerEntry.aggregate({ where: { merchantId: id, settlementId: null }, _sum: { amountCents: true } }),
    prisma.settlement.findMany({ where: { merchantId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const bal = balance._sum.amountCents ?? 0;
  const open = invoices.filter((i) => ["OPEN", "OVERDUE"].includes(i.status));
  const money = (c: number) => formatMoney(c, locale);
  const st: Record<string, string> = { OPEN: t("Open"), PAID: t("Paid"), VOID: t("Void"), OVERDUE: t("Overdue") };
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("Billing & payouts")} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={bal >= 0 ? t("EVNT owes you") : t("You owe EVNT")} value={money(Math.abs(bal))} hint={t("Unsettled balance")} />
        <Stat label={t("Open invoices")} value={open.length} hint={money(open.reduce((a, i) => a + i.totalCents, 0))} />
        <Stat label={t("Payout account")} value={<span className="text-base">{ctx.merchant.payoutAccount ? `${ctx.merchant.payoutMethod === "bank" ? t("Bank") : "Whish"} ••${ctx.merchant.payoutAccount.slice(-4)}` : t("Not set")}</span>} />
      </div>
      <Panel title={t("Invoices")}>
        {!invoices.length ? (
          <p className="text-sm text-ink-muted">{t("No invoices yet.")}</p>
        ) : (
          <ul className="divide-y divide-ink/[.06] text-sm">
            {invoices.map((i) => (
              <li key={i.id}>
                <Link href={`/merchant/billing/${i.id}`} className="flex justify-between gap-3 py-2.5 hover:underline">
                  <span>
                    {i.number} · {fmtDate(i.issuedAt, locale, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className={i.status === "OVERDUE" ? "font-semibold text-red-600" : ""}>
                    {money(i.totalCents)} · {st[i.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={t("Balance activity")}>
        {!ledger.length ? (
          <p className="text-sm text-ink-muted">{t("No activity yet.")}</p>
        ) : (
          <ul className="divide-y divide-ink/[.06] text-sm">
            {ledger.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 py-2">
                <span>
                  {t(LEDGER[l.type])}
                  <span className="block text-xs text-ink-muted">
                    {l.memo} · {fmtDate(l.createdAt, locale, { day: "numeric", month: "short" })}
                  </span>
                </span>
                <span className={l.amountCents < 0 ? "text-red-600" : "text-mint-deep"}>{money(l.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {settlements.length > 0 && (
        <Panel title={t("Settlements")}>
          <ul className="divide-y divide-ink/[.06] text-sm">
            {settlements.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span>
                  {s.number} · {s.reference}
                </span>
                <span>
                  {money(s.amountCents)} · {s.status === "PAID" ? t("Paid") : t("Pending")}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
