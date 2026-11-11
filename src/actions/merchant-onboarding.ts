"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import type { MerchantType } from "@prisma/client";
import { prisma } from "@/server/db";
import { createSession, getCurrentUser, hashPassword, MERCHANT_COOKIE, requireMerchant, UserError, validatePassword } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { normalizeMobile, normalizePhone } from "@/lib/phone";
import { slugify } from "@/lib/codes";
import { getLocale, getT } from "@/i18n/server";
import { localizedFromForm } from "@/i18n/core";
import { changePlan } from "@/server/billing";
import { notifyAdmins } from "@/server/notify";
import { AREAS } from "@/lib/areas";

export type OnbState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const TYPES: MerchantType[] = ["ACTIVITY_PROVIDER", "VENUE", "RESTAURANT", "RETAILER", "BIRTHDAY_SERVICE", "EVENT_ORGANIZER"];

async function uniqueMerchantSlug(name: string) {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    if (!(await prisma.merchant.findUnique({ where: { slug: s } }))) return s;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function uniqueAttributionCode() {
  for (;;) {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    const code = Array.from(bytes, (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
    if (!(await prisma.merchant.findUnique({ where: { attributionCode: code } }))) return code;
  }
}

/** Step 1: create the account (or use the signed-in one) and the business. */
export async function joinAction(_: OnbState, form: FormData): Promise<OnbState> {
  const t = await getT();
  const ip = (await clientIp()) ?? "unknown";
  if (!rateLimit(`join:${ip}`, 5, 3600_000).ok) return { error: t("Too many sign-ups from this network. Try later.") };
  const businessName = String(form.get("businessName") ?? "").trim();
  const type = String(form.get("type") ?? "") as MerchantType;
  if (businessName.length < 2) return { fieldErrors: { businessName: t("Enter your business name") } };
  if (!TYPES.includes(type)) return { fieldErrors: { type: t("Choose your business type") } };
  if (form.get("terms") !== "on") return { fieldErrors: { terms: t("Please accept the merchant terms") } };
  let user = await getCurrentUser();
  if (!user) {
    const schema = z.object({ name: z.string().trim().min(2), email: z.string().trim().toLowerCase().email(), password: z.string(), phone: z.string() });
    const p = schema.safeParse(Object.fromEntries(form));
    if (!p.success) return { fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), t("Please check this field")])) };
    const pw = validatePassword(p.data.password);
    if (pw) return { fieldErrors: { password: t(pw) } };
    const mobile = normalizeMobile(p.data.phone);
    if (!mobile.ok) return { fieldErrors: { phone: t(mobile.error) } };
    if (await prisma.user.findUnique({ where: { email: p.data.email } })) return { fieldErrors: { email: t("This email already has an account. Sign in first, then add your business.") } };
    const u = await prisma.user.create({ data: { email: p.data.email, name: p.data.name, phone: mobile.e164, passwordHash: await hashPassword(p.data.password), locale: await getLocale() } });
    await createSession(u.id, (await headers()).get("user-agent"));
    user = { id: u.id, email: u.email, name: u.name, phone: u.phone, locale: u.locale, roles: [] };
  }
  const m = await prisma.merchant.create({
    data: {
      slug: await uniqueMerchantSlug(businessName),
      name: businessName,
      type,
      status: "ONBOARDING",
      onboardingStep: 3,
      attributionCode: await uniqueAttributionCode(),
      email: user.email,
      phone: user.phone,
      whatsapp: user.phone,
      staff: { create: { userId: user.id, role: "OWNER" } },
      subscriptions: { create: { plan: "BASIC", status: "ACTIVE", priceCents: 0, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 365 * 86400_000) } },
    },
  });
  (await cookies()).set(MERCHANT_COOKIE, m.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "merchant.created", entityType: "merchant", entityId: m.id } });
  redirect("/merchant/onboarding");
}

/** Steps 3–9 of the guided onboarding. Each step saves and moves forward. */
export async function onboardingStepAction(_: OnbState, form: FormData): Promise<OnbState> {
  const t = await getT();
  const ctx = await requireMerchant("OWNER");
  const m = ctx.merchant;
  const step = Number(form.get("step"));
  const next = (n: number) => prisma.merchant.update({ where: { id: m.id }, data: { onboardingStep: Math.max(m.onboardingStep, n) } });
  try {
    if (step === 2) {
      const type = String(form.get("type")) as MerchantType;
      if (!TYPES.includes(type)) return { error: t("Choose your business type") };
      await prisma.merchant.update({ where: { id: m.id }, data: { type } });
      await next(3);
    } else if (step === 3) {
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
        where: { id: m.id },
        data: { name, about: localizedFromForm(form, "about"), phone: phone.e164, whatsapp: whatsapp?.ok ? whatsapp.e164 : null, email: String(form.get("email") ?? "").trim() || null, website: website || null, instagram: String(form.get("instagram") ?? "").trim().replace(/^@/, "") || null },
      });
      await next(4);
    } else if (step === 4) {
      const area = String(form.get("area") ?? "");
      const address = String(form.get("address") ?? "").trim();
      if (!AREAS.some((a) => a.slug === area)) return { fieldErrors: { area: t("Choose an area") } };
      if (address.length < 4) return { fieldErrors: { address: t("Enter the address") } };
      const lat = parseFloat(String(form.get("lat") ?? ""));
      const lng = parseFloat(String(form.get("lng") ?? ""));
      const fallback = AREAS.find((a) => a.slug === area)!;
      const data = { name: String(form.get("locName") ?? "").trim() || "Main", area, address, lat: Number.isFinite(lat) ? lat : fallback.lat, lng: Number.isFinite(lng) ? lng : fallback.lng };
      const existing = await prisma.merchantLocation.findFirst({ where: { merchantId: m.id } });
      if (existing) await prisma.merchantLocation.update({ where: { id: existing.id }, data });
      else await prisma.merchantLocation.create({ data: { ...data, merchantId: m.id } });
      await next(5);
    } else if (step === 5) {
      const logoId = String(form.get("logoId") ?? "") || null;
      const coverId = String(form.get("coverId") ?? "") || null;
      if (!coverId) return { error: t("Add at least a cover photo") };
      await prisma.merchant.update({ where: { id: m.id }, data: { logoId, coverId } });
      await next(6);
    } else if (step === 6) {
      const plan = String(form.get("plan"));
      const interval = form.get("interval") === "YEARLY" ? "YEARLY" : "MONTHLY";
      if (plan !== "BASIC" && plan !== "PRO" && plan !== "FEATURED") return { error: t("Choose a plan") };
      if (plan !== m.plan) await changePlan(m.id, plan, interval, { useTrial: form.get("trial") === "on", actorId: ctx.user.id });
      await next(7);
    } else if (step === 7) {
      await next(8);
    } else if (step === 8) {
      const method = String(form.get("payoutMethod") ?? "");
      const name = String(form.get("payoutName") ?? "").trim();
      const account = String(form.get("payoutAccount") ?? "").trim();
      if (!["whish", "bank"].includes(method)) return { error: t("Choose how you'd like to be paid") };
      if (name.length < 2 || account.length < 5) return { error: t("Enter the account holder and account number") };
      await prisma.merchant.update({ where: { id: m.id }, data: { payoutMethod: method, payoutName: name, payoutAccount: account.slice(0, 60) } });
      await next(9);
    } else if (step === 9) {
      const loc = await prisma.merchantLocation.count({ where: { merchantId: m.id } });
      if (!m.coverId || !loc || !m.payoutAccount) return { error: t("Please complete the previous steps first") };
      await prisma.merchant.update({ where: { id: m.id }, data: { status: "PENDING", onboardingStep: 10 } });
      await notifyAdmins({ kind: "merchant.review", title: `New business to verify: ${m.name}`, body: `${m.type} · ${m.email ?? ""}`, link: `/admin/merchants/${m.id}` });
    }
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  redirect(step === 9 ? "/merchant?submitted=1" : "/merchant/onboarding");
}

export async function switchMerchantAction(id: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const ok = await prisma.merchantStaff.findFirst({ where: { userId: user.id, merchantId: id } });
  if (ok) (await cookies()).set(MERCHANT_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect("/merchant");
}
