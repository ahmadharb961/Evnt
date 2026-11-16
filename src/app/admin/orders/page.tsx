import type { OrderStatus } from "@prisma/client";
import { PAYMENT_METHOD } from "@/lib/status";
import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { FilterCards } from "@/components/admin/filter-cards";
import { StatusPill } from "@/components/status-pill";
import { ActionButton } from "@/components/portal/action-button";
import { adminOrderStatusAction } from "@/actions/admin-ops";
import { ORDER_STATUS } from "@/lib/status";
import { fmtDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Shop orders" };

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin("ADMIN");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const status = Object.keys(ORDER_STATUS).includes(sp.status ?? "") ? (sp.status as OrderStatus) : undefined;
  const counts = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
  const orders = await prisma.order.findMany({ where: status ? { status } : {}, include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div className="max-w-6xl">
      <PageHeader title={t("Shop orders")} />
      <FilterCards
        items={[
          { href: "/admin/orders", label: t("All"), value: counts.reduce((a, c) => a + c._count._all, 0), tone: "violet", on: !status },
          ...(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELED"] as const).map((s, i) => ({
            href: `/admin/orders?status=${s}`,
            label: t(ORDER_STATUS[s].label),
            value: counts.find((c) => c.status === s)?._count._all ?? 0,
            tone: (["peach", "sky", "blush", "mint", "rose"] as const)[i],
            on: status === s,
          })),
        ]}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["AWAITING_PAYMENT", "PREPARING", "REFUNDED"] as const).map((s) => (
          <Link key={s} href={`/admin/orders?status=${s}`} className={`chip ${status === s ? "chip-on" : ""}`}>
            {t(ORDER_STATUS[s].label)}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-3xl border border-ink/[.06] bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-canvas text-xs text-ink-muted">
            <tr>
              {[t("Order"), t("Merchant"), t("Customer"), t("Date"), t("Total"), t("Payment"), t("Status"), ""].map((h) => (
                <th key={h} className="p-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-ink/[.06]">
                <td className="p-3 font-mono text-xs">{o.number}</td>
                <td className="p-3">{o.merchant.name}</td>
                <td className="p-3">
                  {o.customerName}
                  <span className="block text-xs text-ink-muted" dir="ltr">
                    +{o.phone}
                  </span>
                </td>
                <td className="p-3">{fmtDateTime(o.createdAt, locale)}</td>
                <td className="p-3">{formatMoney(o.totalCents, locale)}</td>
                <td className="p-3 text-xs">
                  <StatusPill map={PAYMENT_METHOD} status={o.paymentMethod} t={t} />
                  {o.codCollectedAt ? ` ✓ ${formatMoney(o.codCollectedCents ?? 0, locale)}` : ""}
                </td>
                <td className="p-3">
                  <StatusPill map={ORDER_STATUS} status={o.status} t={t} />
                </td>
                <td className="p-3">
                  {!["CANCELED", "REFUNDED", "DELIVERED"].includes(o.status) && (
                    <ActionButton action={adminOrderStatusAction.bind(null, o.number, "CANCELED")} className="btn-ghost btn-sm" prompt={t("Reason for cancelling (dispute resolution):")}>
                      {t("Cancel")}
                    </ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
