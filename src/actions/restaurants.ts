"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { getCurrentUser, requireMerchant, UserError } from "@/server/auth";
import { answerProposal, cancelReservation, completeReservation, requestReservation, respondReservation } from "@/server/restaurants";
import { reindexRestaurant } from "@/server/listings";
import { rateLimit } from "@/server/rate-limit";
import { startWhishPayment } from "@/server/payments";
import { redirect } from "next/navigation";
import { normalizeMobile } from "@/lib/phone";
import { parseBeirutLocal } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import { slugify } from "@/lib/codes";
import { getT } from "@/i18n/server";
import { localizedFromForm } from "@/i18n/core";

export type FormResult = { error?: string; fieldErrors?: Record<string, string>; message?: string; ok?: boolean } | undefined;

const wrap = async (fn: () => Promise<unknown>) => {
  const t = await getT();
  try {
    await fn();
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  return {};
};

export async function requestReservationAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in to reserve") };
  if (!rateLimit(`reserve:${user.id}`, 10, 3600_000).ok) return { error: t("Too many attempts. Try again in a few minutes.") };
  const startsAt = parseBeirutLocal(String(form.get("date") ?? ""), String(form.get("time") ?? ""));
  if (!startsAt) return { error: t("Choose a date and time") };
  const phone = normalizeMobile(String(form.get("phone") ?? ""));
  if (!phone.ok) return { fieldErrors: { phone: t(phone.error) } };
  const r = await wrap(() =>
    requestReservation(user.id, {
      restaurantId: String(form.get("restaurantId")),
      startsAt,
      adults: Math.max(0, parseInt(String(form.get("adults") ?? "2"), 10) || 0),
      children: Math.max(0, parseInt(String(form.get("children") ?? "0"), 10) || 0),
      requests: String(form.get("requests") ?? ""),
      phone: phone.e164,
    }),
  );
  if ("error" in r) return r;
  return { ok: true, message: t("Request sent! The restaurant will confirm shortly.") };
}

export async function cancelReservationAction(code: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in" };
  const r = await wrap(() => cancelReservation(code, user.id));
  revalidatePath("/account/reservations");
  return r;
}

export async function answerProposalAction(code: string, accept: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in" };
  const r = await wrap(() => answerProposal(code, user.id, accept));
  revalidatePath("/account/reservations");
  return r;
}

export async function respondReservationAction(code: string, action: "accept" | "reject" | "propose", input?: string) {
  const t = await getT();
  const ctx = await requireMerchant("STAFF");
  let proposedAt: Date | undefined;
  if (action === "propose") {
    const m = (input ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})$/);
    proposedAt = m ? parseBeirutLocal(m[1], m[2]) ?? undefined : undefined;
    if (!proposedAt) return { error: t("Use the format 2026-12-24 19:30") };
  }
  const r = await wrap(() => respondReservation(code, ctx.merchant.id, ctx.user.id, action, { proposedAt, note: action === "reject" ? input : undefined }));
  revalidatePath("/merchant/restaurant");
  return r;
}

export async function completeReservationAction(code: string, input?: string) {
  const t = await getT();
  const ctx = await requireMerchant("STAFF");
  const v = (input ?? "").trim().toLowerCase();
  const guests = v === "0" || v === "no-show" ? "no-show" : parseInt(v, 10);
  if (guests !== "no-show" && !Number.isFinite(guests)) return { error: t("Enter the number of guests, or 0 for a no-show") };
  const r = await wrap(() => completeReservation(code, ctx.merchant.id, ctx.user.id, guests as number | "no-show"));
  revalidatePath("/merchant/restaurant");
  return r;
}

const FACILITIES = ["kidsMenu", "highChairs", "playArea", "outdoorSeating", "strollerAccess", "changingFacilities", "parking", "birthdaySuitable"] as const;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export async function saveRestaurantAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { fieldErrors: { name: t("Enter the restaurant name") } };
  const hours: Record<string, [string, string][]> = {};
  for (const d of DAYS) {
    if (form.get(`${d}_closed`) === "on") continue;
    const a = String(form.get(`${d}_open`) ?? "");
    const b = String(form.get(`${d}_close`) ?? "");
    if (/^\d{2}:\d{2}$/.test(a) && /^\d{2}:\d{2}$/.test(b)) hours[d] = [[a, b]];
  }
  const deposit = parseMoney(String(form.get("deposit") ?? "0")) ?? 0;
  const cover = String(form.get("coverId") ?? "");
  const data = {
    name,
    about: localizedFromForm(form, "about"),
    cuisines: String(form.get("cuisines") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6),
    priceLevel: Math.max(1, Math.min(4, parseInt(String(form.get("priceLevel") ?? "2"), 10) || 2)),
    hours,
    locationId: String(form.get("locationId") ?? "") || null,
    gallery: String(form.get("gallery") ?? "").split(",").filter(Boolean).slice(0, 12),
    coverId: cover && !cover.startsWith("/") ? cover : null,
    coverUrl: cover.startsWith("/") ? cover : null,
    acceptsReservations: form.get("acceptsReservations") === "on",
    maxPartySize: Math.max(1, Math.min(60, parseInt(String(form.get("maxPartySize") ?? "12"), 10) || 12)),
    depositCents: deposit,
    ...Object.fromEntries(FACILITIES.map((f) => [f, form.get(f) === "on"])),
  };
  if (data.locationId) {
    const l = await prisma.merchantLocation.findUnique({ where: { id: data.locationId } });
    if (!l || l.merchantId !== ctx.merchant.id) return { error: t("Invalid location") };
  }
  const existing = await prisma.restaurant.findFirst({ where: { merchantId: ctx.merchant.id } });
  let id: string;
  if (existing) id = (await prisma.restaurant.update({ where: { id: existing.id }, data })).id;
  else {
    let slug = slugify(name);
    if (await prisma.restaurant.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    id = (await prisma.restaurant.create({ data: { ...data, slug, merchantId: ctx.merchant.id, status: ctx.merchant.status === "APPROVED" ? "PUBLISHED" : "DRAFT" } })).id;
  }
  if (ctx.merchant.status === "APPROVED" && form.get("publish") === "on") await prisma.restaurant.update({ where: { id }, data: { status: "PUBLISHED" } });
  if (form.get("publish") !== "on") await prisma.restaurant.update({ where: { id }, data: { status: "DRAFT" } });
  await reindexRestaurant(id);
  revalidatePath("/merchant/restaurant");
  return { message: t("Saved") };
}

export async function payDepositAction(code: string) {
  const t = await getT();
  const user = await getCurrentUser();
  const res = await prisma.restaurantReservation.findUnique({ where: { code }, include: { restaurant: true } });
  if (!user || !res || res.userId !== user.id) return { error: t("Reservation not found") };
  if (res.status !== "ACCEPTED" || res.depositPaid || !res.depositCents) return { error: t("No deposit is due") };
  let url: string;
  try {
    ({ redirectUrl: url } = await startWhishPayment({ purpose: "RESERVATION_DEPOSIT", amountCents: res.depositCents, description: `Deposit ${res.code} — ${res.restaurant.name}`, userId: user.id, merchantId: res.restaurant.merchantId, reservationId: res.id, returnPath: "/account/reservations" }));
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  redirect(url);
}
