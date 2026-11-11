"use server";

import { revalidatePath } from "next/cache";
import { requireMerchant, UserError } from "@/server/auth";
import { cancelBooking, markPaidAtVenue, scanTicket } from "@/server/booking";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";

export async function merchantCancelBookingAction(code: string, reason?: string) {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  try {
    await cancelBooking(code, { userId: ctx.user.id, as: "merchant", merchantId: ctx.merchant.id }, reason?.trim() || "Cancelled by the organizer");
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  revalidatePath(`/merchant/bookings/${code}`);
  return {};
}

export async function markPaidAtVenueAction(code: string) {
  const t = await getT();
  const ctx = await requireMerchant("STAFF");
  try {
    await markPaidAtVenue(code, ctx.merchant.id, ctx.user.id);
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  revalidatePath(`/merchant/bookings/${code}`);
  return {};
}

export type ScanResult = { ok: boolean; message: string; detail?: string; bookingCode?: string; payAtVenue?: boolean };

export async function scanTicketAction(raw: string): Promise<ScanResult> {
  const t = await getT();
  const locale = await getLocale();
  const ctx = await requireMerchant("STAFF");
  const code = raw.trim().replace(/^EVNT:/i, "").toLowerCase();
  if (!/^[0-9a-f]{8,32}$/.test(code)) return { ok: false, message: t("Not an EVNT ticket") };
  // Short codes (first 8 characters printed under the QR) are looked up within this merchant only.
  let full = code;
  if (code.length < 32) {
    const hits = await prisma.ticket.findMany({ where: { code: { startsWith: code }, booking: { merchantId: ctx.merchant.id } }, take: 2 });
    if (hits.length !== 1) return { ok: false, message: t("Ticket not found") };
    full = hits[0].code;
  }
  const r = await scanTicket(full, ctx.merchant.id, ctx.user.id);
  if (!r.ok) {
    const msg = { not_found: t("Ticket not found"), void: t("This ticket was cancelled"), used: t("Already checked in"), not_confirmed: t("This booking isn't confirmed") }[r.reason];
    const when = "ticket" in r && r.ticket?.scannedAt ? r.ticket.scannedAt.toLocaleTimeString(locale) : undefined;
    return { ok: false, message: msg, detail: when ? t("Scanned at {time}", { time: when }) : undefined, bookingCode: "ticket" in r ? r.ticket?.booking.code : undefined };
  }
  return {
    ok: true,
    message: t("Welcome! Ticket valid"),
    detail: [loc(r.ticket.booking.event.title, locale), r.ticket.seatLabel ? t("Seat {seat}", { seat: r.ticket.seatLabel }) : null, r.ticket.attendeeName].filter(Boolean).join(" · "),
    bookingCode: r.ticket.booking.code,
    payAtVenue: r.payAtVenue,
  };
}
