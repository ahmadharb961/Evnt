"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMerchant, requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { extendShopListing, invoiceShopListing } from "@/server/shop-listing";

/** Business: opens (or creates) this month's listing invoice, ready to pay. */
export async function payShopListingAction() {
  const ctx = await requireMerchant("MANAGER");
  const inv = await invoiceShopListing(ctx.merchant.id);
  redirect(`/merchant/billing/${inv.id}`);
}

/** Admin: adds months to a shop's listing (paid in cash / transfer, or given free). Recorded in the log. */
export async function extendShopListingAction(merchantId: string, input?: string) {
  const u = await requireAdmin("ADMIN", "FINANCE");
  const months = Math.round(Number(input ?? 1));
  if (!Number.isFinite(months) || months < 1 || months > 24) return { error: "Enter a number of months between 1 and 24" };
  const until = await prisma.$transaction((tx) => extendShopListing(tx, merchantId, months));
  await prisma.auditLog.create({ data: { actorId: u.id, action: "shop.listing_extended", entityType: "merchant", entityId: merchantId, data: { months, until } } });
  revalidatePath(`/admin/merchants/${merchantId}`);
  return {};
}
