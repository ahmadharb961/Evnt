"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { getCurrentUser, UserError } from "@/server/auth";
import { findCart } from "@/server/cart";
import { addToCart, customerCancelOrder, placeOrder, setCartQuantity } from "@/server/orders";
import { startWhishPayment } from "@/server/payments";
import { rateLimit } from "@/server/rate-limit";
import { normalizeMobile } from "@/lib/phone";
import { AREAS } from "@/lib/areas";
import { getLocale, getT } from "@/i18n/server";

export async function addToCartAction(variantId: string, quantity: number, buyNow = false) {
  const t = await getT();
  try {
    await addToCart(variantId, quantity);
  } catch (e) {
    if (e instanceof UserError) {
      const v = await prisma.productVariant.findUnique({ where: { id: variantId } });
      return { error: t(e.message, { n: v?.stock ?? 0 }) };
    }
    throw e;
  }
  revalidatePath("/", "layout");
  if (buyNow) redirect("/cart");
  return { ok: true };
}

export async function setCartQuantityAction(itemId: string, quantity: number) {
  const t = await getT();
  try {
    await setCartQuantity(itemId, quantity);
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message, { n: "" }) };
    throw e;
  }
  revalidatePath("/cart");
  return {};
}

export async function applyDiscountAction(code: string) {
  const cart = await findCart(true);
  if (!cart) return {};
  await prisma.cart.update({ where: { id: cart.id }, data: { discountCode: code.trim().toUpperCase().slice(0, 30) || null } });
  revalidatePath("/cart");
  return {};
}

export type CheckoutState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function placeOrderAction(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in") };
  if (!rateLimit(`order:${user.id}`, 10, 30 * 60_000).ok) return { error: t("Too many attempts. Try again in a few minutes.") };
  const fe: Record<string, string> = {};
  const customerName = String(form.get("customerName") ?? "").trim();
  const phone = normalizeMobile(String(form.get("phone") ?? ""));
  const area = String(form.get("area") ?? "");
  const address = String(form.get("address") ?? "").trim();
  const building = String(form.get("building") ?? "").trim();
  if (customerName.length < 2) fe.customerName = t("Enter your name");
  if (!phone.ok) fe.phone = t(phone.error);
  if (!AREAS.some((a) => a.slug === area)) fe.area = t("Choose an area");
  if (address.length < 3) fe.address = t("Enter the street or neighbourhood");
  if (building.length < 1) fe.building = t("Enter the building");
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const method = form.get("method") === "WHISH" ? "WHISH" : "COD";
  let group;
  try {
    group = await placeOrder(
      user.id,
      { customerName, phone: (phone as { e164: string }).e164, area, address, building, floor: String(form.get("floor") ?? "").trim() || undefined, instructions: String(form.get("instructions") ?? "").trim().slice(0, 300) || undefined },
      method,
      await getLocale(),
    );
    if (method === "WHISH") {
      const { redirectUrl } = await startWhishPayment({ purpose: "ORDER", amountCents: group.totalCents, description: `EVNT order ${group.number}`, userId: user.id, orderGroupId: group.id, returnPath: `/account/orders/${group.number}` });
      redirect(redirectUrl);
    }
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  redirect(`/account/orders/${group.number}?new=1`);
}

export async function cancelMyOrderAction(groupNumber: string) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in") };
  try {
    await customerCancelOrder(groupNumber, user.id);
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  return {};
}

export async function retryOrderPaymentAction(groupNumber: string) {
  const t = await getT();
  const user = await getCurrentUser();
  const g = await prisma.orderGroup.findUnique({ where: { number: groupNumber }, include: { orders: true } });
  if (!user || !g || g.userId !== user.id) return { error: t("Order not found") };
  const unpaid = g.orders.filter((o) => o.status === "AWAITING_PAYMENT");
  if (!unpaid.length) return { error: t("Nothing to pay") };
  let url: string;
  try {
    ({ redirectUrl: url } = await startWhishPayment({ purpose: "ORDER", amountCents: unpaid.reduce((a, o) => a + o.totalCents, 0), description: `EVNT order ${g.number}`, userId: user.id, orderGroupId: g.id, returnPath: `/account/orders/${g.number}` }));
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  redirect(url);
}
