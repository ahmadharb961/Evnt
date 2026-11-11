import { notFound } from "next/navigation";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { StatusPill } from "@/components/status-pill";
import { ActionButton } from "@/components/portal/action-button";
import { merchantCancelBookingAction, markPaidAtVenueAction } from "@/actions/merchant-bookings";
import { BOOKING_STATUS } from "@/lib/status";
import { fmtDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Booking" };

export default async function MerchantBooking({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const b = await prisma.booking.findUnique({ where: { code }, include: { event: true, session: true, items: { include: { ticketType: true } }, tickets: true } });
  if (!b || b.merchantId !== ctx.merchant.id) notFound();
  const commission = await prisma.commission.findUnique({ where: { source_sourceId: { source: "BOOKING", sourceId: b.id } } });
  const attribution = { EVNT: t("EVNT booking"), EVNT_EXTERNAL: t("EVNT-generated, completed directly"), MERCHANT_LINK: t("Your own customer (via your link)") }[b.attribution];
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`${t("Booking")} ${b.code}`}
        subtitle={loc(b.event.title, locale)}
        actions={
          <>
            {b.status === "RESERVED_PAY_AT_VENUE" && (
              <ActionButton action={markPaidAtVenueAction.bind(null, b.code)} className="btn-primary btn-sm" confirm={t("Confirm you received {amount} from the parent?", { amount: formatMoney(b.subtotalCents, locale) })}>
                {t("Mark as paid at venue")}
              </ActionButton>
            )}
            {["CONFIRMED", "RESERVED_PAY_AT_VENUE", "PENDING_PAYMENT"].includes(b.status) && (
              <ActionButton action={async (reason?: string) => { "use server"; return merchantCancelBookingAction(b.code, reason); }} className="btn-danger btn-sm" prompt={t("Reason for cancelling (shared with the parent):")}>
                {t("Cancel booking")}
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title={t("Details")}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t("Status")}</dt>
              <dd>
                <StatusPill map={BOOKING_STATUS} status={b.status} t={t} />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t("Date")}</dt>
              <dd>{fmtDateTime(b.session.startsAt, locale)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t("Parent")}</dt>
              <dd>{b.contactName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t("Phone")}</dt>
              <dd dir="ltr">
                <a href={`tel:+${b.contactPhone}`}>+{b.contactPhone}</a>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t("Source")}</dt>
              <dd>{attribution}</dd>
            </div>
            {b.cancelReason && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">{t("Cancellation reason")}</dt>
                <dd>{b.cancelReason}</dd>
              </div>
            )}
          </dl>
        </Panel>
        <Panel title={t("Money")}>
          <dl className="space-y-2 text-sm">
            {b.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <dt>
                  {i.quantity} × {loc(i.ticketType.name, locale)}
                </dt>
                <dd>{formatMoney(i.quantity * i.unitPriceCents, locale)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-ink/10 pt-2 font-semibold">
              <dt>{t("Your price")}</dt>
              <dd>{formatMoney(b.subtotalCents, locale)}</dd>
            </div>
            <div className="flex justify-between text-ink-muted">
              <dt>{t("Payment")}</dt>
              <dd>{{ WHISH: "Whish", PAY_AT_VENUE: t("At the venue"), FREE: t("Free"), COD: t("Cash"), OFFLINE: t("Offline") }[b.paymentMethod]}</dd>
            </div>
            {commission && (
              <div className="flex justify-between text-ink-muted">
                <dt>
                  {t("EVNT commission")} ({commission.rateBps / 100}%)
                </dt>
                <dd>{formatMoney(commission.amountCents, locale)}</dd>
              </div>
            )}
          </dl>
        </Panel>
      </div>
      <Panel title={t("Tickets")} className="mt-4">
        <ul className="divide-y divide-ink/[.06] text-sm">
          {b.tickets.map((tk) => (
            <li key={tk.id} className="flex justify-between py-2">
              <span>
                {tk.seatLabel ? t("Seat {seat}", { seat: tk.seatLabel }) : t("General admission")} {tk.attendeeName && `· ${tk.attendeeName}`}
                <span className="ms-2 font-mono text-xs text-ink-muted">{tk.code.slice(0, 8).toUpperCase()}</span>
              </span>
              <span className="text-xs font-semibold">{{ VALID: t("Valid"), USED: t("Checked in"), VOID: t("Void") }[tk.status]}</span>
            </li>
          ))}
          {!b.tickets.length && <li className="py-2 text-ink-muted">{t("No tickets issued.")}</li>}
        </ul>
      </Panel>
    </div>
  );
}
