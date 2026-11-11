import "server-only";
import { prisma } from "./db";
import { UserError } from "./auth";
import { recordReservationCommission } from "./commission";
import { notifyMerchant, notifyUser } from "./notify";
import { beirutYmd, TZ } from "@/lib/dates";
import { shortCode } from "@/lib/codes";

export type Hours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string][]>>;
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function minutesInBeirut(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  return +parts.find((p) => p.type === "hour")!.value * 60 + +parts.find((p) => p.type === "minute")!.value;
}
const toMin = (s: string) => +s.split(":")[0] * 60 + +s.split(":")[1];

/** Is the restaurant open at this instant (Beirut time)? Handles past-midnight closing. */
export function isOpenAt(hours: Hours, at: Date) {
  const day = DAYS[beirutYmd(at).weekday];
  const m = minutesInBeirut(at);
  return (hours[day] ?? []).some(([a, b]) => {
    const s = toMin(a);
    const e = toMin(b);
    return e > s ? m >= s && m < e : m >= s || m < e;
  });
}

export async function requestReservation(userId: string, input: { restaurantId: string; startsAt: Date; adults: number; children: number; requests?: string; phone: string }) {
  const r = await prisma.restaurant.findUnique({ where: { id: input.restaurantId }, include: { merchant: true } });
  if (!r || r.status !== "PUBLISHED" || r.merchant.status !== "APPROVED" || !r.acceptsReservations) throw new UserError("This restaurant doesn't take reservations on EVNT");
  if (input.startsAt.getTime() < Date.now() + 30 * 60_000) throw new UserError("Choose a time at least 30 minutes from now");
  if (input.startsAt.getTime() > Date.now() + 90 * 86400_000) throw new UserError("Reservations open up to 90 days ahead");
  const guests = input.adults + input.children;
  if (input.adults < 1 || guests > r.maxPartySize) throw new UserError("Party size isn't available online. Please contact the restaurant.");
  if (!isOpenAt(r.hours as Hours, input.startsAt)) throw new UserError("The restaurant is closed at that time");
  const dup = await prisma.restaurantReservation.findFirst({ where: { userId, restaurantId: r.id, status: { in: ["REQUESTED", "ACCEPTED", "PROPOSED"] }, startsAt: { gte: new Date(input.startsAt.getTime() - 3 * 3600_000), lte: new Date(input.startsAt.getTime() + 3 * 3600_000) } } });
  if (dup) throw new UserError("You already have a reservation around that time");
  const res = await prisma.restaurantReservation.create({
    data: { code: shortCode("RS"), restaurantId: r.id, userId, startsAt: input.startsAt, adults: input.adults, children: input.children, requests: input.requests?.slice(0, 500), contactPhone: input.phone, depositCents: r.depositCents },
  });
  await notifyMerchant(r.merchantId, { kind: "reservation.new", title: "New reservation request {code}", body: "A family wants to book a table. Accept, decline or propose another time.", vars: { code: res.code }, link: `/merchant/restaurant?tab=reservations` });
  return res;
}

async function loadForMerchant(code: string, merchantId: string) {
  const res = await prisma.restaurantReservation.findUnique({ where: { code }, include: { restaurant: { include: { merchant: true } } } });
  if (!res || res.restaurant.merchantId !== merchantId) throw new UserError("Reservation not found");
  return res;
}

export async function respondReservation(code: string, merchantId: string, actorId: string, action: "accept" | "reject" | "propose", opts: { proposedAt?: Date; note?: string } = {}) {
  const res = await loadForMerchant(code, merchantId);
  if (!["REQUESTED", "PROPOSED"].includes(res.status)) throw new UserError("This reservation can't be changed now");
  if (action === "propose") {
    if (!opts.proposedAt || opts.proposedAt < new Date()) throw new UserError("Choose a future time to propose");
    await prisma.restaurantReservation.update({ where: { id: res.id }, data: { status: "PROPOSED", proposedAt: opts.proposedAt, merchantNote: opts.note?.slice(0, 300) } });
    await notifyUser(res.userId, { kind: "reservation.proposed", title: "{name} proposed another time", body: "Open your reservation to accept or decline the new time.", vars: { name: res.restaurant.name }, link: `/account/reservations` });
  } else {
    await prisma.restaurantReservation.update({ where: { id: res.id }, data: { status: action === "accept" ? "ACCEPTED" : "REJECTED", merchantNote: opts.note?.slice(0, 300) } });
    await notifyUser(res.userId, {
      kind: `reservation.${action}`,
      title: action === "accept" ? "Table confirmed at {name}" : "{name} couldn't take your reservation",
      body: action === "accept" ? "See you there! Your reservation is confirmed." : "Sorry, they're unavailable at that time. Try another time or place.",
      vars: { name: res.restaurant.name },
      link: `/account/reservations`,
    });
  }
  await prisma.auditLog.create({ data: { actorId, action: `reservation.${action}`, entityType: "reservation", entityId: res.id } });
}

/** Parent answers a proposed time. */
export async function answerProposal(code: string, userId: string, accept: boolean) {
  const res = await prisma.restaurantReservation.findUnique({ where: { code }, include: { restaurant: true } });
  if (!res || res.userId !== userId || res.status !== "PROPOSED" || !res.proposedAt) throw new UserError("Reservation not found");
  await prisma.restaurantReservation.update({ where: { id: res.id }, data: accept ? { status: "ACCEPTED", startsAt: res.proposedAt } : { status: "CANCELED" } });
  await notifyMerchant(res.restaurant.merchantId, { kind: "reservation.answer", title: accept ? "Proposed time accepted ({code})" : "Proposed time declined ({code})", body: accept ? "The family accepted your proposed time." : "The family declined the proposed time.", vars: { code }, link: `/merchant/restaurant?tab=reservations`, email: false });
}

export async function cancelReservation(code: string, userId: string) {
  const res = await prisma.restaurantReservation.findUnique({ where: { code }, include: { restaurant: true } });
  if (!res || res.userId !== userId) throw new UserError("Reservation not found");
  if (!["REQUESTED", "ACCEPTED", "PROPOSED"].includes(res.status)) throw new UserError("This reservation can't be cancelled");
  await prisma.restaurantReservation.update({ where: { id: res.id }, data: { status: "CANCELED" } });
  await notifyMerchant(res.restaurant.merchantId, { kind: "reservation.canceled", title: "Reservation {code} cancelled", body: "The family cancelled their reservation.", vars: { code }, link: `/merchant/restaurant?tab=reservations`, email: false });
}

/**
 * After the visit the restaurant confirms how many guests actually came. That verified count is what
 * the per-guest fee is charged on. No-shows and cancellations are never charged.
 */
export async function completeReservation(code: string, merchantId: string, actorId: string, guests: number | "no-show") {
  const res = await loadForMerchant(code, merchantId);
  if (res.status !== "ACCEPTED") throw new UserError("Only accepted reservations can be completed");
  if (res.startsAt > new Date()) throw new UserError("You can confirm guests after the reservation time");
  if (guests === "no-show") {
    await prisma.restaurantReservation.update({ where: { id: res.id }, data: { status: "NO_SHOW", verifiedAt: new Date(), verifiedById: actorId } });
    return;
  }
  const n = Math.floor(guests);
  if (n < 1 || n > 200) throw new UserError("Enter the number of guests who came");
  await prisma.$transaction(async (tx) => {
    await tx.restaurantReservation.update({ where: { id: res.id }, data: { status: "COMPLETED", completedGuests: n, verifiedAt: new Date(), verifiedById: actorId } });
    await recordReservationCommission(tx, { id: res.id, code: res.code, merchantId, plan: res.restaurant.merchant.plan, guests: n });
    await tx.auditLog.create({ data: { actorId, action: "reservation.completed", entityType: "reservation", entityId: res.id, data: { guests: n } } });
  });
  await notifyUser(res.userId, { kind: "reservation.completed", title: "How was {name}?", body: "Tell other parents about your visit — your review will be marked verified.", vars: { name: res.restaurant.name }, link: `/restaurants/${res.restaurant.slug}#reviews` });
}

/** A deposit paid with Whish (verified) for an accepted reservation. */
export async function applyDepositPayment(paymentId: string, outcome: "success" | "failed") {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p?.reservationId) return;
  if (outcome === "failed") {
    await prisma.payment.updateMany({ where: { id: p.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: "FAILED" } });
    return;
  }
  const marked = await prisma.payment.updateMany({ where: { id: p.id, status: { in: ["INITIATED", "PENDING", "FAILED"] } }, data: { status: "SUCCEEDED", confirmedAt: new Date() } });
  if (!marked.count) return;
  const res = await prisma.restaurantReservation.update({ where: { id: p.reservationId }, data: { depositPaid: true }, include: { restaurant: true } });
  // EVNT collected the deposit on the restaurant's behalf: it's owed to them.
  await prisma.ledgerEntry.create({ data: { merchantId: res.restaurant.merchantId, type: "SALE", amountCents: p.amountCents, memo: `Deposit ${res.code}`, refType: "reservation", refId: res.id } });
  await notifyMerchant(res.restaurant.merchantId, { kind: "reservation.deposit", title: "Deposit paid for {code}", body: "The family paid the reservation deposit.", vars: { code: res.code }, link: "/merchant/restaurant?tab=reservations", email: false });
}
