import "server-only";
import type { AdPlacement } from "@prisma/client";
import { prisma } from "./db";
import { UserError } from "./auth";
import { createInvoice } from "./billing";
import { merchantFeatures } from "./features";
import { notifyAdmins, notifyMerchant } from "./notify";
import { loc } from "@/i18n/core";

const BLOCKING = ["PENDING_PAYMENT", "PENDING_APPROVAL", "APPROVED"] as const;

/** Price of a campaign from its placement unit and dates. */
export function campaignPrice(p: AdPlacement, startsAt: Date, endsAt: Date) {
  const days = Math.max(1, Math.ceil((endsAt.getTime() - startsAt.getTime()) / 86400_000));
  if (p.unit === "WEEK") return p.priceCents * Math.ceil(days / 7);
  if (p.unit === "MONTH") return p.priceCents * Math.ceil(days / 30);
  if (p.unit === "PERCENT_SALES") return 0; // invoiced later on generated sales
  return p.priceCents;
}

/** Remaining slots for a placement in a period (exclusive placements: one per category at a time). */
export async function availability(placementCode: string, startsAt: Date, endsAt: Date, categoryId?: string | null) {
  const p = await prisma.adPlacement.findUniqueOrThrow({ where: { code: placementCode } });
  const overlapping = await prisma.adCampaign.count({
    where: { placementCode, status: { in: [...BLOCKING] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...(p.code === "CATEGORY_SPONSOR" ? { categoryId: categoryId ?? null } : {}) },
  });
  const slots = p.exclusive ? 1 : p.slots;
  return { slots, taken: overlapping, available: Math.max(0, slots - overlapping) };
}

export async function createCampaign(
  merchantId: string,
  actorId: string,
  d: { placementCode: string; startsAt: Date; endsAt: Date; headline: string; creativeId?: string | null; eventId?: string | null; productId?: string | null; restaurantId?: string | null; categoryId?: string | null },
) {
  const m = await prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } });
  if (m.status !== "APPROVED") throw new UserError("Your business must be verified first");
  const f = await merchantFeatures(m);
  if (!f.advertising) throw new UserError("Advertising is paused while an invoice is overdue");
  const p = await prisma.adPlacement.findUnique({ where: { code: d.placementCode } });
  if (!p || !p.active) throw new UserError("This placement isn't available");
  if (p.requiresPlan === "FEATURED" && m.plan !== "FEATURED") throw new UserError("This placement is available on the Featured plan");
  if (d.startsAt < new Date(Date.now() - 3600_000) || d.endsAt <= d.startsAt) throw new UserError("Choose valid future dates");
  if (p.code === "CATEGORY_SPONSOR" && !d.categoryId) throw new UserError("Choose the category to sponsor");
  // Promoted items must belong to this merchant.
  if (d.eventId && !(await prisma.event.findFirst({ where: { id: d.eventId, merchantId } }))) throw new UserError("Invalid listing");
  if (d.productId && !(await prisma.product.findFirst({ where: { id: d.productId, merchantId } }))) throw new UserError("Invalid product");
  if (d.restaurantId && !(await prisma.restaurant.findFirst({ where: { id: d.restaurantId, merchantId } }))) throw new UserError("Invalid restaurant");
  if (p.code === "HOMEPAGE_FEATURED" && !d.eventId && !d.productId && !d.restaurantId) throw new UserError("Choose what to feature");
  if (p.code === "WHATSAPP_CAMPAIGN" && d.headline.length < 20) throw new UserError("Write the message parents will receive (at least 20 characters)");

  const price = campaignPrice(p, d.startsAt, d.endsAt);
  const created = await prisma.$transaction(
    async (tx) => {
      // Re-check availability inside a serializable transaction so two merchants can't take the last slot.
      const overlapping = await tx.adCampaign.count({
        where: { placementCode: p.code, status: { in: [...BLOCKING] }, startsAt: { lt: d.endsAt }, endsAt: { gt: d.startsAt }, ...(p.code === "CATEGORY_SPONSOR" ? { categoryId: d.categoryId ?? null } : {}) },
      });
      if (overlapping >= (p.exclusive ? 1 : p.slots)) throw new UserError("Those dates are already booked for this placement. Try other dates.");
      const audience = p.code === "WHATSAPP_CAMPAIGN" ? await tx.user.count({ where: { marketingWhatsapp: true, disabled: false, phone: { not: null } } }) : null;
      const c = await tx.adCampaign.create({
        data: { merchantId, placementCode: p.code, categoryId: d.categoryId, eventId: d.eventId, productId: d.productId, restaurantId: d.restaurantId, headline: d.headline.slice(0, 500), creativeId: d.creativeId, startsAt: d.startsAt, endsAt: d.endsAt, priceCents: price, status: price > 0 ? "PENDING_PAYMENT" : "PENDING_APPROVAL", whatsappAudienceSize: audience },
      });
      if (price > 0) {
        const inv = await createInvoice(merchantId, [{ kind: "ADVERTISING", description: `${loc(p.name, "en")} (${d.startsAt.toISOString().slice(0, 10)} → ${d.endsAt.toISOString().slice(0, 10)})`, amountCents: price, refType: "campaign", refId: c.id }], tx);
        c.invoiceId = (await tx.adCampaign.update({ where: { id: c.id }, data: { invoiceId: inv.id } })).invoiceId;
      }
      await tx.auditLog.create({ data: { actorId, action: "campaign.created", entityType: "campaign", entityId: c.id, data: { placement: p.code, price } } });
      return c;
    },
    { isolationLevel: "Serializable" },
  );
  return created;
}

/** Admin approval: required for every sponsored placement before it's shown. */
export async function reviewCampaign(campaignId: string, approve: boolean, reason: string, actorId: string) {
  const c = await prisma.adCampaign.findUnique({ where: { id: campaignId } });
  if (!c) throw new UserError("Not found");
  if (c.status !== "PENDING_APPROVAL") throw new UserError(c.status === "PENDING_PAYMENT" ? "This campaign isn't paid yet" : "This campaign was already reviewed");
  await prisma.adCampaign.update({ where: { id: c.id }, data: approve ? { status: "APPROVED", approvedById: actorId, approvedAt: new Date() } : { status: "REJECTED", rejectionReason: reason.slice(0, 500) } });
  // A rejected paid campaign is refunded as an invoice credit (recorded for finance).
  if (!approve && c.priceCents > 0 && c.invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: c.invoiceId } });
    if (inv?.status === "PAID") await prisma.ledgerEntry.create({ data: { merchantId: c.merchantId, type: "ADJUSTMENT", amountCents: c.priceCents, memo: `Credit for rejected campaign`, refType: "campaign", refId: c.id, createdById: actorId } });
    else if (inv) await prisma.invoice.update({ where: { id: inv.id }, data: { status: "VOID" } });
  }
  await prisma.auditLog.create({ data: { actorId, action: approve ? "campaign.approved" : "campaign.rejected", entityType: "campaign", entityId: c.id, data: { reason } } });
  await notifyMerchant(c.merchantId, {
    kind: approve ? "campaign.approved" : "campaign.rejected",
    title: approve ? "Your campaign is approved" : "Your campaign needs changes",
    body: approve ? "It will run on the dates you chose. Track its performance in Advertising." : `Reason: ${reason}`,
    link: "/merchant/ads",
  });
}

export async function notifyCampaignSubmitted(campaignId: string) {
  const c = await prisma.adCampaign.findUnique({ where: { id: campaignId }, include: { merchant: true } });
  if (c?.status === "PENDING_APPROVAL") await notifyAdmins({ kind: "campaign.review", title: `Campaign to review: ${c.merchant.name}`, body: c.placementCode, link: "/admin/ads" });
}

/** Cron: end finished campaigns. */
export async function endCampaigns(now = new Date()) {
  const r = await prisma.adCampaign.updateMany({ where: { status: "APPROVED", endsAt: { lt: now } }, data: { status: "ENDED" } });
  return r.count;
}
