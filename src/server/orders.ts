import "server-only";
import type { OrderStatus } from "@prisma/client";
import { prisma, type Tx } from "./db";
import { UserError } from "./auth";
import { findCart } from "./cart";
import { mediaSrc } from "./media";
import { recordOrderCommission, reverseOrderCommission } from "./commission";
import { effectiveProductPrice, productFlash } from "./listings";
import { awardPoints, isMember, reversePoints } from "./membership";
import { notifyMerchant, notifyUser } from "./notify";
import { loc, type Locale } from "@/i18n/core";
import { shortCode } from "@/lib/codes";
import { ORDER_FLOW } from "@/lib/status";

// ───────────────────────── Cart ─────────────────────────

export async function addToCart(variantId: string, quantity: number) {
  const v = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: { include: { merchant: true } } } });
  if (!v || !v.active || v.product.status !== "PUBLISHED" || v.product.merchant.status !== "APPROVED") throw new UserError("This product isn't available");
  const q = Math.max(1, Math.min(20, Math.floor(quantity)));
  const cart = (await findCart(true))!;
  const existing = await prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } } });
  const next = (existing?.quantity ?? 0) + q;
  if (next > v.stock) throw new UserError(v.stock > 0 ? "Only {n} left in stock" : "Out of stock");
  await prisma.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId } }, create: { cartId: cart.id, variantId, quantity: q }, update: { quantity: next } });
}

export async function setCartQuantity(itemId: string, quantity: number) {
  const cart = await findCart();
  const item = cart ? await prisma.cartItem.findUnique({ where: { id: itemId }, include: { variant: true } }) : null;
  if (!cart || !item || item.cartId !== cart.id) throw new UserError("Not found");
  if (quantity <= 0) return prisma.cartItem.delete({ where: { id: itemId } });
  if (quantity > item.variant.stock) throw new UserError("Only {n} left in stock");
  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: Math.min(20, Math.floor(quantity)) } });
}

type Discount = { code: string; merchantId: string | null; percentOff: number | null; amountOffCents: number | null; minSubtotalCents: number };

async function validDiscount(code: string | null | undefined): Promise<Discount | null> {
  if (!code) return null;
  const d = await prisma.discountCode.findUnique({ where: { code: code.toUpperCase() } });
  const now = new Date();
  if (!d || !d.active || d.appliesTo === "BOOKINGS") return null;
  if ((d.startsAt && d.startsAt > now) || (d.endsAt && d.endsAt < now) || (d.maxUses != null && d.uses >= d.maxUses)) return null;
  return d;
}

export type CartGroup = {
  merchantId: string;
  merchantName: string;
  items: { id: string; variantId: string; productId: string; slug: string; title: string; variant: string; image: string; unitCents: number; quantity: number; stock: number; lineCents: number }[];
  subtotalCents: number;
  deliveryCents: number;
  discountCents: number;
  totalCents: number;
  codEnabled: boolean;
};

/** The cart split by merchant with delivery fees and discounts, computed server-side from current prices. */
export async function cartView(locale: Locale) {
  const cart = await findCart();
  if (!cart) return { groups: [] as CartGroup[], totalCents: 0, count: 0, discountCode: null as string | null, discountError: false, problems: [] as string[] };
  const items = await prisma.cartItem.findMany({ where: { cartId: cart.id }, include: { variant: { include: { product: { include: { merchant: true } } } } }, orderBy: { id: "asc" } });
  const discount = await validDiscount(cart.discountCode);
  const flash = await productFlash(items.map((i) => i.variant.productId));
  const problems: string[] = [];
  const byMerchant = new Map<string, CartGroup>();
  for (const it of items) {
    const p = it.variant.product;
    if (!it.variant.active || p.status !== "PUBLISHED" || p.merchant.status !== "APPROVED") {
      problems.push(loc(p.title, locale));
      continue;
    }
    const unit = it.variant.priceCents != null ? effectiveProductPrice(it.variant.priceCents, null, flash.get(p.id)) : effectiveProductPrice(p.priceCents, p.salePriceCents, flash.get(p.id));
    const g =
      byMerchant.get(p.merchantId) ??
      ({ merchantId: p.merchantId, merchantName: p.merchant.name, items: [], subtotalCents: 0, deliveryCents: 0, discountCents: 0, totalCents: 0, codEnabled: p.merchant.codEnabled } as CartGroup);
    g.items.push({
      id: it.id,
      variantId: it.variantId,
      productId: p.id,
      slug: p.slug,
      title: loc(p.title, locale),
      variant: it.variant.name,
      image: p.images[0] ? (p.images[0].startsWith("/") ? p.images[0] : mediaSrc(p.images[0])) : mediaSrc(),
      unitCents: unit,
      quantity: it.quantity,
      stock: it.variant.stock,
      lineCents: unit * it.quantity,
    });
    g.subtotalCents += unit * it.quantity;
    byMerchant.set(p.merchantId, g);
  }
  const groups = [...byMerchant.values()];
  for (const g of groups) {
    const m = await prisma.merchant.findUnique({ where: { id: g.merchantId }, select: { deliveryFeeCents: true, freeDeliveryOverCents: true } });
    g.deliveryCents = m?.freeDeliveryOverCents != null && g.subtotalCents >= m.freeDeliveryOverCents ? 0 : m?.deliveryFeeCents ?? 0;
  }
  // Discounts: a merchant code applies to that merchant's items; an EVNT code spreads over all merchants.
  let discountError = !!cart.discountCode && !discount;
  if (discount) {
    const eligible = groups.filter((g) => !discount.merchantId || g.merchantId === discount.merchantId);
    const base = eligible.reduce((a, g) => a + g.subtotalCents, 0);
    if (!eligible.length || base < discount.minSubtotalCents) discountError = true;
    else {
      const total = discount.percentOff ? Math.round((base * discount.percentOff) / 100) : Math.min(discount.amountOffCents ?? 0, base);
      let left = total;
      eligible.forEach((g, i) => {
        const part = i === eligible.length - 1 ? left : Math.round((total * g.subtotalCents) / base);
        g.discountCents = Math.min(part, g.subtotalCents);
        left -= g.discountCents;
      });
    }
  }
  for (const g of groups) g.totalCents = g.subtotalCents - g.discountCents + g.deliveryCents;
  return {
    groups,
    totalCents: groups.reduce((a, g) => a + g.totalCents, 0),
    count: groups.reduce((a, g) => a + g.items.reduce((x, i) => x + i.quantity, 0), 0),
    discountCode: discount && !discountError ? discount.code : null,
    discountError,
    discountIsPlatform: !!discount && !discount.merchantId,
    problems,
  };
}

// ───────────────────────── Checkout ─────────────────────────

export type Address = { customerName: string; phone: string; area: string; address: string; building: string; floor?: string; instructions?: string };

/**
 * Places the order: stock is decremented atomically (never oversold), the cart is split into one
 * order per merchant, and nothing is ever marked paid here. COD orders wait for the merchant to
 * confirm; Whish orders wait for the verified payment.
 */
export async function placeOrder(userId: string, address: Address, method: "COD" | "WHISH", locale: Locale) {
  const view = await cartView(locale);
  if (!view.groups.length) throw new UserError("Your cart is empty");
  if (view.problems.length) throw new UserError("Some items are no longer available. Please review your cart.");
  if (method === "COD" && view.groups.some((g) => !g.codEnabled)) throw new UserError("One of the shops doesn't offer cash on delivery");
  const cart = (await findCart())!;
  const discount = await validDiscount(view.discountCode);
  const group = await prisma.$transaction(async (tx) => {
    for (const g of view.groups)
      for (const it of g.items) {
        const n = await tx.$executeRaw`UPDATE "ProductVariant" SET stock = stock - ${it.quantity} WHERE id = ${it.variantId} AND active = true AND stock >= ${it.quantity}`;
        if (n !== 1) throw new UserError(`“${it.title}” just sold out. Please update your cart.`);
      }
    const og = await tx.orderGroup.create({ data: { number: shortCode("OR"), userId, paymentMethod: method, totalCents: view.totalCents } });
    for (const g of view.groups) {
      const order = await tx.order.create({
        data: {
          number: shortCode("SO"),
          groupId: og.id,
          merchantId: g.merchantId,
          status: method === "COD" ? "PENDING" : "AWAITING_PAYMENT",
          paymentMethod: method,
          subtotalCents: g.subtotalCents,
          deliveryCents: g.deliveryCents,
          discountCents: g.discountCents,
          totalCents: g.totalCents,
          ...address,
          items: { create: g.items.map((i) => ({ productId: i.productId, variantId: i.variantId, title: i.title, variantName: i.variant, unitPriceCents: i.unitCents, quantity: i.quantity })) },
          history: { create: { status: method === "COD" ? "PENDING" : "AWAITING_PAYMENT", actorId: userId } },
        },
      });
      // An EVNT-funded discount must not cost the merchant: EVNT credits it to their balance.
      if (g.discountCents > 0 && discount && !discount.merchantId)
        await tx.ledgerEntry.create({ data: { merchantId: g.merchantId, type: "ADJUSTMENT", amountCents: g.discountCents, memo: `EVNT discount ${discount.code} on ${order.number}`, refType: "order", refId: order.id } });
    }
    if (discount) await tx.discountCode.update({ where: { code: discount.code }, data: { uses: { increment: 1 } } });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { discountCode: null } });
    await tx.auditLog.create({ data: { actorId: userId, action: "order.placed", entityType: "orderGroup", entityId: og.id, data: { method, total: view.totalCents } } });
    return og;
  });
  if (method === "COD") {
    const orders = await prisma.order.findMany({ where: { groupId: group.id } });
    for (const o of orders) await notifyMerchant(o.merchantId, { kind: "order.new", title: "New order {number}", body: "A new cash-on-delivery order is waiting for your confirmation.", vars: { number: o.number }, link: `/merchant/orders/${o.number}` });
    await notifyUser(userId, { kind: "order.placed", title: "Order received: {number}", body: "Thanks! The shop will confirm your order shortly. You'll pay in cash on delivery.", vars: { number: group.number }, link: `/account/orders/${group.number}` });
  }
  return group;
}

/** Restocks and closes an order (cancellation or unpaid timeout). */
async function cancelOrderTx(tx: Tx, orderId: string, actorId: string | null, reason: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (["CANCELED", "REFUNDED", "DELIVERED"].includes(o.status)) return o;
  for (const it of o.items) await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
  const wasPaid = !!o.paidAt;
  await tx.order.update({ where: { id: o.id }, data: { status: "CANCELED", canceledAt: new Date(), cancelReason: reason.slice(0, 300) } });
  await tx.orderStatusEvent.create({ data: { orderId: o.id, status: "CANCELED", actorId, note: reason.slice(0, 300) } });
  // An EVNT discount credit is withdrawn when the order doesn't happen.
  const credit = await tx.ledgerEntry.findFirst({ where: { refType: "order", refId: o.id, type: "ADJUSTMENT", amountCents: { gt: 0 } } });
  if (credit) await tx.ledgerEntry.create({ data: { merchantId: o.merchantId, type: "ADJUSTMENT", amountCents: -credit.amountCents, memo: `Discount credit reversed (${o.number} cancelled)`, refType: "order", refId: o.id } });
  if (wasPaid) {
    await reverseOrderCommission(tx, { id: o.id, number: o.number, merchantId: o.merchantId, paymentMethod: o.paymentMethod, baseCents: o.subtotalCents - o.discountCents }, o.totalCents);
    const pay = await tx.payment.findFirst({ where: { orderGroupId: o.groupId, status: "SUCCEEDED" } });
    await tx.refund.create({ data: { paymentId: pay?.id, orderId: o.id, amountCents: o.totalCents, reason, status: "APPROVED" } });
    await tx.order.update({ where: { id: o.id }, data: { refundedCents: o.totalCents } });
    const group = await tx.orderGroup.findUniqueOrThrow({ where: { id: o.groupId } });
    await reversePoints(tx, group.userId, { type: "order", id: o.id });
  }
  return o;
}

/** Merchant moves an order forward. Delivered COD orders require the cash amount actually collected. */
export async function updateOrderStatus(orderNumber: string, merchantId: string | null, actorId: string, next: OrderStatus, opts: { collectedCents?: number; reason?: string } = {}) {
  const o = await prisma.order.findUnique({ where: { number: orderNumber }, include: { group: true, merchant: true } });
  if (!o || (merchantId && o.merchantId !== merchantId)) throw new UserError("Order not found");
  if (merchantId && !ORDER_FLOW[o.status]?.includes(next)) throw new UserError("This status change isn't allowed");
  if (next === "CANCELED") {
    await prisma.$transaction((tx) => cancelOrderTx(tx, o.id, actorId, opts.reason || "Cancelled by the shop"));
    await notifyUser(o.group.userId, { kind: "order.canceled", title: "Order {number} cancelled", body: o.paidAt ? "Your order was cancelled. A refund has been started." : "Your order was cancelled.", vars: { number: o.number }, link: `/account/orders/${o.group.number}` });
    return;
  }
  await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = { status: next };
    if (next === "DELIVERED") {
      data.deliveredAt = new Date();
      if (o.paymentMethod === "COD") {
        const collected = opts.collectedCents ?? -1;
        if (collected < 0) throw new UserError("Enter the cash amount collected");
        data.codCollectedCents = collected;
        data.codCollectedAt = new Date();
      }
    }
    await tx.order.update({ where: { id: o.id }, data });
    await tx.orderStatusEvent.create({ data: { orderId: o.id, status: next, actorId, note: opts.collectedCents != null ? `Cash collected: ${opts.collectedCents}` : null } });
    // COD: only collected cash is revenue. The commission is recorded at collection, never before.
    if (next === "DELIVERED" && o.paymentMethod === "COD") {
      await recordOrderCommission(tx, { id: o.id, number: o.number, merchantId: o.merchantId, plan: o.merchant.plan, baseCents: o.subtotalCents - o.discountCents, paymentMethod: "COD", totalCents: o.totalCents });
      await awardPoints(tx, o.group.userId, opts.collectedCents ?? o.totalCents, await isMember(o.group.userId, tx), { type: "order", id: o.id });
    }
  });
  const msg: Partial<Record<OrderStatus, [string, string]>> = {
    CONFIRMED: ["Order {number} confirmed", "The shop confirmed your order and is getting it ready."],
    SHIPPED: ["Order {number} is on its way", "Your order has been sent out for delivery."],
    DELIVERED: ["Order {number} delivered", "Enjoy! You can now review the products you received."],
  };
  const m = msg[next];
  if (m) await notifyUser(o.group.userId, { kind: `order.${next.toLowerCase()}`, title: m[0], body: m[1], vars: { number: o.number }, link: `/account/orders/${o.group.number}` });
}

export async function customerCancelOrder(groupNumber: string, userId: string) {
  const g = await prisma.orderGroup.findUnique({ where: { number: groupNumber }, include: { orders: true } });
  if (!g || g.userId !== userId) throw new UserError("Order not found");
  const cancellable = g.orders.filter((o) => ["PENDING", "AWAITING_PAYMENT"].includes(o.status));
  if (!cancellable.length) throw new UserError("This order is already being prepared. Contact the shop to change it.");
  await prisma.$transaction(async (tx) => {
    for (const o of cancellable) await cancelOrderTx(tx, o.id, userId, "Cancelled by the customer");
  });
  for (const o of cancellable) await notifyMerchant(o.merchantId, { kind: "order.canceled", title: "Order {number} cancelled", body: "The customer cancelled this order. Stock was restored.", vars: { number: o.number }, link: `/merchant/orders/${o.number}`, email: false });
}

export async function applyOrderPayment(paymentId: string, outcome: "success" | "failed") {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p?.orderGroupId) return;
  const orders = await prisma.order.findMany({ where: { groupId: p.orderGroupId }, include: { merchant: true, group: true } });
  if (outcome === "failed") {
    await prisma.payment.updateMany({ where: { id: p.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: "FAILED" } });
    return; // the order stays awaiting payment; the parent can retry or it auto-cancels later
  }
  const marked = await prisma.payment.updateMany({ where: { id: p.id, status: { in: ["INITIATED", "PENDING", "FAILED"] } }, data: { status: "SUCCEEDED", confirmedAt: new Date() } });
  if (!marked.count) return;
  for (const o of orders) {
    if (o.status !== "AWAITING_PAYMENT") {
      // Paid after it was cancelled (e.g. auto-cancel): refund, never pretend it's fulfilled.
      await prisma.refund.create({ data: { paymentId: p.id, orderId: o.id, amountCents: o.totalCents, reason: "Payment received after the order was cancelled", status: "APPROVED" } });
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: o.id }, data: { status: "CONFIRMED", paidAt: new Date() } });
      await tx.orderStatusEvent.create({ data: { orderId: o.id, status: "CONFIRMED", note: "Paid with Whish" } });
      await recordOrderCommission(tx, { id: o.id, number: o.number, merchantId: o.merchantId, plan: o.merchant.plan, baseCents: o.subtotalCents - o.discountCents, paymentMethod: "WHISH", totalCents: o.totalCents });
      await awardPoints(tx, o.group.userId, o.totalCents, await isMember(o.group.userId, tx), { type: "order", id: o.id });
    });
    await notifyMerchant(o.merchantId, { kind: "order.new", title: "New paid order {number}", body: "A new order was paid online. Please prepare it.", vars: { number: o.number }, link: `/merchant/orders/${o.number}` });
  }
  await notifyUser(p.userId!, { kind: "order.paid", title: "Payment received", body: "Your order is confirmed. We'll let you know when it ships.", link: `/account/orders` });
}

/** Cron: unpaid online orders are cancelled after the configured time and their stock released. */
export async function cancelStaleUnpaidOrders(hours: number) {
  const stale = await prisma.order.findMany({ where: { status: "AWAITING_PAYMENT", createdAt: { lt: new Date(Date.now() - hours * 3600_000) } }, select: { id: true } });
  for (const o of stale) await prisma.$transaction((tx) => cancelOrderTx(tx, o.id, null, "Payment not completed in time"));
  return stale.length;
}
