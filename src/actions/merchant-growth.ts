"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BillingInterval, PlanCode, StaffRole } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireMerchant, UserError } from "@/server/auth";
import { createCampaign, notifyCampaignSubmitted } from "@/server/ads";
import { changePlan } from "@/server/billing";
import { merchantFeatures } from "@/server/features";
import { startWhishPayment } from "@/server/payments";
import { parseBeirutLocal, startOfBeirutDay } from "@/lib/dates";
import { normalizeMobile, normalizePhone } from "@/lib/phone";
import { AREAS } from "@/lib/areas";
import { getT } from "@/i18n/server";
import { localizedFromForm } from "@/i18n/core";

export type FormResult = { error?: string; message?: string; fieldErrors?: Record<string, string> } | undefined;

const fail = async (e: unknown) => {
  const t = await getT();
  if (e instanceof UserError) return { error: t(e.message) };
  throw e;
};

export async function createCampaignAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const startsAt = parseBeirutLocal(String(form.get("start") ?? ""), "00:00");
  const endsAt = parseBeirutLocal(String(form.get("end") ?? ""), "23:59");
  if (!startsAt || !endsAt) return { error: t("Choose start and end dates") };
  const target = String(form.get("target") ?? "");
  const [kind, id] = target.split(":");
  try {
    const c = await createCampaign(ctx.merchant.id, ctx.user.id, {
      placementCode: String(form.get("placement") ?? ""),
      startsAt,
      endsAt,
      headline: String(form.get("headline") ?? "").trim(),
      creativeId: String(form.get("creativeId") ?? "") || null,
      eventId: kind === "event" ? id : null,
      productId: kind === "product" ? id : null,
      restaurantId: kind === "restaurant" ? id : null,
      categoryId: String(form.get("categoryId") ?? "") || null,
    });
    await notifyCampaignSubmitted(c.id);
    revalidatePath("/merchant/ads");
    return { message: c.invoiceId ? t("Campaign created. Pay its invoice to send it for approval.") : t("Campaign submitted for approval.") };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelCampaignAction(id: string) {
  const ctx = await requireMerchant("MANAGER");
  const c = await prisma.adCampaign.findUnique({ where: { id } });
  if (!c || c.merchantId !== ctx.merchant.id || !["DRAFT", "PENDING_PAYMENT"].includes(c.status)) return { error: "This campaign can't be cancelled" };
  await prisma.adCampaign.update({ where: { id }, data: { status: "CANCELED" } });
  if (c.invoiceId) await prisma.invoice.updateMany({ where: { id: c.invoiceId, status: { in: ["OPEN", "OVERDUE"] } }, data: { status: "VOID" } });
  revalidatePath("/merchant/ads");
  return {};
}

export async function createFlashPromoAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const f = await merchantFeatures(ctx.merchant);
  const monthStart = startOfBeirutDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const used = await prisma.flashPromotion.count({ where: { merchantId: ctx.merchant.id, createdAt: { gte: monthStart } } });
  if (used >= f.flashPromos) return { error: f.flashPromos ? t("You've used your {n} flash promotions this month.", { n: f.flashPromos }) : t("Flash promotions are included in the Pro and Featured plans.") };
  const pct = parseInt(String(form.get("percent") ?? ""), 10);
  if (!(pct >= 5 && pct <= 70)) return { error: t("Choose a discount between 5% and 70%") };
  const startsAt = parseBeirutLocal(String(form.get("start") ?? ""), String(form.get("startTime") || "00:00"));
  const hours = Math.max(1, Math.min(14 * 24, parseInt(String(form.get("hours") ?? "48"), 10) || 48));
  if (!startsAt) return { error: t("Choose when it starts") };
  const [kind, id] = String(form.get("target") ?? "").split(":");
  if (kind === "event" && !(await prisma.event.findFirst({ where: { id, merchantId: ctx.merchant.id } }))) return { error: t("Invalid listing") };
  if (kind === "product" && !(await prisma.product.findFirst({ where: { id, merchantId: ctx.merchant.id } }))) return { error: t("Invalid product") };
  if (kind !== "event" && kind !== "product") return { error: t("Choose what to promote") };
  await prisma.flashPromotion.create({ data: { merchantId: ctx.merchant.id, eventId: kind === "event" ? id : null, productId: kind === "product" ? id : null, percentOff: pct, startsAt, endsAt: new Date(startsAt.getTime() + hours * 3600_000) } });
  revalidatePath("/merchant/promotions");
  return { message: t("Flash promotion scheduled") };
}

export async function changePlanAction(plan: PlanCode, interval: BillingInterval) {
  const t = await getT();
  const ctx = await requireMerchant("OWNER");
  let r;
  try {
    r = await changePlan(ctx.merchant.id, plan, interval, { useTrial: true, actorId: ctx.user.id });
  } catch (e) {
    return fail(e);
  }
  if ("invoiceId" in r && r.invoiceId) redirect(`/merchant/billing/${r.invoiceId}`);
  revalidatePath("/merchant/subscription");
  return { message: "trial" in r ? t("Your free trial has started") : "scheduled" in r ? t("You'll move to Basic at the end of your paid period") : t("Plan updated") };
}

export async function payInvoiceAction(invoiceId: string) {
  const t = await getT();
  const ctx = await requireMerchant("OWNER");
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv || inv.merchantId !== ctx.merchant.id || !["OPEN", "OVERDUE"].includes(inv.status)) return { error: t("This invoice can't be paid") };
  let url: string;
  try {
    ({ redirectUrl: url } = await startWhishPayment({ purpose: "INVOICE", amountCents: inv.totalCents, description: `EVNT invoice ${inv.number}`, userId: ctx.user.id, merchantId: ctx.merchant.id, invoiceId: inv.id, returnPath: `/merchant/billing/${inv.id}` }));
  } catch (e) {
    return fail(e);
  }
  redirect(url);
}

export async function replyReviewAction(reviewId: string, reply?: string) {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const r = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!r || r.merchantId !== ctx.merchant.id) return { error: t("Not found") };
  const text = (reply ?? "").trim();
  if (text.length < 2) return { error: t("Write a reply") };
  await prisma.review.update({ where: { id: reviewId }, data: { merchantReply: text.slice(0, 1000), repliedAt: new Date() } });
  revalidatePath("/merchant/reviews");
  return {};
}

export async function reportReviewAsMerchantAction(reviewId: string, reason?: string) {
  const ctx = await requireMerchant("MANAGER");
  const r = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!r || r.merchantId !== ctx.merchant.id) return { error: "Not found" };
  await prisma.reviewReport.create({ data: { reviewId, reporterId: ctx.user.id, reason: `[merchant] ${(reason ?? "").slice(0, 400)}` } });
  return {};
}

export async function saveProfileAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { fieldErrors: { name: t("Enter your business name") } };
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  if (!phone.ok) return { fieldErrors: { phone: t(phone.error) } };
  const wa = String(form.get("whatsapp") ?? "").trim();
  const whatsapp = wa ? normalizeMobile(wa) : null;
  if (whatsapp && !whatsapp.ok) return { fieldErrors: { whatsapp: t(whatsapp.error) } };
  const website = String(form.get("website") ?? "").trim();
  if (website && !/^https?:\/\/\S+\.\S+/.test(website)) return { fieldErrors: { website: t("Enter a full address starting with https://") } };
  await prisma.merchant.update({
    where: { id: ctx.merchant.id },
    data: {
      name,
      about: localizedFromForm(form, "about"),
      phone: phone.e164,
      whatsapp: whatsapp?.ok ? whatsapp.e164 : null,
      email: String(form.get("email") ?? "").trim() || null,
      website: website || null,
      instagram: String(form.get("instagram") ?? "").trim().replace(/^@/, "") || null,
      logoId: String(form.get("logoId") ?? "") || null,
      coverId: String(form.get("coverId") ?? "") || null,
      ...(ctx.staffRole === "OWNER" && String(form.get("payoutAccount") ?? "").trim()
        ? { payoutMethod: String(form.get("payoutMethod") ?? "whish"), payoutName: String(form.get("payoutName") ?? "").trim(), payoutAccount: String(form.get("payoutAccount") ?? "").trim().slice(0, 60) }
        : {}),
    },
  });
  await prisma.auditLog.create({ data: { actorId: ctx.user.id, action: "merchant.profile", entityType: "merchant", entityId: ctx.merchant.id } });
  revalidatePath("/merchant/profile");
  return { message: t("Saved") };
}

export async function addLocationAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const area = String(form.get("area") ?? "");
  const a = AREAS.find((x) => x.slug === area);
  const address = String(form.get("address") ?? "").trim();
  if (!a || address.length < 3) return { error: t("Choose an area and enter the address") };
  const lat = parseFloat(String(form.get("lat") ?? ""));
  const lng = parseFloat(String(form.get("lng") ?? ""));
  await prisma.merchantLocation.create({ data: { merchantId: ctx.merchant.id, name: String(form.get("name") ?? "").trim() || a.en, area, address, lat: Number.isFinite(lat) ? lat : a.lat, lng: Number.isFinite(lng) ? lng : a.lng } });
  revalidatePath("/merchant/profile");
  return { message: t("Location added") };
}

export async function removeLocationAction(id: string) {
  const ctx = await requireMerchant("MANAGER");
  const l = await prisma.merchantLocation.findUnique({ where: { id }, include: { _count: { select: { events: true, restaurants: true } } } });
  if (!l || l.merchantId !== ctx.merchant.id) return { error: "Not found" };
  if (l._count.events || l._count.restaurants) return { error: "This location is used by listings" };
  await prisma.merchantLocation.delete({ where: { id } });
  revalidatePath("/merchant/profile");
  return {};
}

export async function inviteStaffAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const ctx = await requireMerchant("OWNER");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = (["MANAGER", "STAFF"].includes(String(form.get("role"))) ? form.get("role") : "STAFF") as StaffRole;
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) return { error: t("Ask them to create an EVNT account with this email first, then invite them.") };
  await prisma.merchantStaff.upsert({ where: { merchantId_userId: { merchantId: ctx.merchant.id, userId: u.id } }, create: { merchantId: ctx.merchant.id, userId: u.id, role }, update: { role } });
  await prisma.auditLog.create({ data: { actorId: ctx.user.id, action: "staff.added", entityType: "merchant", entityId: ctx.merchant.id, data: { email, role } } });
  revalidatePath("/merchant/team");
  return { message: t("Added to your team") };
}

export async function removeStaffAction(userId: string) {
  const ctx = await requireMerchant("OWNER");
  if (userId === ctx.user.id) return { error: "You can't remove yourself" };
  await prisma.merchantStaff.deleteMany({ where: { merchantId: ctx.merchant.id, userId, role: { not: "OWNER" } } });
  revalidatePath("/merchant/team");
  return {};
}

export async function markMerchantNotificationsReadAction() {
  const ctx = await requireMerchant();
  await prisma.notification.updateMany({ where: { merchantId: ctx.merchant.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/merchant/notifications");
}


/** A merchant disputes a commission (e.g. an external booking they believe wasn't EVNT-generated). */
export async function disputeCommissionAction(refType: string, refId: string, reason?: string) {
  const t = await getT();
  const ctx = await requireMerchant("OWNER");
  const map: Record<string, { source: "BOOKING" | "ORDER" | "RESERVATION"; id: string }> = {
    booking: { source: "BOOKING", id: refId },
    order: { source: "ORDER", id: refId },
    reservation: { source: "RESERVATION", id: refId },
    external: { source: "BOOKING", id: `ext:${refId}` },
  };
  const k = map[refType];
  const c = k ? await prisma.commission.findUnique({ where: { source_sourceId: { source: k.source, sourceId: k.id } } }) : null;
  if (!c || c.merchantId !== ctx.merchant.id) return { error: t("Not found") };
  if (!reason?.trim()) return { error: t("Explain why you dispute this commission") };
  if (await prisma.commissionDispute.findFirst({ where: { commissionId: c.id, status: "OPEN" } })) return { error: t("A dispute is already open for this") };
  await prisma.commissionDispute.create({ data: { commissionId: c.id, openedById: ctx.user.id, reason: reason.slice(0, 1000) } });
  revalidatePath("/merchant/billing");
  return {};
}
