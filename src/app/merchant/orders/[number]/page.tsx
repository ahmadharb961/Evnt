import { notFound } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { StatusPill } from "@/components/status-pill";
import { ActionButton } from "@/components/portal/action-button";
import { orderStatusAction } from "@/actions/merchant-shop";
import { ORDER_FLOW, ORDER_STATUS } from "@/lib/status";
import { fmtDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { areaName } from "@/lib/areas";

export const metadata = { title: "Order" };

export default async function MerchantOrder({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const o = await prisma.order.findUnique({ where: { number }, include: { items: true, history: { orderBy: { createdAt: "asc" } } } });
  if (!o || o.merchantId !== ctx.merchant.id) notFound();
  const commission = await prisma.commission.findUnique({ where: { source_sourceId: { source: "ORDER", sourceId: o.id } } });
  const next = (ORDER_FLOW[o.status] ?? []) as OrderStatus[];
  const label: Partial<Record<OrderStatus, string>> = { CONFIRMED: t("Confirm order"), PREPARING: t("Mark preparing"), SHIPPED: t("Mark shipped"), DELIVERED: o.paymentMethod === "COD" ? t("Delivered & cash collected") : t("Mark delivered"), CANCELED: t("Cancel order") };
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`${t("Order")} ${o.number}`}
        subtitle={fmtDateTime(o.createdAt, locale)}
        actions={next.map((s) => (
          <ActionButton
            key={s}
            action={orderStatusAction.bind(null, o.number, s)}
            className={s === "CANCELED" ? "btn-danger btn-sm" : "btn-primary btn-sm"}
            prompt={s === "DELIVERED" && o.paymentMethod === "COD" ? t("Cash collected (USD). Order total: {total}", { total: formatMoney(o.totalCents, locale) }) : s === "CANCELED" ? t("Reason for cancelling (shared with the customer):") : undefined}
          >
            {label[s]}
          </ActionButton>
        ))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title={t("Customer & delivery")}>
          <p className="text-sm">
            {o.customerName}
            <br />
            <a href={`tel:+${o.phone}`} dir="ltr">
              +{o.phone}
            </a>
            <br />
            {o.address}, {t("Building")} {o.building}
            {o.floor ? `, ${t("Floor")} ${o.floor}` : ""}
            <br />
            {areaName(o.area, locale)}
          </p>
          {o.instructions && <p className="mt-2 rounded-2xl bg-canvas p-3 text-sm">{o.instructions}</p>}
        </Panel>
        <Panel title={t("Status")}>
          <StatusPill map={ORDER_STATUS} status={o.status} t={t} />
          <ol className="mt-3 space-y-1 text-xs text-ink-muted">
            {o.history.map((h) => (
              <li key={h.id}>
                {t(ORDER_STATUS[h.status]?.label ?? h.status)} · {fmtDateTime(h.createdAt, locale)}
                {h.note ? ` · ${h.note}` : ""}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm">
            {o.paymentMethod === "COD" ? t("Cash on delivery") : t("Paid with Whish")}
            {o.codCollectedAt && ` · ${t("Collected {amount}", { amount: formatMoney(o.codCollectedCents ?? 0, locale) })}`}
          </p>
        </Panel>
      </div>
      <Panel title={t("Items")} className="mt-4">
        <ul className="space-y-1 text-sm">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between">
              <span>
                {i.quantity} × {i.title} {i.variantName !== "Default" && `(${i.variantName})`}
              </span>
              <span>{formatMoney(i.unitPriceCents * i.quantity, locale)}</span>
            </li>
          ))}
          <li className="flex justify-between text-ink-muted">
            <span>{t("Delivery")}</span>
            <span>{formatMoney(o.deliveryCents, locale)}</span>
          </li>
          {o.discountCents > 0 && (
            <li className="flex justify-between text-ink-muted">
              <span>{t("Discount")}</span>
              <span>-{formatMoney(o.discountCents, locale)}</span>
            </li>
          )}
          <li className="flex justify-between border-t border-ink/10 pt-2 font-bold">
            <span>{t("Total")}</span>
            <span>{formatMoney(o.totalCents, locale)}</span>
          </li>
          {commission && (
            <li className="flex justify-between text-xs text-ink-muted">
              <span>
                {t("EVNT commission")} ({commission.rateBps / 100}%)
              </span>
              <span>{formatMoney(commission.amountCents, locale)}</span>
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}
