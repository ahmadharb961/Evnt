import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { whishAvailable } from "@/server/payments";
import { getLocale, getT } from "@/i18n/server";
import { StatusPill } from "@/components/status-pill";
import { ActionButton } from "@/components/portal/action-button";
import { cancelMyOrderAction, retryOrderPaymentAction } from "@/actions/shop";
import { ORDER_STATUS } from "@/lib/status";
import { fmtDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { areaName } from "@/lib/areas";

export const metadata = { title: "Order", robots: { index: false } };

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ new?: string }> }) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/account/orders/${number}`);
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const g = await prisma.orderGroup.findUnique({ where: { number }, include: { orders: { include: { merchant: true, items: true, history: { orderBy: { createdAt: "asc" } } } }, payments: true } });
  if (!g || g.userId !== user.id) notFound();
  const canCancel = g.orders.some((o) => ["PENDING", "AWAITING_PAYMENT"].includes(o.status));
  const unpaid = g.orders.some((o) => o.status === "AWAITING_PAYMENT");
  const whishPending = g.payments.some((p) => p.status === "PENDING");
  const whish = await whishAvailable();
  const first = g.orders[0];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {sp.new && g.paymentMethod === "COD" && (
        <div className="flex items-start gap-3 rounded-3xl bg-mint-soft p-5">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-mint-deep" />
          <div>
            <p className="font-bold">{t("Order placed!")}</p>
            <p className="text-sm text-ink-soft">{t("The shop will confirm shortly. Pay in cash when it arrives.")}</p>
          </div>
        </div>
      )}
      {unpaid && whishPending && <p className="rounded-3xl bg-peach-soft p-4 text-sm text-peach-deep">{t("We're waiting for Whish to confirm your payment. Your order is confirmed only after that.")}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("Order {number}", { number: g.number })}</h1>
          <p className="text-sm text-ink-muted">{fmtDateTime(g.createdAt, locale)}</p>
        </div>
        <div className="flex gap-2">
          {unpaid && whish && !whishPending && (
            <ActionButton action={retryOrderPaymentAction.bind(null, g.number)} className="btn-primary btn-sm">
              {t("Pay with Whish")}
            </ActionButton>
          )}
          {canCancel && (
            <ActionButton action={cancelMyOrderAction.bind(null, g.number)} className="btn-danger btn-sm" confirm={t("Cancel this order?")}>
              {t("Cancel order")}
            </ActionButton>
          )}
        </div>
      </div>
      {g.orders.map((o) => (
        <section key={o.id} className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">
              {o.merchant.name} <span className="ms-2 font-mono text-xs text-ink-muted">{o.number}</span>
            </p>
            <StatusPill map={ORDER_STATUS} status={o.status} t={t} />
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>
                  {i.quantity} × {i.title} {i.variantName !== "Default" && <span className="text-ink-muted">({i.variantName})</span>}
                </span>
                <span>{formatMoney(i.unitPriceCents * i.quantity, locale)}</span>
              </li>
            ))}
            <li className="flex justify-between text-ink-muted">
              <span>{t("Delivery")}</span>
              <span>{formatMoney(o.deliveryCents, locale)}</span>
            </li>
            {o.discountCents > 0 && (
              <li className="flex justify-between text-mint-deep">
                <span>{t("Discount")}</span>
                <span>-{formatMoney(o.discountCents, locale)}</span>
              </li>
            )}
            <li className="flex justify-between border-t border-ink/10 pt-2 font-bold">
              <span>{t("Total")}</span>
              <span>{formatMoney(o.totalCents, locale)}</span>
            </li>
          </ul>
          <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            {o.history.map((h) => (
              <li key={h.id}>
                {t(ORDER_STATUS[h.status]?.label ?? h.status)} · {fmtDateTime(h.createdAt, locale)}
              </li>
            ))}
          </ol>
          {o.cancelReason && <p className="mt-2 text-xs text-ink-muted">{o.cancelReason}</p>}
        </section>
      ))}
      {first && (
        <section className="rounded-3xl bg-canvas p-5 text-sm">
          <p className="font-semibold">{t("Delivery address")}</p>
          <p className="mt-1 text-ink-soft">
            {first.customerName} · <span dir="ltr">+{first.phone}</span>
            <br />
            {first.address}, {t("Building")} {first.building}
            {first.floor ? `, ${t("Floor")} ${first.floor}` : ""}, {areaName(first.area, locale)}
          </p>
          <p className="mt-2 text-ink-muted">{g.paymentMethod === "COD" ? t("Cash on delivery") : "Whish Money"}</p>
        </section>
      )}
    </div>
  );
}
