"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/server/db";
import { createSession, destroySession, getCurrentUser, hashPassword, validatePassword, verifyPassword } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { normalizeMobile } from "@/lib/phone";
import { mergeDeviceCart } from "@/server/cart";
import { getLocale, getT } from "@/i18n/server";
import { hmac, randomToken } from "@/server/crypto";
import { sendEmail } from "@/server/email";
import { appUrl } from "@/server/urls";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string } | undefined;

export async function safeNext(next: unknown, fallback: string) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : fallback;
}

async function afterSignIn(userId: string) {
  await createSession(userId, (await headers()).get("user-agent"));
  await mergeDeviceCart(userId);
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const ip = (await clientIp()) ?? "unknown";
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000).ok || !rateLimit(`login:${email}`, 8, 15 * 60_000).ok)
    return { error: t("Too many attempts. Try again in a few minutes.") };
  const user = await prisma.user.findUnique({ where: { email }, include: { roles: true, staff: true } });
  if (!user || user.disabled || !user.passwordHash || !(await verifyPassword(password, user.passwordHash)))
    return { error: t("Incorrect email or password") };
  await afterSignIn(user.id);
  const fallback = user.roles.length ? "/admin" : user.staff.length ? "/merchant" : "/account";
  redirect(await safeNext(form.get("next"), fallback));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  const ip = (await clientIp()) ?? "unknown";
  if (!rateLimit(`register:${ip}`, 6, 60 * 60_000).ok) return { error: t("Too many sign-ups from this network. Try later.") };
  const schema = z.object({
    name: z.string().trim().min(2, t("Enter your name")).max(80),
    email: z.string().trim().toLowerCase().email(t("Enter a valid email")),
    password: z.string(),
    phone: z.string().trim(),
  });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const { name, email, password } = parsed.data;
  const pwErr = validatePassword(password);
  if (pwErr) return { fieldErrors: { password: t(pwErr) } };
  const mobile = normalizeMobile(parsed.data.phone);
  if (!mobile.ok) return { fieldErrors: { phone: t(mobile.error) } };
  if (form.get("terms") !== "on") return { fieldErrors: { terms: t("Please accept the terms and privacy policy") } };
  if (await prisma.user.findUnique({ where: { email } })) return { fieldErrors: { email: t("An account with this email already exists") } };
  const user = await prisma.user.create({
    data: {
      email,
      name,
      phone: mobile.e164,
      passwordHash: await hashPassword(password),
      locale: await getLocale(),
      marketingEmail: form.get("marketing") === "on",
    },
  });
  await afterSignIn(user.id);
  redirect(await safeNext(form.get("next"), "/account?welcome=1"));
}

export async function requestPasswordResetAction(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const ip = (await clientIp()) ?? "unknown";
  if (!rateLimit(`reset:${ip}`, 5, 60 * 60_000).ok) return { error: t("Too many attempts. Try again in a few minutes.") };
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.disabled) {
    const token = randomToken();
    await prisma.passwordReset.create({ data: { tokenHash: hmac(token), userId: user.id, expiresAt: new Date(Date.now() + 3600_000) } });
    const ut = await (await import("@/i18n/server")).tFor(user.locale);
    await sendEmail(
      user.email,
      ut("Reset your EVNT password"),
      ut("Hi {name},\n\nUse this link to choose a new password (valid for 1 hour):\n{link}\n\nIf you didn't ask for this, you can ignore this email.", {
        name: user.name,
        link: `${appUrl()}/reset-password?token=${token}`,
      }),
    );
  }
  // Same answer whether or not the account exists.
  return { ok: true, message: t("If an account exists for this email, we've sent a reset link.") };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  const token = String(form.get("token") || "");
  const password = String(form.get("password") || "");
  const pwErr = validatePassword(password);
  if (pwErr) return { fieldErrors: { password: t(pwErr) } };
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: hmac(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return { error: t("This link has expired. Request a new one.") };
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  await afterSignIn(row.userId);
  redirect("/account");
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in") };
  const name = String(form.get("name") || "").trim();
  if (name.length < 2) return { fieldErrors: { name: t("Enter your name") } };
  const mobile = normalizeMobile(String(form.get("phone") || ""));
  if (!mobile.ok) return { fieldErrors: { phone: t(mobile.error) } };
  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      phone: mobile.e164,
      notifyEmail: form.get("notifyEmail") === "on",
      notifyWhatsapp: form.get("notifyWhatsapp") === "on",
      marketingEmail: form.get("marketingEmail") === "on",
      marketingWhatsapp: form.get("marketingWhatsapp") === "on",
    },
  });
  return { ok: true, message: t("Saved") };
}
