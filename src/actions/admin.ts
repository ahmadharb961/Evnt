"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { BillingInterval, CommissionCategory, MerchantStatus, PlanCode, Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { ADMIN_AS_COOKIE, hasRole, requireAdmin, UserError } from "@/server/auth";
import { changePlan, createInvoice, createPayout, invoiceCommissions, markInvoicePaid } from "@/server/billing";
import { reviewCampaign } from "@/server/ads";
import { grantMembership } from "@/server/plus";
import { refreshRatings } from "@/server/reviews";
import { reindexAll } from "@/server/reindex";
import { clearSettingsCache, DEFAULTS, setSetting, type SettingKey } from "@/server/settings";
import { clearTranslationCache } from "@/server/translations";
import { notifyMerchant, notifyUser } from "@/server/notify";
import { getSetting } from "@/server/settings";
import { commissionFor, withinExternalWindow } from "@/lib/commission";
import { parseMoney } from "@/lib/money";
import { slugify } from "@/lib/codes";
import { localizedFromForm } from "@/i18n/core";

export type FormResult = { error?: string; message?: string } | undefined;

async function guard<T>(roles: Role[], fn: (actorId: string) => Promise<T>, path?: string) {
  const u = await requireAdmin(...roles);
  try {
    await fn(u.id);
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  if (path) revalidatePath(path);
  return { message: "Saved" };
}
const audit = (actorId: string, action: string, entityType: string, entityId?: string, data?: object) => prisma.auditLog.create({ data: { actorId, action, entityType, entityId, data } });

// ───────────── Merchants ─────────────

export async function setMerchantStatusAction(merchantId: string, status: MerchantStatus, reason?: string) {
  return guard(["ADMIN"], async (actor) => {
    const m = await prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } });
    await prisma.merchant.update({ where: { id: merchantId }, data: { status, verifiedAt: status === "APPROVED" ? m.verifiedAt ?? new Date() : m.verifiedAt, rejectionReason: status === "REJECTED" ? reason ?? "" : null } });
    if (status === "APPROVED") await prisma.restaurant.updateMany({ where: { merchantId, status: "DRAFT" }, data: { status: "PUBLISHED" } });
    await audit(actor, `merchant.${status.toLowerCase()}`, "merchant", merchantId, { reason });
    const msg: Partial<Record<MerchantStatus, [string, string]>> = {
      APPROVED: ["Your business is verified on EVNT!", "You can now publish your listings and receive bookings."],
      REJECTED: ["Your EVNT application needs changes", `Please update your details: ${reason ?? ""}`],
      SUSPENDED: ["Your EVNT business has been suspended", `Reason: ${reason ?? ""}. Contact support for help.`],
    };
    if (msg[status]) await notifyMerchant(merchantId, { kind: `merchant.${status.toLowerCase()}`, title: msg[status]![0], body: msg[status]![1], link: "/merchant" });
  }, `/admin/merchants/${merchantId}`);
}

export async function overridePlanAction(merchantId: string, plan: PlanCode, input?: string) {
  return guard(["ADMIN", "FINANCE"], async (actor) => {
    const months = Math.max(1, Math.min(24, parseInt(input ?? "1", 10) || 1));
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + months);
    await prisma.$transaction([
      prisma.merchantSubscription.updateMany({ where: { merchantId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE", "PENDING_PAYMENT"] } }, data: { status: "CANCELED", endedAt: now } }),
      prisma.merchantSubscription.create({ data: { merchantId, plan, interval: "MONTHLY", status: "ACTIVE", priceCents: 0, currentPeriodStart: now, currentPeriodEnd: end, adminOverride: true, note: `Admin override (${months} months)` } }),
      prisma.merchant.update({ where: { id: merchantId }, data: { plan } }),
    ]);
    await audit(actor, "subscription.override", "merchant", merchantId, { plan, months });
  }, `/admin/merchants/${merchantId}`);
}

export async function adminChangePlanAction(merchantId: string, plan: PlanCode, interval: BillingInterval) {
  return guard(["ADMIN", "FINANCE"], async (actor) => {
    await changePlan(merchantId, plan, interval, { actorId: actor, immediate: true });
  }, `/admin/merchants/${merchantId}`);
}

export async function manageAsMerchantAction(merchantId: string) {
  const u = await requireAdmin("ADMIN");
  (await cookies()).set(ADMIN_AS_COOKIE, merchantId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 4 * 3600 });
  await audit(u.id, "admin.manage_as", "merchant", merchantId);
  redirect("/merchant");
}

export async function stopManagingAction() {
  await requireAdmin();
  (await cookies()).delete(ADMIN_AS_COOKIE);
  redirect("/admin/merchants");
}

export async function invoiceCommissionsAction(merchantId: string) {
  return guard(["FINANCE"], async (actor) => {
    await invoiceCommissions(merchantId, actor);
  }, `/admin/merchants/${merchantId}`);
}

export async function payoutAction(merchantId: string, reference?: string) {
  return guard(["FINANCE"], async (actor) => {
    if (!reference?.trim()) throw new UserError("Enter the transfer reference");
    await createPayout(merchantId, actor, reference);
  }, `/admin/merchants/${merchantId}`);
}

export async function issueInvoiceAction(merchantId: string, _: FormResult, form: FormData): Promise<FormResult> {
  return guard(["FINANCE"], async (actor) => {
    const amount = parseMoney(String(form.get("amount") ?? ""));
    const kind = String(form.get("kind") ?? "ADJUSTMENT") as "REPORT" | "ADJUSTMENT" | "ADVERTISING";
    const description = String(form.get("description") ?? "").trim();
    if (!amount || amount <= 0 || description.length < 3) throw new UserError("Enter a description and amount");
    await createInvoice(merchantId, [{ kind: ["REPORT", "ADJUSTMENT", "ADVERTISING"].includes(kind) ? kind : "ADJUSTMENT", description, amountCents: amount }]);
    await audit(actor, "invoice.manual", "merchant", merchantId, { amount, kind, description });
  }, `/admin/merchants/${merchantId}`);
}

/** Records a verified EVNT-generated booking completed directly with the merchant within 72h of a contact click (50%). */
export async function recordExternalBookingAction(clickId: string, _: FormResult, form: FormData): Promise<FormResult> {
  return guard(["FINANCE", "ADMIN"], async (actor) => {
    const click = await prisma.contactClick.findUniqueOrThrow({ where: { id: clickId }, include: { merchant: true } });
    const amount = parseMoney(String(form.get("amount") ?? ""));
    const category = String(form.get("category") ?? "") as CommissionCategory;
    const bookedAt = new Date(String(form.get("bookedAt") ?? ""));
    if (!amount || amount <= 0) throw new UserError("Enter the booking amount");
    if (isNaN(bookedAt.getTime())) throw new UserError("Enter the booking date");
    const hours = await getSetting("attribution.externalWindowHours");
    if (!withinExternalWindow(click.createdAt, bookedAt, hours)) throw new UserError(`Only bookings within ${hours} hours of the contact click qualify`);
    const rate = await prisma.commissionRate.findUnique({ where: { category_plan: { category, plan: click.merchant.plan } } });
    if (!rate) throw new UserError("Choose a category");
    const share = await getSetting("attribution.externalSharePct");
    const { rateBps, amountCents } = commissionFor(amount, rate.rateBps, "EVNT_EXTERNAL", share);
    await prisma.$transaction(async (tx) => {
      const ext = await tx.externalBooking.create({ data: { merchantId: click.merchantId, clickId, amountCents: amount, category, bookedAt, status: "VERIFIED", verifiedById: actor, note: String(form.get("note") ?? "").slice(0, 300) } });
      await tx.commission.create({ data: { merchantId: click.merchantId, source: "BOOKING", sourceId: `ext:${ext.id}`, category, plan: click.merchant.plan, attribution: "EVNT_EXTERNAL", rateBps, baseCents: amount, amountCents, status: "EARNED", earnedAt: new Date() } });
      if (amountCents > 0) await tx.ledgerEntry.create({ data: { merchantId: click.merchantId, type: "COD_COMMISSION", amountCents: -amountCents, memo: `EVNT-generated booking completed directly (${share}%)`, refType: "external", refId: ext.id, createdById: actor } });
      await tx.auditLog.create({ data: { actorId: actor, action: "external.verified", entityType: "merchant", entityId: click.merchantId, data: { clickId, amount, category } } });
    });
    await notifyMerchant(click.merchantId, { kind: "commission.external", title: "EVNT-generated booking recorded", body: `A booking from an EVNT contact was recorded at ${share}% commission. You can dispute it from Billing.`, link: "/merchant/billing" });
  }, `/admin/commissions`);
}

export async function resolveDisputeAction(disputeId: string, uphold: boolean, resolution?: string) {
  return guard(["FINANCE"], async (actor) => {
    const d = await prisma.commissionDispute.findUniqueOrThrow({ where: { id: disputeId }, include: { commission: true } });
    await prisma.$transaction(async (tx) => {
      await tx.commissionDispute.update({ where: { id: disputeId }, data: { status: uphold ? "UPHELD" : "REJECTED", resolution: resolution ?? "", resolvedAt: new Date() } });
      if (uphold && d.commission.status !== "REVERSED" && d.commission.amountCents > 0) {
        await tx.commission.update({ where: { id: d.commissionId }, data: { status: "REVERSED", amountCents: 0 } });
        await tx.ledgerEntry.create({ data: { merchantId: d.commission.merchantId, type: "ADJUSTMENT", amountCents: d.commission.amountCents, memo: "Commission dispute upheld", refType: "commission", refId: d.commissionId, createdById: actor } });
      }
      await tx.auditLog.create({ data: { actorId: actor, action: uphold ? "dispute.upheld" : "dispute.rejected", entityType: "commission", entityId: d.commissionId, data: { resolution } } });
    });
  }, "/admin/commissions");
}

// ───────────── Users ─────────────

export async function setRoleAction(userId: string, role: Role, on: boolean) {
  const u = await requireAdmin();
  if (!hasRole(u, "SUPER_ADMIN")) return { error: "Only a super admin can change admin roles" };
  if (userId === u.id && role === "SUPER_ADMIN" && !on) return { error: "You can't remove your own super admin role" };
  if (on) await prisma.userRole.upsert({ where: { userId_role: { userId, role } }, create: { userId, role }, update: {} });
  else await prisma.userRole.deleteMany({ where: { userId, role } });
  await audit(u.id, on ? "role.granted" : "role.revoked", "user", userId, { role });
  revalidatePath(`/admin/users/${userId}`);
  return {};
}

export async function setUserDisabledAction(userId: string, disabled: boolean) {
  return guard(["ADMIN"], async (actor) => {
    if (userId === actor) throw new UserError("You can't disable yourself");
    await prisma.user.update({ where: { id: userId }, data: { disabled } });
    if (disabled) await prisma.session.deleteMany({ where: { userId } });
    await audit(actor, disabled ? "user.disabled" : "user.enabled", "user", userId);
  }, `/admin/users/${userId}`);
}

export async function grantPlusAction(userId: string, input?: string) {
  return guard(["ADMIN"], async (actor) => {
    await grantMembership(userId, parseInt(input ?? "1", 10) || 1, actor);
  }, `/admin/users/${userId}`);
}

// ───────────── CMS ─────────────

export async function saveSectionAction(_: FormResult, form: FormData): Promise<FormResult> {
  return guard(["CONTENT", "ADMIN"], async (actor) => {
    const id = String(form.get("id") ?? "");
    const title = localizedFromForm(form, "title");
    if (!title.en && !title.ar && !title.fr) throw new UserError("Enter a title");
    const num = (k: string) => (String(form.get(k) ?? "").trim() ? Number(form.get(k)) : undefined);
    const date = (k: string) => (String(form.get(k) ?? "") ? new Date(String(form.get(k))) : null);
    const filters = {
      categorySlug: String(form.get("categorySlug") ?? "") || undefined,
      ageMin: num("ageMin"),
      ageMax: num("ageMax"),
      area: String(form.get("area") ?? "") || undefined,
      maxPriceCents: num("maxPrice") != null ? Math.round(num("maxPrice")! * 100) : undefined,
      free: form.get("free") === "on" || undefined,
      weekend: form.get("weekend") === "on" || undefined,
      setting: String(form.get("setting") ?? "") || undefined,
      sort: String(form.get("sort") ?? "") || undefined,
    };
    const data = {
      title,
      subtitle: localizedFromForm(form, "subtitle"),
      ctaText: localizedFromForm(form, "cta"),
      ctaHref: String(form.get("ctaHref") ?? "").trim() || null,
      source: String(form.get("source") ?? "EVENTS"),
      mode: String(form.get("mode") ?? "AUTO"),
      layout: String(form.get("layout") ?? "CAROUSEL"),
      filters,
      itemIds: String(form.get("itemIds") ?? "").split(/[\s,]+/).filter(Boolean).slice(0, 40),
      limit: Math.max(1, Math.min(40, num("limit") ?? 12)),
      sponsored: form.get("sponsored") === "on",
      visible: form.get("visible") === "on",
      bannerId: String(form.get("bannerId") ?? "") || null,
      startsAt: date("startsAt"),
      endsAt: date("endsAt"),
    };
    if (data.ctaHref && !data.ctaHref.startsWith("/") && !data.ctaHref.startsWith("https://")) throw new UserError("Links must start with / or https://");
    if (id) await prisma.homeSection.update({ where: { id }, data });
    else await prisma.homeSection.create({ data: { ...data, sort: (await prisma.homeSection.count()) + 1 } });
    await audit(actor, id ? "section.updated" : "section.created", "homeSection", id || undefined);
  }, "/admin/cms");
}

export async function moveSectionAction(id: string, dir: -1 | 1) {
  return guard(["CONTENT", "ADMIN"], async () => {
    const all = await prisma.homeSection.findMany({ orderBy: { sort: "asc" } });
    const i = all.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    await prisma.$transaction(all.map((s, k) => prisma.homeSection.update({ where: { id: s.id }, data: { sort: k } })));
  }, "/admin/cms");
}

/** Drag-and-drop reorder: receives the full ordered list of ids. */
export async function reorderSectionsAction(ids: string[]) {
  return guard(["CONTENT", "ADMIN"], async (actor) => {
    await prisma.$transaction(ids.map((id, k) => prisma.homeSection.update({ where: { id }, data: { sort: k } })));
    await audit(actor, "sections.reordered", "homeSection");
  }, "/admin/cms");
}

export async function toggleSectionAction(id: string) {
  return guard(["CONTENT", "ADMIN"], async () => {
    const s = await prisma.homeSection.findUniqueOrThrow({ where: { id } });
    await prisma.homeSection.update({ where: { id }, data: { visible: !s.visible } });
  }, "/admin/cms");
}

export async function deleteSectionAction(id: string) {
  return guard(["CONTENT", "ADMIN"], async (actor) => {
    await prisma.homeSection.delete({ where: { id } });
    await audit(actor, "section.deleted", "homeSection", id);
  }, "/admin/cms");
}

export async function saveHeroAction(_: FormResult, form: FormData): Promise<FormResult> {
  return guard(["CONTENT", "ADMIN"], async (actor) => {
    const videoId = String(form.get("videoId") ?? "") || null;
    const poster = String(form.get("posterId") ?? "");
    await setSetting(
      "hero",
      {
        videoUrl: String(form.get("videoUrl") ?? "").trim(),
        videoId,
        posterUrl: poster ? (poster.startsWith("/") ? poster : `/media/${poster}`) : "/brand/hero-poster.svg",
        headline: localizedFromForm(form, "headline"),
        subline: localizedFromForm(form, "subline"),
        ctaText: localizedFromForm(form, "cta"),
        ctaHref: String(form.get("ctaHref") ?? "/discover").trim() || "/discover",
      },
      actor,
    );
  }, "/admin/cms");
}

export async function saveCategoryAction(_: FormResult, form: FormData): Promise<FormResult> {
  return guard(["CONTENT", "ADMIN"], async (actor) => {
    const id = String(form.get("id") ?? "");
    const name = localizedFromForm(form, "name");
    if (!name.en) throw new UserError("Enter the English name");
    const data = { name, blurb: localizedFromForm(form, "blurb"), imageId: String(form.get("imageId") ?? "") || null, active: form.get("active") === "on", sort: Number(form.get("sort") ?? 0) || 0 };
    if (id) await prisma.category.update({ where: { id }, data });
    else {
      const parent = await prisma.category.findUnique({ where: { id: String(form.get("parentId") ?? "") } });
      if (!parent) throw new UserError("Subcategories need a parent category");
      let slug = slugify(name.en);
      if (await prisma.category.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      await prisma.category.create({ data: { ...data, slug, kind: parent.kind, commission: parent.commission, parentId: parent.id } });
    }
    await audit(actor, "category.saved", "category", id || undefined);
  }, "/admin/cms/categories");
}

export async function saveArticleAction(_: FormResult, form: FormData): Promise<FormResult> {
  return guard(["CONTENT", "ADMIN"], async (actor) => {
    const id = String(form.get("id") ?? "");
    const title = localizedFromForm(form, "title");
    if (!title.en && !title.ar && !title.fr) throw new UserError("Enter a title");
    const publish = form.get("publish") === "on";
    const data = { title, excerpt: localizedFromForm(form, "excerpt"), body: localizedFromForm(form, "body"), coverId: String(form.get("coverId") ?? "") || null, status: publish ? "PUBLISHED" : "DRAFT" };
    if (id) {
      const a = await prisma.article.findUniqueOrThrow({ where: { id } });
      await prisma.article.update({ where: { id }, data: { ...data, publishedAt: publish ? a.publishedAt ?? new Date() : a.publishedAt } });
    } else {
      let slug = slugify(title.en || title.fr || "guide");
      if (await prisma.article.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      await prisma.article.create({ data: { ...data, slug, publishedAt: publish ? new Date() : null } });
    }
    await audit(actor, "article.saved", "article", id || undefined);
  }, "/admin/marketing");
}

// ───────────── Listings & moderation ─────────────

export async function moderateListingAction(type: "event" | "product" | "restaurant", id: string, status: "PUBLISHED" | "REJECTED" | "ARCHIVED", reason?: string) {
  return guard(["CONTENT", "ADMIN"], async (actor) => {
    if (type === "event") {
      const e = await prisma.event.update({ where: { id }, data: { status, rejectionReason: status === "REJECTED" ? reason ?? "" : null } });
      if (status === "REJECTED") await notifyMerchant(e.merchantId, { kind: "listing.rejected", title: "A listing was taken down", body: `Reason: ${reason ?? ""}`, link: `/merchant/events/${id}` });
    } else if (type === "product") await prisma.product.update({ where: { id }, data: { status } });
    else await prisma.restaurant.update({ where: { id }, data: { status: status === "REJECTED" ? "DRAFT" : status } });
    await audit(actor, `listing.${status.toLowerCase()}`, type, id, { reason });
  }, "/admin/listings");
}

export async function moderateReviewAction(reviewId: string, hide: boolean) {
  return guard(["CONTENT", "ADMIN"], async (actor) => {
    const r = await prisma.review.update({ where: { id: reviewId }, data: { status: hide ? "HIDDEN" : "PUBLISHED" } });
    await prisma.reviewReport.updateMany({ where: { reviewId, status: "OPEN" }, data: { status: hide ? "ACTIONED" : "DISMISSED" } });
    await refreshRatings({ eventId: r.eventId, restaurantId: r.restaurantId, productId: r.productId, merchantId: r.merchantId });
    await audit(actor, hide ? "review.hidden" : "review.restored", "review", reviewId);
  }, "/admin/reviews");
}

export async function reviewCampaignAction(id: string, approve: boolean, reason?: string) {
  return guard(["ADMIN"], async (actor) => {
    if (!approve && !reason?.trim()) throw new UserError("Give a reason so the merchant can fix it");
    await reviewCampaign(id, approve, reason ?? "", actor);
  }, "/admin/ads");
}

// ───────────── Finance ─────────────

export async function recordInvoicePaymentAction(invoiceId: string, reference?: string) {
  return guard(["FINANCE"], async (actor) => {
    if (!reference?.trim()) throw new UserError("Enter the payment reference (transfer or Whish receipt)");
    await markInvoicePaid(invoiceId, { recordedById: actor, reference });
  }, "/admin/finance");
}

export async function voidInvoiceAction(invoiceId: string, reason?: string) {
  return guard(["FINANCE"], async (actor) => {
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (inv.status === "PAID") throw new UserError("Paid invoices can't be voided. Issue a credit instead.");
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "VOID" } });
    await audit(actor, "invoice.void", "invoice", invoiceId, { reason });
  }, "/admin/finance");
}

/** Marks a refund as processed (money returned to the parent via Whish or cash) and updates totals. */
export async function processRefundAction(refundId: string, approve: boolean, note?: string) {
  return guard(["FINANCE"], async (actor) => {
    const r = await prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
    if (!["REQUESTED", "APPROVED"].includes(r.status)) throw new UserError("Already handled");
    await prisma.$transaction(async (tx) => {
      await tx.refund.update({ where: { id: refundId }, data: { status: approve ? "PROCESSED" : "REJECTED", processedById: actor, processedAt: new Date(), reason: note ? `${r.reason} — ${note}` : r.reason } });
      if (approve) {
        if (r.paymentId && r.payment) {
          const refunded = (await tx.refund.aggregate({ where: { paymentId: r.paymentId, status: "PROCESSED" }, _sum: { amountCents: true } }))._sum.amountCents ?? 0;
          await tx.payment.update({ where: { id: r.paymentId }, data: { status: refunded >= r.payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
        }
        if (r.bookingId) {
          const b = await tx.booking.findUniqueOrThrow({ where: { id: r.bookingId } });
          const total = b.refundedCents + r.amountCents;
          await tx.booking.update({ where: { id: b.id }, data: { refundedCents: total, status: total >= b.totalCents ? "REFUNDED" : b.status === "CANCELED" ? "CANCELED" : "PARTIALLY_REFUNDED" } });
        }
        if (r.orderId) await tx.order.update({ where: { id: r.orderId }, data: { status: "REFUNDED" } });
      }
      await tx.auditLog.create({ data: { actorId: actor, action: approve ? "refund.processed" : "refund.rejected", entityType: "refund", entityId: refundId, data: { note } } });
    });
    const userId = r.payment?.userId;
    if (userId) await notifyUser(userId, { kind: approve ? "refund.processed" : "refund.rejected", title: approve ? "Your refund was processed" : "About your refund request", body: approve ? "The money has been returned to you." : `Your refund request was declined. ${note ?? ""}` });
  }, "/admin/finance");
}

// ───────────── Pricing & settings ─────────────

export async function savePlanAction(code: PlanCode, _: FormResult, form: FormData): Promise<FormResult> {
  return guard(["FINANCE", "ADMIN"], async (actor) => {
    const money = (k: string) => {
      const v = parseMoney(String(form.get(k) ?? ""));
      if (v == null) throw new UserError("Enter valid amounts");
      return v;
    };
    await prisma.subscriptionPlan.update({
      where: { code },
      data: {
        monthlyCents: money("monthly"),
        yearlyCents: money("yearly"),
        restaurantGuestFeeCents: money("guestFee"),
        flashPromosPerMonth: Math.max(0, parseInt(String(form.get("flash") ?? "0"), 10) || 0),
        bookingManagement: form.get("bookingManagement") === "on",
        advancedAnalytics: form.get("advancedAnalytics") === "on",
        birthdayRadar: form.get("birthdayRadar") === "on",
        demandIntelligence: form.get("demandIntelligence") === "on",
        priorityPlacement: form.get("priorityPlacement") === "on",
        sponsoredRoundups: form.get("sponsoredRoundups") === "on",
      },
    });
    await audit(actor, "plan.updated", "plan", code);
  }, "/admin/plans");
}

export async function saveRatesAction(_: FormResult, form: FormData): Promise<FormResult> {
  return guard(["FINANCE"], async (actor) => {
    const rates = await prisma.commissionRate.findMany();
    for (const r of rates) {
      const v = parseFloat(String(form.get(`${r.category}_${r.plan}`) ?? ""));
      if (!Number.isFinite(v) || v < 0 || v > 50) throw new UserError("Rates must be between 0% and 50%");
      const bps = Math.round(v * 100);
      if (bps !== r.rateBps) await prisma.commissionRate.update({ where: { category_plan: { category: r.category, plan: r.plan } }, data: { rateBps: bps } });
    }
    await audit(actor, "rates.updated", "commissionRate");
  }, "/admin/plans");
}

export async function savePlacementAction(code: string, _: FormResult, form: FormData): Promise<FormResult> {
  return guard(["FINANCE", "ADMIN"], async (actor) => {
    const p = await prisma.adPlacement.findUniqueOrThrow({ where: { code } });
    const price = p.unit === "PERCENT_SALES" ? Math.round(parseFloat(String(form.get("price") ?? "0")) * 100) : parseMoney(String(form.get("price") ?? ""));
    if (price == null || price < 0) throw new UserError("Enter a valid price");
    await prisma.adPlacement.update({ where: { code }, data: { priceCents: price, slots: Math.max(1, parseInt(String(form.get("slots") ?? "1"), 10) || 1), active: form.get("active") === "on" } });
    await audit(actor, "placement.updated", "placement", code);
  }, "/admin/plans");
}

/** Saves any platform setting (numbers/booleans/strings) from the settings page. */
export async function saveSettingsAction(_: FormResult, form: FormData): Promise<FormResult> {
  const u = await requireAdmin();
  if (!hasRole(u, "SUPER_ADMIN")) return { error: "Only a super admin can change platform settings" };
  for (const key of Object.keys(DEFAULTS) as SettingKey[]) {
    if (key === "hero" || !form.has(key) && typeof DEFAULTS[key] !== "boolean") continue;
    const def = DEFAULTS[key];
    let v: unknown;
    if (typeof def === "boolean") v = form.get(key) === "on";
    else if (typeof def === "number") {
      const raw = String(form.get(key) ?? "");
      const n = key.endsWith("Cents") ? parseMoney(raw) : Number(raw);
      if (n == null || !Number.isFinite(n) || n < 0) return { error: `Invalid value for ${key}` };
      v = n;
    } else v = String(form.get(key) ?? "").trim();
    await setSetting(key, v, u.id);
  }
  clearSettingsCache();
  await audit(u.id, "settings.updated", "setting");
  revalidatePath("/admin/settings");
  return { message: "Saved" };
}

export async function saveDiscountAction(_: FormResult, form: FormData): Promise<FormResult> {
  return guard(["ADMIN", "CONTENT"], async (actor) => {
    const code = String(form.get("code") ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,30}$/.test(code)) throw new UserError("Use 3–30 letters, numbers or dashes");
    const pct = parseInt(String(form.get("percent") ?? ""), 10);
    const amount = parseMoney(String(form.get("amount") ?? ""));
    if (!(pct > 0 && pct <= 100) && !(amount && amount > 0)) throw new UserError("Enter a percent or an amount");
    await prisma.discountCode.create({
      data: {
        code,
        percentOff: pct > 0 ? pct : null,
        amountOffCents: pct > 0 ? null : amount,
        minSubtotalCents: parseMoney(String(form.get("min") ?? "0")) ?? 0,
        maxUses: parseInt(String(form.get("maxUses") ?? ""), 10) || null,
        endsAt: String(form.get("endsAt") ?? "") ? new Date(String(form.get("endsAt"))) : null,
        appliesTo: "SHOP",
      },
    });
    await audit(actor, "discount.created", "discountCode", code);
  }, "/admin/marketing");
}

export async function toggleDiscountAction(code: string) {
  return guard(["ADMIN", "CONTENT"], async () => {
    const d = await prisma.discountCode.findUniqueOrThrow({ where: { code } });
    await prisma.discountCode.update({ where: { code }, data: { active: !d.active } });
  }, "/admin/marketing");
}

export async function saveTranslationAction(_: FormResult, form: FormData): Promise<FormResult> {
  return guard(["CONTENT", "ADMIN"], async (actor) => {
    const locale = String(form.get("locale") ?? "");
    const key = String(form.get("key") ?? "");
    const value = String(form.get("value") ?? "").trim();
    if (!["ar", "fr", "en"].includes(locale) || !key) throw new UserError("Invalid");
    if (value) await prisma.translationOverride.upsert({ where: { locale_key: { locale, key } }, create: { locale, key, value }, update: { value } });
    else await prisma.translationOverride.deleteMany({ where: { locale, key } });
    clearTranslationCache();
    await audit(actor, "translation.saved", "translation", `${locale}:${key.slice(0, 60)}`);
  }, "/admin/localization");
}

export async function reindexAction() {
  return guard(["ADMIN"], async () => {
    await reindexAll(prisma);
  });
}

export async function markContactHandledAction(id: string) {
  return guard(["ADMIN", "CONTENT"], async () => {
    await prisma.contactMessage.update({ where: { id }, data: { handled: true } });
  }, "/admin/marketing");
}
