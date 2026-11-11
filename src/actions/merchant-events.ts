"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { VenueSetting } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireMerchant, UserError } from "@/server/auth";
import { reindexEvent } from "@/server/listings";
import { cancelBooking } from "@/server/booking";
import { notifyUser } from "@/server/notify";
import { getT } from "@/i18n/server";
import { localizedFromForm } from "@/i18n/core";
import { slugify } from "@/lib/codes";
import { parseMoney } from "@/lib/money";
import { parseBeirutLocal } from "@/lib/dates";

export type FormResult = { error?: string; fieldErrors?: Record<string, string>; message?: string } | undefined;

async function ownEvent(eventId: string) {
  const ctx = await requireMerchant("MANAGER");
  const e = await prisma.event.findUnique({ where: { id: eventId } });
  // Tenant isolation: a merchant can only touch its own listings.
  if (!e || e.merchantId !== ctx.merchant.id) throw new UserError("Not found");
  return { ctx, e };
}

async function uniqueEventSlug(title: string, exceptId?: string) {
  const base = slugify(title);
  for (let i = 0; i < 100; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    const hit = await prisma.event.findUnique({ where: { slug: s } });
    if (!hit || hit.id === exceptId) return s;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function refreshFromPrice(eventId: string) {
  const tts = await prisma.ticketType.findMany({ where: { eventId, active: true } });
  const min = tts.length ? Math.min(...tts.map((t) => t.priceCents)) : 0;
  await prisma.event.update({ where: { id: eventId }, data: { fromPriceCents: min, isFree: tts.length > 0 && tts.every((t) => t.priceCents === 0) } });
}

/** The cover input holds a media id, or a URL for imported/demo images. */
function coverFields(v: string) {
  if (!v) return { coverId: null, coverUrl: null };
  if (v.startsWith("/") || v.startsWith("http")) return { coverId: null, coverUrl: v.slice(0, 500) };
  return { coverId: v, coverUrl: null };
}

export async function saveEventAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const id = String(form.get("id") ?? "");
  const title = localizedFromForm(form, "title");
  if (!title.en && !title.ar && !title.fr) return { fieldErrors: { title: t("Enter a title") } };
  const categoryId = String(form.get("categoryId") ?? "");
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat || cat.kind !== "EVENT") return { fieldErrors: { categoryId: t("Choose a category") } };
  const locationId = String(form.get("locationId") ?? "") || null;
  if (locationId) {
    const l = await prisma.merchantLocation.findUnique({ where: { id: locationId } });
    if (!l || l.merchantId !== ctx.merchant.id) return { error: t("Invalid location") };
  }
  const ageMin = Math.max(0, Math.min(16, parseInt(String(form.get("ageMin") ?? "0"), 10) || 0));
  const ageMax = Math.max(ageMin, Math.min(16, parseInt(String(form.get("ageMax") ?? "12"), 10) || 12));
  const setting = (["INDOOR", "OUTDOOR", "BOTH"].includes(String(form.get("setting"))) ? form.get("setting") : "INDOOR") as VenueSetting;
  const seatingMode = form.get("seatingMode") === "ASSIGNED" ? "ASSIGNED" : "GENERAL";
  const seatingMapId = seatingMode === "ASSIGNED" ? String(form.get("seatingMapId") ?? "") || null : null;
  if (seatingMode === "ASSIGNED") {
    const map = seatingMapId ? await prisma.seatingMap.findUnique({ where: { id: seatingMapId } }) : null;
    if (!map || map.merchantId !== ctx.merchant.id) return { fieldErrors: { seatingMapId: t("Choose a seating map (create one in Seating maps)") } };
  }
  const videoUrl = String(form.get("videoUrl") ?? "").trim();
  if (videoUrl && !/^https:\/\//.test(videoUrl)) return { fieldErrors: { videoUrl: t("Video link must start with https://") } };
  const gallery = String(form.get("gallery") ?? "").split(",").filter(Boolean).slice(0, 12);
  const data = {
    title,
    summary: localizedFromForm(form, "summary"),
    description: localizedFromForm(form, "description"),
    included: localizedFromForm(form, "included"),
    importantInfo: localizedFromForm(form, "importantInfo"),
    cancellationPolicy: localizedFromForm(form, "cancellationPolicy"),
    categoryId,
    locationId,
    ageMin,
    ageMax,
    setting,
    accessible: form.get("accessible") === "on",
    payAtVenue: form.get("payAtVenue") === "on",
    memberEarlyAccess: form.get("memberEarlyAccess") === "on",
    seatingMode: seatingMode as "GENERAL" | "ASSIGNED",
    seatingMapId,
    ...coverFields(String(form.get("coverId") ?? "")),
    videoUrl: videoUrl || null,
  };
  let eventId = id;
  if (id) {
    const { e } = await ownEvent(id);
    if (e.seatingMode !== seatingMode || e.seatingMapId !== seatingMapId) {
      const sold = await prisma.booking.count({ where: { eventId: id, status: { in: ["CONFIRMED", "RESERVED_PAY_AT_VENUE", "PENDING_PAYMENT"] } } });
      if (sold) return { error: t("Seating can't be changed after bookings were made. Create a new listing instead.") };
    }
    await prisma.event.update({ where: { id }, data });
  } else {
    const e = await prisma.event.create({ data: { ...data, merchantId: ctx.merchant.id, slug: await uniqueEventSlug(title.en || title.fr || title.ar || "activity"), status: "DRAFT" } });
    eventId = e.id;
  }
  await prisma.eventMedia.deleteMany({ where: { eventId } });
  if (gallery.length) await prisma.eventMedia.createMany({ data: gallery.map((g, i) => ({ eventId, mediaId: g.startsWith("/") ? null : g, url: g.startsWith("/") ? g : null, sort: i })) });
  await reindexEvent(eventId);
  await prisma.auditLog.create({ data: { actorId: ctx.user.id, action: id ? "event.updated" : "event.created", entityType: "event", entityId: eventId } });
  revalidatePath("/merchant/events");
  if (!id) redirect(`/merchant/events/${eventId}?tab=tickets`);
  return { message: t("Saved") };
}

export async function saveTicketTypeAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const { e } = await ownEvent(String(form.get("eventId")));
  const name = localizedFromForm(form, "name");
  if (!name.en && !name.ar && !name.fr) return { error: t("Enter a ticket name") };
  const price = parseMoney(String(form.get("price") ?? "0"));
  if (price == null) return { error: t("Enter a valid price") };
  const maxQty = Math.max(1, Math.min(50, parseInt(String(form.get("maxQty") ?? "10"), 10) || 10));
  const minQty = Math.max(1, Math.min(maxQty, parseInt(String(form.get("minQty") ?? "1"), 10) || 1));
  const zone = String(form.get("zone") ?? "") || null;
  const id = String(form.get("ticketId") ?? "");
  if (id) {
    const tt = await prisma.ticketType.findUnique({ where: { id } });
    if (!tt || tt.eventId !== e.id) return { error: t("Not found") };
    await prisma.ticketType.update({ where: { id }, data: { name, priceCents: price, minQty, maxQty, zone } });
  } else {
    await prisma.ticketType.create({ data: { eventId: e.id, name, priceCents: price, minQty, maxQty, zone, sort: await prisma.ticketType.count({ where: { eventId: e.id } }) } });
  }
  await refreshFromPrice(e.id);
  await reindexEvent(e.id);
  revalidatePath(`/merchant/events/${e.id}`);
  return { message: t("Saved") };
}

export async function toggleTicketTypeAction(ticketId: string) {
  const tt = await prisma.ticketType.findUnique({ where: { id: ticketId } });
  if (!tt) return;
  await ownEvent(tt.eventId);
  await prisma.ticketType.update({ where: { id: ticketId }, data: { active: !tt.active } });
  await refreshFromPrice(tt.eventId);
  revalidatePath(`/merchant/events/${tt.eventId}`);
}

/** Adds one session, or a weekly series (same weekday/time for N weeks). */
export async function addSessionsAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const { e } = await ownEvent(String(form.get("eventId")));
  const start = parseBeirutLocal(String(form.get("date")), String(form.get("time")));
  if (!start || start < new Date()) return { error: t("Choose a future date and time") };
  const minutes = Math.max(15, Math.min(60 * 24 * 14, parseInt(String(form.get("duration") ?? "120"), 10) || 120));
  const capacity = e.seatingMode === "ASSIGNED" ? 0 : Math.max(1, Math.min(100000, parseInt(String(form.get("capacity") ?? "0"), 10) || 0));
  if (e.seatingMode === "GENERAL" && !capacity) return { error: t("Enter the number of spots") };
  const weeks = Math.max(1, Math.min(26, parseInt(String(form.get("repeatWeeks") ?? "1"), 10) || 1));
  const salesOpen = String(form.get("salesDate") ?? "") ? parseBeirutLocal(String(form.get("salesDate")), String(form.get("salesTime") || "09:00")) : null;
  const data = Array.from({ length: weeks }, (_, i) => {
    const s = new Date(start.getTime() + i * 7 * 86400_000);
    return { eventId: e.id, startsAt: s, endsAt: new Date(s.getTime() + minutes * 60_000), capacity, salesStartAt: i === 0 ? salesOpen : null };
  });
  await prisma.eventSession.createMany({ data });
  revalidatePath(`/merchant/events/${e.id}`);
  return { message: t(weeks === 1 ? "Session added" : "{n} sessions added", { n: weeks }) };
}

export async function updateCapacityAction(sessionId: string, capacity: number) {
  const s = await prisma.eventSession.findUnique({ where: { id: sessionId } });
  if (!s) return { error: "Not found" };
  await ownEvent(s.eventId);
  if (capacity < s.reserved) return { error: "Capacity can't be lower than spots already booked or held" };
  await prisma.eventSession.update({ where: { id: sessionId }, data: { capacity: Math.min(100000, Math.max(0, Math.floor(capacity))) } });
  revalidatePath(`/merchant/events/${s.eventId}`);
  return {};
}

/** Cancels a session: every booking is cancelled (refunds recorded) and parents are told. */
export async function cancelSessionAction(sessionId: string) {
  const s = await prisma.eventSession.findUnique({ where: { id: sessionId } });
  if (!s) return;
  const { ctx } = await ownEvent(s.eventId);
  await prisma.eventSession.update({ where: { id: sessionId }, data: { status: "CANCELED" } });
  const bookings = await prisma.booking.findMany({ where: { sessionId, status: { in: ["PENDING_PAYMENT", "CONFIRMED", "RESERVED_PAY_AT_VENUE"] } } });
  for (const b of bookings) {
    await cancelBooking(b.code, { userId: ctx.user.id, as: "merchant", merchantId: ctx.merchant.id }, "Session cancelled by the organizer").catch((e) => console.error(e));
    await notifyUser(b.userId, { kind: "session.canceled", title: "A session you booked was cancelled", body: "The organizer cancelled this session. Your booking was cancelled and any payment will be refunded.", link: `/account/bookings/${b.code}` });
  }
  await prisma.auditLog.create({ data: { actorId: ctx.user.id, action: "session.canceled", entityType: "session", entityId: sessionId, data: { bookings: bookings.length } } });
  revalidatePath(`/merchant/events/${s.eventId}`);
}

export async function setEventStatusAction(eventId: string, status: "PUBLISHED" | "DRAFT" | "ARCHIVED") {
  const t = await getT();
  const { ctx, e } = await ownEvent(eventId);
  if (status === "PUBLISHED") {
    if (ctx.merchant.status !== "APPROVED") return { error: t("Your business must be verified before listings can go live.") };
    const [tickets, sessions] = await Promise.all([
      prisma.ticketType.count({ where: { eventId, active: true } }),
      prisma.eventSession.count({ where: { eventId, status: "SCHEDULED", startsAt: { gt: new Date() } } }),
    ]);
    if (!tickets) return { error: t("Add at least one ticket type first.") };
    if (!sessions) return { error: t("Add at least one upcoming date first.") };
    if (!e.coverId && !e.coverUrl) return { error: t("Add a cover photo first.") };
    if (e.seatingMode === "ASSIGNED") {
      const map = await prisma.seatingMap.findUnique({ where: { id: e.seatingMapId ?? "" }, include: { seats: { select: { zone: true } } } });
      const tts = await prisma.ticketType.findMany({ where: { eventId, active: true } });
      const missing = [...new Set(map?.seats.map((s) => s.zone) ?? [])].filter((z) => !tts.some((x) => x.zone === z || !x.zone));
      if (missing.length) return { error: t("Add a ticket price for every seating zone: {zones}", { zones: missing.join(", ") }) };
    }
  }
  await prisma.event.update({ where: { id: eventId }, data: { status, publishedAt: status === "PUBLISHED" ? e.publishedAt ?? new Date() : e.publishedAt } });
  await prisma.auditLog.create({ data: { actorId: ctx.user.id, action: `event.${status.toLowerCase()}`, entityType: "event", entityId: eventId } });
  revalidatePath(`/merchant/events/${eventId}`);
  revalidatePath("/merchant/events");
  return {};
}
