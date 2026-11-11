import { notFound } from "next/navigation";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { whishAvailable } from "@/server/payments";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { PrintButton } from "@/components/print-button";
import { payInvoiceAction } from "@/actions/merchant-growth";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { lines: true, payments: { where: { status: "SUCCEEDED" } } } });
  if (!inv || inv.merchantId !== ctx.merchant.id) notFound();
  const whish = await whishAvailable();
  const payable = ["OPEN", "OVERDUE"].includes(inv.status);
  const st: Record<string, string> = { OPEN: t("Open"), PAID: t("Paid"), VOID: t("Void"), OVERDUE: t("Overdue") };
  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`${t("Invoice")} ${inv.number}`}
        subtitle={st[inv.status]}
        actions={
          <>
            <PrintButton label={t("Print / PDF")} />
            {payable && whish && ctx.staffRole === "OWNER" && (
              <ActionButton action={payInvoiceAction.bind(null, inv.id)} className="btn-primary btn-sm">
                {t("Pay {amount} with Whish", { amount: formatMoney(inv.totalCents, locale) })}
              </ActionButton>
            )}
          </>
        }
      />
      <Panel>
        <div className="flex justify-between text-sm">
          <div>
            <p className="font-bold">EVNT</p>
            <p className="text-ink-muted">evnt.co</p>
          </div>
          <div className="text-end">
            <p className="font-semibold">{ctx.merchant.name}</p>
            <p className="text-ink-muted">
              {t("Issued")} {fmtDate(inv.issuedAt, locale, { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <p className="text-ink-muted">
              {t("Due")} {fmtDate(inv.dueAt, locale, { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
        <table className="mt-6 w-full text-sm">
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.id} className="border-t border-ink/[.06]">
                <td className="py-2.5">{l.description}</td>
                <td className="py-2.5 text-end">{formatMoney(l.amountCents, locale)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-ink/20 font-bold">
              <td className="py-3">{t("Total")}</td>
              <td className="py-3 text-end">{formatMoney(inv.totalCents, locale)}</td>
            </tr>
          </tbody>
        </table>
        {inv.paidAt && <p className="mt-3 text-sm text-mint-deep">{t("Paid on {date}", { date: fmtDate(inv.paidAt, locale, { day: "numeric", month: "short", year: "numeric" }) })}</p>}
        {payable && !whish && <p className="mt-4 rounded-2xl bg-canvas p-3 text-sm">{t("Pay by bank transfer or Whish to EVNT and send us the reference. Our finance team will record the payment.")}</p>}
      </Panel>
    </div>
  );
}
