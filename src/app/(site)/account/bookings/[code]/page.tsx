import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { CheckCircle2, Calendar, MapPin, Store } from "lucide-react";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { freeCancelHours } from "@/server/booking";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { fmtDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { areaName } from "@/lib/areas";
import { BOOKING_STATUS } from "@/lib/status";
import { StatusPill } from "@/components/status-pill";
import { CancelBookingButton } from "@/components/booking/cancel-button";

export const metadata = { title: "Booking", robots: { index: false } };

export default async function BookingDetail({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ new?: string; paid?: string }> }) {
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/account/bookings/${code}`);
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const b = await prisma.booking.findUnique({
    where: { code },
    include: { event: { include: { location: true, merchant: true } }, session: true, items: { include: { ticketType: true } }, tickets: { orderBy: { seatLabel: "asc" } }, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!b || b.userId !== user.id) notFound();
  const ticketTypeName = new Map(b.items.map((i) => [i.ticketTypeId, loc(i.ticketType.name, locale)]));
  const showTickets = ["CONFIRMED", "RESERVED_PAY_AT_VENUE", "COMPLETED"].includes(b.status);
  const qrs = showTickets ? await Promise.all(b.tickets.map((tk) => QRCode.toDataURL(`EVNT:${tk.code}`, { margin: 1, width: 360, color: { dark: "#252525", light: "#ffffff" } }))) : [];
  const hours = await freeCancelHours(user.id);
  const canCancel = ["CONFIRMED", "RESERVED_PAY_AT_VENUE"].includes(b.status) && b.session.startsAt.getTime() - Date.now() > hours * 3600_000;
  const pendingWhish = b.status === "PENDING_PAYMENT" && b.payments.some((p) => p.status === "PENDING");

  return (
    <div className="mx-auto max-w-3xl">
      {(sp.new || sp.paid) && showTickets && (
        <div className="mb-6 flex items-start gap-3 rounded-3xl bg-mint-soft p-5">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-mint-deep" />
          <div>
            <p className="font-bold">{b.status === "RESERVED_PAY_AT_VENUE" ? t("You're reserved!") : t("You're booked!")}</p>
            <p className="text-sm text-ink-soft">{t("We've sent the details to {email}. Show the QR codes at the entrance.", { email: b.contactEmail })}</p>
          </div>
        </div>
      )}
      {pendingWhish && <p className="mb-6 rounded-3xl bg-peach-soft p-5 text-sm text-peach-deep">{t("We're waiting for Whish to confirm your payment. This page updates once it's confirmed — nothing is booked until then.")}</p>}
      {b.status === "PENDING_PAYMENT" && !pendingWhish && (
        <Link href={`/checkout/${b.code}`} className="mb-6 block rounded-3xl bg-peach-soft p-5 text-sm font-semibold text-peach-deep">
          {t("This booking isn't paid yet. Continue to checkout →")}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">
            {t("Booking")} {b.code}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{loc(b.event.title, locale)}</h1>
        </div>
        <StatusPill map={BOOKING_STATUS} status={b.status} t={t} />
      </div>
      <div className="mt-4 space-y-2 text-sm text-ink-soft">
        <p className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {fmtDateTime(b.session.startsAt, locale)}
        </p>
        {b.event.location && (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {b.event.location.name}, {b.event.location.address}, {areaName(b.event.location.area, locale)}
          </p>
        )}
        <p className="flex items-center gap-2">
          <Store className="h-4 w-4" />
          {b.event.merchant.name}
        </p>
      </div>
      {b.status === "RESERVED_PAY_AT_VENUE" && (
        <p className="mt-4 rounded-2xl bg-powder-soft px-4 py-3 text-sm text-powder-deep">{t("Please pay {amount} to the organizer at the venue.", { amount: formatMoney(b.subtotalCents, locale) })}</p>
      )}

      {showTickets && (
        <section className="mt-8">
          <h2 className="h-section mb-4">{t("Your tickets")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {b.tickets.map((tk, i) => (
              <div key={tk.id} className={`card p-5 text-center ${tk.status !== "VALID" ? "opacity-60" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrs[i]} alt={t("Ticket QR code")} className="mx-auto h-48 w-48" />
                <p className="mt-3 font-semibold">{ticketTypeName.get(tk.ticketTypeId)}</p>
                {tk.seatLabel && <p className="text-sm">{t("Seat {seat}", { seat: tk.seatLabel })}</p>}
                {tk.attendeeName && <p className="text-sm text-ink-muted">{tk.attendeeName}</p>}
                <p className="mt-2 font-mono text-[11px] text-ink-muted">{tk.code.slice(0, 8).toUpperCase()}</p>
                {tk.status === "USED" && <p className="mt-1 text-xs font-semibold">{t("Checked in")}</p>}
                {tk.status === "VOID" && <p className="mt-1 text-xs font-semibold text-red-600">{t("Void")}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 rounded-3xl bg-canvas p-5 text-sm">
        {b.items.map((it) => (
          <div key={it.id} className="flex justify-between py-0.5">
            <span>
              {it.quantity} × {loc(it.ticketType.name, locale)}
            </span>
            <span>{formatMoney(it.quantity * it.unitPriceCents, locale)}</span>
          </div>
        ))}
        {b.feeCents > 0 && (
          <div className="flex justify-between py-0.5 text-ink-muted">
            <span>{t("EVNT booking fee")}</span>
            <span>{formatMoney(b.feeCents, locale)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-ink/10 pt-2 font-bold">
          <span>{t("Total")}</span>
          <span>{b.totalCents ? formatMoney(b.totalCents, locale) : t("Free")}</span>
        </div>
        {b.refundedCents > 0 && <p className="mt-2 text-ink-muted">{t("Refunded: {amount}", { amount: formatMoney(b.refundedCents, locale) })}</p>}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/events/${b.event.slug}`} className="btn-outline">
          {t("View activity")}
        </Link>
        {canCancel && <CancelBookingButton code={b.code} />}
      </div>
      {!canCancel && ["CONFIRMED", "RESERVED_PAY_AT_VENUE"].includes(b.status) && (
        <p className="mt-3 text-xs text-ink-muted">{t("Free cancellation has closed for this booking. Contact the organizer for changes.")}</p>
      )}
    </div>
  );
}
