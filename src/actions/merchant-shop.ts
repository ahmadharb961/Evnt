"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireMerchant, UserError } from "@/server/auth";
import { reindexProduct } from "@/server/listings";
import { updateOrderStatus } from "@/server/orders";
import { getT } from "@/i18n/server";
import { localizedFromForm } from "@/i18n/core";
import { slugify } from "@/lib/codes";
import { parseMoney } from "@/lib/money";

export type FormResult = { error?: string; fieldErrors?: Record<string, string>; message?: string } | undefined;

async function uniqueProductSlug(title: string, exceptId?: string) {
  const base = slugify(title);
  for (let i = 0; i < 100; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    const hit = await prisma.product.findUnique({ where: { slug: s } });
    if (!hit || hit.id === exceptId) return s;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function saveProductAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const id = String(form.get("id") ?? "");
  const title = localizedFromForm(form, "title");
  if (!title.en && !title.ar && !title.fr) return { fieldErrors: { title: t("Enter a product name") } };
  const cat = await prisma.category.findUnique({ where: { id: String(form.get("categoryId") ?? "") } });
  if (!cat || cat.kind !== "PRODUCT") return { fieldErrors: { categoryId: t("Choose a category") } };
  const price = parseMoney(String(form.get("price") ?? ""));
  if (price == null || price <= 0) return { fieldErrors: { price: t("Enter a valid price") } };
  const saleRaw = String(form.get("salePrice") ?? "").trim();
  const sale = saleRaw ? parseMoney(saleRaw) : null;
  if (saleRaw && (sale == null || sale >= price)) return { fieldErrors: { salePrice: t("Sale price must be lower than the price") } };
  const images = String(form.get("images") ?? "").split(",").filter(Boolean).slice(0, 10);
  if (!images.length) return { error: t("Add at least one photo") };
  const ageMinRaw = String(form.get("ageMin") ?? "");
  const ageMaxRaw = String(form.get("ageMax") ?? "");
  // Variants: rows of name / stock / optional price
  const names = form.getAll("vName").map(String);
  const stocks = form.getAll("vStock").map((v) => Math.max(0, parseInt(String(v), 10) || 0));
  const prices = form.getAll("vPrice").map((v) => (String(v).trim() ? parseMoney(String(v)) : null));
  const ids = form.getAll("vId").map(String);
  const variants = names.map((n, i) => ({ id: ids[i] || "", name: n.trim() || "Default", stock: stocks[i] ?? 0, priceCents: prices[i] ?? null })).filter((v, i) => names[i].trim() || i === 0);
  if (!variants.length) return { error: t("Add at least one option") };
  const data = {
    title,
    description: localizedFromForm(form, "description"),
    deliveryInfo: localizedFromForm(form, "deliveryInfo"),
    categoryId: cat.id,
    priceCents: price,
    salePriceCents: sale,
    images,
    ageMin: ageMinRaw ? Math.max(0, Math.min(16, parseInt(ageMinRaw, 10))) : null,
    ageMax: ageMaxRaw ? Math.max(0, Math.min(16, parseInt(ageMaxRaw, 10))) : null,
  };
  let productId = id;
  if (id) {
    const p = await prisma.product.findUnique({ where: { id } });
    if (!p || p.merchantId !== ctx.merchant.id) return { error: t("Not found") };
    await prisma.product.update({ where: { id }, data });
  } else {
    productId = (await prisma.product.create({ data: { ...data, merchantId: ctx.merchant.id, slug: await uniqueProductSlug(title.en || title.fr || title.ar || "product"), status: "DRAFT" } })).id;
  }
  const existing = await prisma.productVariant.findMany({ where: { productId } });
  const keep = new Set<string>();
  for (const v of variants) {
    const prev = existing.find((e) => e.id === v.id);
    if (prev) {
      await prisma.productVariant.update({ where: { id: prev.id }, data: { name: v.name, stock: v.stock, priceCents: v.priceCents, active: true } });
      keep.add(prev.id);
    } else keep.add((await prisma.productVariant.create({ data: { productId, name: v.name, stock: v.stock, priceCents: v.priceCents } })).id);
  }
  // Removed options are deactivated (past orders still reference them).
  await prisma.productVariant.updateMany({ where: { productId, id: { notIn: [...keep] } }, data: { active: false } });
  await reindexProduct(productId);
  await prisma.auditLog.create({ data: { actorId: ctx.user.id, action: id ? "product.updated" : "product.created", entityType: "product", entityId: productId } });
  revalidatePath("/merchant/products");
  if (!id) redirect(`/merchant/products/${productId}?saved=1`);
  return { message: t("Saved") };
}

export async function setProductStatusAction(productId: string, status: "PUBLISHED" | "DRAFT" | "ARCHIVED") {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p || p.merchantId !== ctx.merchant.id) return { error: t("Not found") };
  if (status === "PUBLISHED" && ctx.merchant.status !== "APPROVED") return { error: t("Your business must be verified before listings can go live.") };
  await prisma.product.update({ where: { id: productId }, data: { status } });
  revalidatePath(`/merchant/products/${productId}`);
  return {};
}

export async function saveShopSettingsAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const ctx = await requireMerchant("OWNER");
  const fee = parseMoney(String(form.get("deliveryFee") ?? "0"));
  const freeRaw = String(form.get("freeOver") ?? "").trim();
  const free = freeRaw ? parseMoney(freeRaw) : null;
  if (fee == null || (freeRaw && free == null)) return { error: t("Enter valid amounts") };
  await prisma.merchant.update({ where: { id: ctx.merchant.id }, data: { deliveryFeeCents: fee, freeDeliveryOverCents: free, codEnabled: form.get("cod") === "on" } });
  return { message: t("Saved") };
}

export async function orderStatusAction(orderNumber: string, status: OrderStatus, input?: string) {
  const t = await getT();
  const ctx = await requireMerchant("STAFF");
  try {
    let collectedCents: number | undefined;
    if (status === "DELIVERED") {
      const o = await prisma.order.findUnique({ where: { number: orderNumber } });
      if (o?.paymentMethod === "COD") {
        const c = parseMoney(input ?? "");
        if (c == null) return { error: t("Enter the cash amount collected") };
        collectedCents = c;
      }
    }
    await updateOrderStatus(orderNumber, ctx.merchant.id, ctx.user.id, status, { collectedCents, reason: status === "CANCELED" ? input : undefined });
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  revalidatePath(`/merchant/orders/${orderNumber}`);
  return {};
}
