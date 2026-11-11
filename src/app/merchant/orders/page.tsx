import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { StatusPill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty";
import { ORDER_STATUS } from "@/lib/status";
import { fmtDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Orders" };

export default async function MerchantOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireMerchant();
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const status = Object.keys(ORDER_STATUS).includes(sp.status ?? "") ? (sp.status as OrderStatus) : undefined;
  const orders = await prisma.order.findMany({ where: { merchantId: ctx.merchant.id, ...(status ? { status } : { status: { not: "AWAITING_PAYMENT" } }) }, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title={t("Orders")} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/merchant/orders" className={`chip ${!status ? "chip-on" : ""}`}>
          {t("All")}
        </Link>
        {(["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELED"] as OrderStatus[]).map((s) => (
          <Link key={s} href={`/merchant/orders?status=${s}`} className={`chip ${status === s ? "chip-on" : ""}`}>
            {t(ORDER_STATUS[s].label)}
          </Link>
        ))}
      </div>
      {orders.length === 0 ? (
        <EmptyState title={t("No orders here")} />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-ink/[.06] bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-canvas text-xs text-ink-muted">
              <tr>
                {[t("Order"), t("Date"), t("Customer"), t("Items"), t("Total"), t("Payment"), t("Status")].map((h) => (
                  <th key={h} className="p-3 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-ink/[.06] hover:bg-canvas">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/merchant/orders/${o.number}`} className="hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="p-3">{fmtDateTime(o.createdAt, locale)}</td>
                  <td className="p-3">{o.customerName}</td>
                  <td className="p-3">{o._count.items}</td>
                  <td className="p-3">{formatMoney(o.totalCents, locale)}</td>
                  <td className="p-3">{o.paymentMethod === "COD" ? t("Cash") : "Whish"}</td>
                  <td className="p-3">
                    <StatusPill map={ORDER_STATUS} status={o.status} t={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
