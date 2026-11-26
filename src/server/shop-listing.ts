import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./db";
import { getSetting } from "./settings";
import { createInvoice } from "./billing";
import { notifyMerchant } from "./notify";

// Shops pay a monthly listing fee (no commission on their sales). Their store card and products are
// visible while the listing is paid, plus the billing grace days.

/** Products are shown only from businesses whose shop listing is paid. */
export async function listedShopFilter(): Promise<Prisma.MerchantWhereInput> {
  const grace = await getSetting("billing.graceDays");
  return { status: "APPROVED", shopPaidUntil: { gt: new Date(Date.now() - grace * 86400_000) } };
}

export const isShopListed = (m: { shopPaidUntil: Date | null }, graceDays = 0) => !!m.shopPaidUntil && m.shopPaidUntil.getTime() > Date.now() - graceDays * 86400_000;

/** The open listing invoice of a shop, if any. */
export async function openListingInvoice(merchantId: string) {
  return prisma.invoice.findFirst({ where: { merchantId, status: { in: ["OPEN", "OVERDUE"] }, lines: { some: { refType: "shop-listing" } } }, orderBy: { issuedAt: "desc" } });
}

/** Issues next month's listing invoice (once: an unpaid one is reused). */
export async function invoiceShopListing(merchantId: string) {
  const open = await openListingInvoice(merchantId);
  if (open) return open;
  const price = await getSetting("shop.listingCents");
  return createInvoice(merchantId, [{ kind: "SUBSCRIPTION", description: "EVNT shop listing — 1 month", amountCents: price, refType: "shop-listing", refId: merchantId }]);
}

/** Paid: the listing runs one more month from today or from the current end date, whichever is later. */
export async function extendShopListing(tx: Tx, merchantId: string, months = 1) {
  const m = await tx.merchant.findUniqueOrThrow({ where: { id: merchantId }, select: { shopPaidUntil: true } });
  const from = m.shopPaidUntil && m.shopPaidUntil > new Date() ? new Date(m.shopPaidUntil) : new Date();
  from.setMonth(from.getMonth() + months);
  await tx.merchant.update({ where: { id: merchantId }, data: { shopPaidUntil: from } });
  return from;
}

/** Daily: renewal invoices 5 days before the listing ends, for shops and anyone selling products. */
export async function runShopListings(now = new Date()) {
  const soon = new Date(now.getTime() + 5 * 86400_000);
  const shops = await prisma.merchant.findMany({
    where: {
      status: "APPROVED",
      OR: [{ type: "RETAILER" }, { products: { some: { status: "PUBLISHED" } } }],
      AND: [{ OR: [{ shopPaidUntil: null }, { shopPaidUntil: { lte: soon } }] }],
    },
    select: { id: true, shopPaidUntil: true },
  });
  let issued = 0;
  for (const s of shops) {
    if (await openListingInvoice(s.id)) continue;
    await invoiceShopListing(s.id);
    issued++;
    await notifyMerchant(s.id, {
      kind: "shop.listing",
      title: s.shopPaidUntil ? "Your shop listing renews soon" : "Put your shop live on EVNT",
      body: "Pay your monthly listing invoice to keep your shop and products visible to families.",
      link: "/merchant/billing",
    });
  }
  return issued;
}
