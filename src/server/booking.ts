import "server-only";
import { Prisma, type PaymentMethod } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma, type Tx } from "./db";
import { UserError } from "./auth";
import { getSetting } from "./settings";
import { isMember, awardPoints, reversePoints } from "./membership";
import { recordBookingCommission, reverseBookingCommission } from "./commission";
import { notifyMerchant, notifyUser } from "./notify";
import { audit } from "./audit";
import { shortCode, ticketCode } from "@/lib/codes";

// ───────────────────────── Availability ─────────────────────────

export type SeatState = "available" | "held" | "sold" | "blocked" | "mine";

/** Releases one hold: frees general-admission spots and held seats; an unpaid booking expires. */
async function releaseHold(tx: Tx, holdId: string) {
  const hold = await tx.inventoryHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.released) return;
  // Only the first caller flips released=false→true, so spots are never freed twice.
  const flipped = await tx.inventoryHold.updateMany({ where: { id: holdId, released: false }, data: { released: true } });
  if (!flipped.count) return;
  if (hold.quantity > 0) await tx.$executeRaw`UPDATE "EventSession" SET reserved = GREATEST(0, reserved - ${hold.quantity}) WHERE id = ${hold.sessionId}`;
  await tx.seatClaim.deleteMany({ where: { holdId, status: "HELD" } });
  if (hold.bookingId) {
    const b = await tx.booking.updateMany({ where: { id: hold.bookingId, status: "PENDING_PAYMENT" }, data: { status: "EXPIRED" } });
    if (b.count) await tx.auditLog.create({ data: { action: "booking.expired", entityType: "booking", entityId: hold.bookingId } });
  }
}

/** Frees every expired hold (all sessions, or one). Called before taking new holds and by the cron job. */
export async function releaseExpiredHolds(sessionId?: string) {
  const expired = await prisma.inventoryHold.findMany({ where: { released: false, expiresAt: { lt: new Date() }, ...(sessionId ? { sessionId } : {}) }, select: { id: true }, take: 500 });
  for (const h of expired) await prisma.$transaction((tx) => releaseHold(tx, h.id));
  return expired.length;
}

export async function seatStates(sessionId: string, mapId: string, viewerHoldIds: string[] = []) {
  const [seats, claims] = await Promise.all([
    prisma.seat.findMany({ where: { mapId }, orderBy: [{ y: "asc" }, { x: "asc" }] }),
    prisma.seatClaim.findMany({ where: { sessionId } }),
  ]);
  const now = new Date();
  const byseat = new Map(claims.map((c) => [c.seatId, c]));
  return seats.map((s) => {
    const c = byseat.get(s.id);
    let state: SeatState = s.blocked ? "blocked" : "available";
    if (c) {
      if (c.status === "CONFIRMED" || c.status === "RESERVED") state = "sold";
      else if (c.status === "HELD" && c.expiresAt && c.expiresAt > now) state = c.holdId && viewerHoldIds.includes(c.holdId) ? "mine" : "held";
    }
    return { id: s.id, label: s.label, row: s.row, x: s.x, y: s.y, zone: s.zone, kind: s.kind, accessible: s.accessible, state };
  });
}

export async function sessionRemaining(sessionId: string) {
  const s = await prisma.eventSession.findUnique({ where: { id: sessionId }, include: { event: { include: { seatingMap: { include: { _count: { select: { seats: { where: { blocked: false } } } } } } } } } });
  if (!s) return 0;
  if (s.event.seatingMode === "ASSIGNED") {
    const taken = await prisma.seatClaim.count({ where: { sessionId, OR: [{ status: { in: ["CONFIRMED", "RESERVED"] } }, { status: "HELD", expiresAt: { gt: new Date() } }] } });
    return (s.event.seatingMap?._count.seats ?? 0) - taken;
  }
  return s.capacity - s.reserved;
}

/** Can this user book this session right now? Handles EVNT+ 48-hour early access. */
export async function salesState(session: { startsAt: Date; salesStartAt: Date | null; status: string }, event: { memberEarlyAccess: boolean }, userId?: string | null) {
  const now = new Date();
  if (session.status !== "SCHEDULED" || session.startsAt <= now) return { open: false as const, reason: "closed" as const };
  if (!session.salesStartAt || session.salesStartAt <= now) return { open: true as const };
  const hours = await getSetting("membership.earlyAccessHours");
  const earlyFrom = new Date(session.salesStartAt.getTime() - hours * 3600_000);
  if (event.memberEarlyAccess && now >= earlyFrom) {
    if (await isMember(userId)) return { open: true as const, early: true };
    return { open: false as const, reason: "members_only" as const, opensAt: session.salesStartAt };
  }
  return { open: false as const, reason: "not_yet" as const, opensAt: event.memberEarlyAccess ? earlyFrom : session.salesStartAt };
}

/** Flash promotion currently running for an event (percent off the merchant's price). */
export async function activeFlashPercent(eventId: string) {
  const now = new Date();
  const p = await prisma.flashPromotion.findFirst({ where: { eventId, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { percentOff: "desc" } });
  return p?.percentOff ?? 0;
}

// ───────────────────────── Starting a booking (hold) ─────────────────────────

export type StartInput = {
  userId: string;
  sessionId: string;
  items: { ticketTypeId: string; quantity: number }[];
  seatIds?: string[];
  seatTickets?: Record<string, string>; // seatId -> ticketTypeId (assigned seating)
  locale: string;
};

const REF_COOKIE = "evnt_ref";

/** Merchant-originated customer? (arrived through the merchant's own EVNT link in the last 30 days) */
async function attributionFor(merchantId: string) {
  let raw: string | undefined;
  try {
    raw = (await cookies()).get(REF_COOKIE)?.value;
  } catch {
    return "EVNT" as const; // outside a request (scripts/tests)
  }
  if (!raw) return "EVNT" as const;
  const [code, at] = raw.split(".");
  if (!code || Date.now() - Number(at) > 30 * 86400_000) return "EVNT" as const;
  const m = await prisma.merchant.findUnique({ where: { attributionCode: code }, select: { id: true } });
  return m?.id === merchantId ? ("MERCHANT_LINK" as const) : ("EVNT" as const);
}

export async function startBooking(input: StartInput): Promise<{ code: string }> {
  const session = await prisma.eventSession.findUnique({
    where: { id: input.sessionId },
    include: { event: { include: { ticketTypes: { where: { active: true } }, merchant: true } } },
  });
  if (!session || session.event.status !== "PUBLISHED" || session.event.merchant.status !== "APPROVED") throw new UserError("This activity is not available for booking");
  const event = session.event;
  const sales = await salesState(session, event, input.userId);
  if (!sales.open) throw new UserError(sales.reason === "members_only" ? "Early access is for EVNT+ members right now" : "Booking is not open for this date");

  const types = new Map(event.ticketTypes.map((t) => [t.id, t]));
  const assigned = event.seatingMode === "ASSIGNED";
  const seatIds = [...new Set(input.seatIds ?? [])];
  let lines: { ticketTypeId: string; quantity: number; unit: number; seatIds: string[] }[] = [];

  if (assigned) {
    if (!seatIds.length) throw new UserError("Choose your seats");
    if (seatIds.length > 12) throw new UserError("You can book up to 12 seats at a time");
    const seats = await prisma.seat.findMany({ where: { id: { in: seatIds }, mapId: event.seatingMapId ?? "" } });
    if (seats.length !== seatIds.length || seats.some((s) => s.blocked)) throw new UserError("Some seats are not available");
    const byType = new Map<string, string[]>();
    for (const s of seats) {
      const chosen = input.seatTickets?.[s.id];
      const tt = (chosen && types.get(chosen)) || event.ticketTypes.find((t) => t.zone === s.zone) || event.ticketTypes.find((t) => !t.zone);
      if (!tt || (tt.zone && tt.zone !== s.zone)) throw new UserError("Some seats are not available");
      byType.set(tt.id, [...(byType.get(tt.id) ?? []), s.id]);
    }
    lines = [...byType].map(([id, ids]) => ({ ticketTypeId: id, quantity: ids.length, unit: types.get(id)!.priceCents, seatIds: ids }));
  } else {
    for (const it of input.items) {
      const tt = types.get(it.ticketTypeId);
      const q = Math.floor(it.quantity);
      if (!tt || q <= 0) continue;
      if (q > tt.maxQty) throw new UserError("Too many tickets of one type");
      lines.push({ ticketTypeId: tt.id, quantity: q, unit: tt.priceCents, seatIds: [] });
    }
    if (!lines.length) throw new UserError("Choose at least one ticket");
    for (const l of lines) if (l.quantity < types.get(l.ticketTypeId)!.minQty) throw new UserError("Below the minimum number of tickets");
  }

  const qty = lines.reduce((a, l) => a + l.quantity, 0);
  const pct = await activeFlashPercent(event.id);
  const unitAfter = (u: number) => (pct ? Math.round((u * (100 - pct)) / 100) : u);
  const subtotal = lines.reduce((a, l) => a + unitAfter(l.unit) * l.quantity, 0);
  const member = await isMember(input.userId);
  const fee = subtotal > 0 && !member ? await getSetting("booking.feeCents") : 0;
  const holdMinutes = await getSetting("booking.holdMinutes");
  const expiresAt = new Date(Date.now() + holdMinutes * 60_000);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  const attribution = await attributionFor(event.merchantId);

  // One active pending booking per user per session: starting again replaces it.
  const previous = await prisma.booking.findMany({ where: { userId: input.userId, sessionId: session.id, status: "PENDING_PAYMENT" }, select: { id: true } });
  for (const p of previous) {
    const h = await prisma.inventoryHold.findUnique({ where: { bookingId: p.id } });
    if (h) await prisma.$transaction((tx) => releaseHold(tx, h.id));
  }
  await releaseExpiredHolds(session.id);

  try {
    return await prisma.$transaction(async (tx) => {
      const hold = await tx.inventoryHold.create({ data: { sessionId: session.id, userId: input.userId, quantity: assigned ? 0 : qty, expiresAt } });
      if (assigned) {
        // The unique (sessionId, seatId) index makes a second claim on the same seat fail.
        await tx.seatClaim.createMany({ data: seatIds.map((seatId) => ({ sessionId: session.id, seatId, status: "HELD" as const, holdId: hold.id, expiresAt })) });
      } else {
        const n = await tx.$executeRaw`UPDATE "EventSession" SET reserved = reserved + ${qty} WHERE id = ${session.id} AND status = 'SCHEDULED' AND reserved + ${qty} <= capacity`;
        if (n !== 1) throw new UserError(qty === 1 ? "Sorry, this date just sold out" : "Not enough spots left for this date");
      }
      const booking = await tx.booking.create({
        data: {
          code: shortCode("EV"),
          userId: input.userId,
          merchantId: event.merchantId,
          eventId: event.id,
          sessionId: session.id,
          status: "PENDING_PAYMENT",
          paymentMethod: subtotal === 0 ? "FREE" : "WHISH",
          attribution,
          subtotalCents: subtotal,
          feeCents: fee,
          totalCents: subtotal + fee,
          memberApplied: member && subtotal > 0,
          contactName: user.name,
          contactPhone: user.phone ?? "",
          contactEmail: user.email,
          locale: input.locale,
          holdExpiresAt: expiresAt,
          items: { create: lines.map((l) => ({ ticketTypeId: l.ticketTypeId, quantity: l.quantity, unitPriceCents: unitAfter(l.unit), seatIds: l.seatIds })) },
        },
      });
      await tx.inventoryHold.update({ where: { id: hold.id }, data: { bookingId: booking.id } });
      if (assigned) await tx.auditLog.create({ data: { actorId: input.userId, action: "seats.held", entityType: "session", entityId: session.id, data: { bookingId: booking.id, seatIds } } });
      return { code: booking.code };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new UserError("Someone just took one of these seats. Please choose again.");
    throw e;
  }
}

// ───────────────────────── Confirming ─────────────────────────

async function issueTickets(tx: Tx, bookingId: string) {
  const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { items: true } });
  if (await tx.ticket.count({ where: { bookingId } })) return;
  const attendees = (Array.isArray(b.attendees) ? b.attendees : []) as { name?: string }[];
  const seatLabels = new Map((await tx.seat.findMany({ where: { id: { in: b.items.flatMap((i) => i.seatIds) } } })).map((s) => [s.id, s.label]));
  let n = 0;
  for (const it of b.items) {
    for (let k = 0; k < it.quantity; k++) {
      const seatId = it.seatIds[k] ?? null;
      await tx.ticket.create({
        data: { code: ticketCode(), bookingId, sessionId: b.sessionId, ticketTypeId: it.ticketTypeId, seatId, seatLabel: seatId ? seatLabels.get(seatId) : null, attendeeName: attendees[n]?.name?.slice(0, 80) || null },
      });
      n++;
    }
  }
}

/**
 * Turns a held booking into a confirmed one: seats become CONFIRMED, tickets are issued, the
 * commission and loyalty points are recorded. Only called for a free booking, an authorized
 * pay-at-venue reservation, or after a payment was verified with the provider.
 */
async function finalize(tx: Tx, bookingId: string, method: PaymentMethod) {
  const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { event: true, merchant: true } });
  if (b.status !== "PENDING_PAYMENT") return { already: true, booking: b };
  const hold = await tx.inventoryHold.findUnique({ where: { bookingId } });
  if (!hold || hold.released) {
    // The hold ran out (e.g. a slow payment). Try to take the inventory again; otherwise fail.
    if (b.event.seatingMode === "ASSIGNED") {
      const items = await tx.bookingItem.findMany({ where: { bookingId } });
      const ids = items.flatMap((i) => i.seatIds);
      await tx.seatClaim.deleteMany({ where: { sessionId: b.sessionId, seatId: { in: ids }, status: "HELD", expiresAt: { lt: new Date() } } });
      try {
        await tx.seatClaim.createMany({ data: ids.map((seatId) => ({ sessionId: b.sessionId, seatId, status: "CONFIRMED" as const, bookingId })) });
      } catch {
        throw new InventoryLostError();
      }
    } else {
      const qty = (await tx.bookingItem.aggregate({ where: { bookingId }, _sum: { quantity: true } }))._sum.quantity ?? 0;
      const n = await tx.$executeRaw`UPDATE "EventSession" SET reserved = reserved + ${qty} WHERE id = ${b.sessionId} AND reserved + ${qty} <= capacity`;
      if (n !== 1) throw new InventoryLostError();
    }
  } else {
    await tx.inventoryHold.update({ where: { id: hold.id }, data: { released: true } }); // consumed, not freed
    await tx.seatClaim.updateMany({ where: { holdId: hold.id }, data: { status: "CONFIRMED", bookingId, expiresAt: null } });
  }
  const status = method === "PAY_AT_VENUE" ? "RESERVED_PAY_AT_VENUE" : "CONFIRMED";
  const updated = await tx.booking.update({ where: { id: bookingId }, data: { status, paymentMethod: method, confirmedAt: new Date(), holdExpiresAt: null } });
  await issueTickets(tx, bookingId);
  await tx.event.update({ where: { id: b.eventId }, data: { popularity: { increment: 1 } } });
  if (method !== "PAY_AT_VENUE") {
    await recordBookingCommission(tx, {
      id: b.id,
      code: b.code,
      merchantId: b.merchantId,
      userId: b.userId,
      subtotalCents: b.subtotalCents,
      attribution: b.attribution,
      paymentMethod: method,
      eventCategoryId: b.event.categoryId,
      plan: b.merchant.plan,
    });
    if (b.totalCents > 0) await awardPoints(tx, b.userId, b.totalCents, b.memberApplied || (await isMember(b.userId, tx)), { type: "booking", id: b.id });
  }
  await tx.auditLog.create({ data: { actorId: b.userId, action: "booking.confirmed", entityType: "booking", entityId: b.id, data: { method } } });
  return { already: false, booking: updated };
}

export class InventoryLostError extends UserError {
  constructor() {
    super("Your hold expired and these spots were taken. Any payment will be refunded.");
  }
}

async function afterConfirm(bookingId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { event: true } });
  if (!b) return;
  await notifyUser(b.userId, {
    kind: "booking.confirmed",
    title: "Booking confirmed: {code}",
    body: "Your tickets are ready. Show the QR code at the entrance.",
    vars: { code: b.code },
    link: `/account/bookings/${b.code}`,
  });
  await notifyMerchant(b.merchantId, { kind: "booking.new", title: "New booking {code}", body: "A new booking was just made on EVNT.", vars: { code: b.code }, link: `/merchant/bookings/${b.code}` });
}

export type CheckoutDetails = { contactName: string; contactPhone: string; attendees: { name: string }[] };

/** Saves the attendee/contact step (validated by the caller). */
export async function saveCheckoutDetails(code: string, userId: string, d: CheckoutDetails) {
  const b = await prisma.booking.findUnique({ where: { code } });
  if (!b || b.userId !== userId) throw new UserError("Booking not found");
  if (b.status !== "PENDING_PAYMENT") throw new UserError("This booking can no longer be changed");
  await prisma.booking.update({ where: { id: b.id }, data: { contactName: d.contactName, contactPhone: d.contactPhone, attendees: d.attendees } });
}

/** Free bookings and authorized pay-at-venue reservations confirm immediately (no money moves through EVNT). */
export async function confirmWithoutOnlinePayment(code: string, userId: string, method: "FREE" | "PAY_AT_VENUE") {
  const b = await prisma.booking.findUnique({ where: { code }, include: { event: true } });
  if (!b || b.userId !== userId) throw new UserError("Booking not found");
  if (b.status !== "PENDING_PAYMENT") return b;
  if (b.holdExpiresAt && b.holdExpiresAt < new Date()) throw new UserError("Your hold expired. Please choose your tickets again.");
  if (method === "FREE" && b.totalCents !== 0) throw new UserError("This booking needs payment");
  if (method === "PAY_AT_VENUE" && !b.event.payAtVenue) throw new UserError("Pay at venue is not offered for this activity");
  const r = await prisma.$transaction((tx) => finalize(tx, b.id, method));
  if (!r.already) await afterConfirm(b.id);
  return r.booking;
}

/** Called when a payment provider reports a verified outcome. Idempotent. */
export async function applyBookingPayment(paymentId: string, outcome: "success" | "failed") {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p || !p.bookingId) return;
  if (outcome === "failed") {
    await prisma.payment.updateMany({ where: { id: p.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: "FAILED" } });
    const hold = await prisma.inventoryHold.findUnique({ where: { bookingId: p.bookingId } });
    if (hold) await prisma.$transaction((tx) => releaseHold(tx, hold.id));
    await prisma.booking.updateMany({ where: { id: p.bookingId, status: "PENDING_PAYMENT" }, data: { status: "CANCELED", cancelReason: "Payment failed", canceledAt: new Date() } });
    return;
  }
  const marked = await prisma.payment.updateMany({ where: { id: p.id, status: { in: ["INITIATED", "PENDING", "FAILED"] } }, data: { status: "SUCCEEDED", confirmedAt: new Date() } });
  if (!marked.count) return; // already processed
  try {
    const r = await prisma.$transaction((tx) => finalize(tx, p.bookingId!, "WHISH"));
    if (!r.already) await afterConfirm(p.bookingId);
  } catch (e) {
    if (e instanceof InventoryLostError) {
      // Paid, but the spots are gone: never pretend it's booked. Refund in full.
      await prisma.booking.update({ where: { id: p.bookingId }, data: { status: "CANCELED", cancelReason: "Inventory released before payment completed", canceledAt: new Date() } });
      await prisma.refund.create({ data: { paymentId: p.id, bookingId: p.bookingId, amountCents: p.amountCents, reason: "Paid after hold expired; spots no longer available", status: "APPROVED" } });
      await notifyUser(p.userId!, { kind: "booking.failed", title: "We couldn't complete your booking", body: "The spots were released before your payment finished. A full refund has been started.", link: "/account/bookings" });
      return;
    }
    throw e;
  }
}

// ───────────────────────── Cancelling ─────────────────────────

export async function freeCancelHours(userId: string) {
  return (await isMember(userId)) ? 24 : 48;
}

/**
 * Cancels a booking. Parents can cancel themselves before the free-cancellation window closes
 * (48h, or 24h for EVNT+ members, subject to the merchant's policy). Merchants and admins can always cancel.
 * Seats/spots go back on sale, tickets are voided, commission is reversed and a refund is recorded.
 */
export async function cancelBooking(code: string, actor: { userId: string; as: "customer" | "merchant" | "admin"; merchantId?: string }, reason: string) {
  const b = await prisma.booking.findUnique({ where: { code }, include: { session: true, payments: { where: { status: "SUCCEEDED" } } } });
  if (!b) throw new UserError("Booking not found");
  if (actor.as === "customer" && b.userId !== actor.userId) throw new UserError("Booking not found");
  if (actor.as === "merchant" && b.merchantId !== actor.merchantId) throw new UserError("Booking not found");
  if (!["PENDING_PAYMENT", "CONFIRMED", "RESERVED_PAY_AT_VENUE"].includes(b.status)) throw new UserError("This booking can't be cancelled");
  if (actor.as === "customer" && b.status !== "PENDING_PAYMENT") {
    const hours = await freeCancelHours(b.userId);
    if (b.session.startsAt.getTime() - Date.now() < hours * 3600_000) throw new UserError("Free cancellation has closed for this booking. Contact the organizer.");
  }
  const paid = b.payments.reduce((a, p) => a + p.amountCents, 0);
  await prisma.$transaction(async (tx) => {
    const hold = await tx.inventoryHold.findUnique({ where: { bookingId: b.id } });
    if (b.status === "PENDING_PAYMENT") {
      if (hold) await releaseHold(tx, hold.id);
    } else {
      const qty = (await tx.bookingItem.aggregate({ where: { bookingId: b.id }, _sum: { quantity: true } }))._sum.quantity ?? 0;
      const seatClaims = await tx.seatClaim.deleteMany({ where: { bookingId: b.id } });
      if (!seatClaims.count && qty) await tx.$executeRaw`UPDATE "EventSession" SET reserved = GREATEST(0, reserved - ${qty}) WHERE id = ${b.sessionId}`;
      await tx.ticket.updateMany({ where: { bookingId: b.id }, data: { status: "VOID" } });
      if (b.status === "CONFIRMED") {
        await reverseBookingCommission(tx, b, b.subtotalCents);
        await reversePoints(tx, b.userId, { type: "booking", id: b.id });
      }
      if (paid > 0) {
        await tx.refund.create({ data: { paymentId: b.payments[0].id, bookingId: b.id, amountCents: paid, reason, status: actor.as === "customer" ? "REQUESTED" : "APPROVED" } });
      }
    }
    await tx.booking.update({ where: { id: b.id }, data: { status: "CANCELED", canceledAt: new Date(), cancelReason: reason.slice(0, 300) } });
    await tx.auditLog.create({ data: { actorId: actor.userId, action: "booking.canceled", entityType: "booking", entityId: b.id, data: { as: actor.as, reason, paid } } });
  });
  if (b.status !== "PENDING_PAYMENT") {
    await notifyUser(b.userId, {
      kind: "booking.canceled",
      title: "Booking cancelled: {code}",
      body: paid > 0 ? "Your booking was cancelled. Your refund is being processed." : "Your booking was cancelled.",
      vars: { code: b.code },
      link: `/account/bookings/${b.code}`,
    });
    await notifyMerchant(b.merchantId, { kind: "booking.canceled", title: "Booking cancelled: {code}", body: "A booking was cancelled and its spots are back on sale.", vars: { code: b.code }, link: `/merchant/bookings/${b.code}`, email: false });
  }
}

// ───────────────────────── Tickets ─────────────────────────

/** Validates a scanned ticket for a merchant. Marks it used exactly once. */
export async function scanTicket(code: string, merchantId: string, scannerId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { code: code.trim().toLowerCase() }, include: { booking: { include: { event: true } }, session: true } });
  if (!ticket || ticket.booking.merchantId !== merchantId) return { ok: false as const, reason: "not_found" as const };
  if (ticket.status === "VOID") return { ok: false as const, reason: "void" as const, ticket };
  if (ticket.status === "USED") return { ok: false as const, reason: "used" as const, ticket };
  if (!["CONFIRMED", "RESERVED_PAY_AT_VENUE", "COMPLETED"].includes(ticket.booking.status)) return { ok: false as const, reason: "not_confirmed" as const, ticket };
  const updated = await prisma.ticket.updateMany({ where: { id: ticket.id, status: "VALID" }, data: { status: "USED", scannedAt: new Date(), scannedById: scannerId } });
  if (!updated.count) return { ok: false as const, reason: "used" as const, ticket };
  await audit({ actorId: scannerId, action: "ticket.scanned", entityType: "ticket", entityId: ticket.id });
  return { ok: true as const, ticket, payAtVenue: ticket.booking.status === "RESERVED_PAY_AT_VENUE" };
}

/** The merchant confirms money collected at the venue for a pay-at-venue reservation. */
export async function markPaidAtVenue(code: string, merchantId: string, actorId: string) {
  const b = await prisma.booking.findUnique({ where: { code }, include: { event: true, merchant: true } });
  if (!b || b.merchantId !== merchantId) throw new UserError("Booking not found");
  if (b.status !== "RESERVED_PAY_AT_VENUE") throw new UserError("This booking is not awaiting payment at the venue");
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED" } });
    await tx.payment.create({
      data: { purpose: "BOOKING", method: "PAY_AT_VENUE", status: "SUCCEEDED", amountCents: b.subtotalCents, idempotencyKey: `venue:${b.id}`, userId: b.userId, merchantId, bookingId: b.id, recordedById: actorId, confirmedAt: new Date() },
    });
    await recordBookingCommission(tx, { id: b.id, code: b.code, merchantId, userId: b.userId, subtotalCents: b.subtotalCents, attribution: b.attribution, paymentMethod: "PAY_AT_VENUE", eventCategoryId: b.event.categoryId, plan: b.merchant.plan });
    await awardPoints(tx, b.userId, b.subtotalCents, await isMember(b.userId, tx), { type: "booking", id: b.id });
    await tx.auditLog.create({ data: { actorId, action: "booking.paid_at_venue", entityType: "booking", entityId: b.id } });
  });
}

/** After the session ends, confirmed bookings become COMPLETED (this is what unlocks verified reviews). */
export async function completePastBookings() {
  const r = await prisma.booking.updateMany({ where: { status: "CONFIRMED", session: { endsAt: { lt: new Date() } } }, data: { status: "COMPLETED" } });
  return r.count;
}
