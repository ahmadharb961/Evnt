import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Merchant, Role, StaffRole } from "@prisma/client";
import { prisma } from "./db";
import { hmac, randomToken } from "./crypto";
import { ipHash } from "./request";
import { isLocale, LOCALE_COOKIE } from "@/i18n/core";

export const SESSION_COOKIE = "evnt_session";
export const MERCHANT_COOKIE = "evnt_merchant";
/** Set by "Manage as admin": the merchant an admin is currently working in. */
export const ADMIN_AS_COOKIE = "evnt_admin_as";
const SESSION_DAYS = 30;

export { hashPassword, verifyPassword, validatePassword } from "./passwords";

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.session.create({
    data: { tokenHash: hmac(token), userId, expiresAt, ipHash: await ipHash(), userAgent: userAgent?.slice(0, 200) },
  });
  const jar = await cookies();
  const device = jar.get(LOCALE_COOKIE)?.value;
  const u = await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() }, select: { locale: true } });
  // The language chosen on this device wins; it becomes the account's language (emails etc.).
  if (isLocale(device) && device !== u.locale) await prisma.user.update({ where: { id: userId }, data: { locale: device } });
  else if (isLocale(u.locale)) jar.set(LOCALE_COOKIE, u.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hmac(token) } });
  jar.delete(SESSION_COOKIE);
  jar.delete(MERCHANT_COOKIE);
  jar.delete(ADMIN_AS_COOKIE);
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  locale: string;
  roles: Role[];
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hmac(token) },
    include: { user: { include: { roles: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.disabled) return null;
  const u = session.user;
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, locale: u.locale, roles: u.roles.map((r) => r.role) };
});

export function hasRole(user: CurrentUser | null, ...roles: Role[]) {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN")) return true;
  return roles.some((r) => user.roles.includes(r));
}

export const isStaffUser = (u: CurrentUser | null) => !!u && u.roles.length > 0;

export async function requireUser(next = "/account"): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

/**
 * Admin area access. SUPER_ADMIN can do everything; other roles get their own modules:
 * ADMIN (operations), FINANCE (money), CONTENT (CMS & moderation), EVALUATOR (Farah assessments).
 */
export async function requireAdmin(...roles: Role[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login?next=/admin");
  const allowed = roles.length ? roles : (["ADMIN", "FINANCE", "CONTENT", "EVALUATOR"] as Role[]);
  if (!hasRole(u, ...allowed)) {
    if (isStaffUser(u)) throw new PermissionError("Your admin role does not include this area");
    redirect("/");
  }
  return u;
}

const STAFF_RANK: Record<StaffRole, number> = { STAFF: 1, MANAGER: 2, OWNER: 3 };

export type MerchantContext = {
  user: CurrentUser;
  merchant: Merchant;
  staffRole: StaffRole;
  memberships: { id: string; name: string }[];
  asAdmin?: boolean;
};

/** Resolves the active merchant for the current user. This is the tenant-isolation boundary. */
export const getMerchantContext = cache(async (): Promise<MerchantContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const jar = await cookies();
  const asId = jar.get(ADMIN_AS_COOKIE)?.value;
  if (asId && hasRole(user, "ADMIN")) {
    const m = await prisma.merchant.findUnique({ where: { id: asId } });
    if (m) return { user, merchant: m, staffRole: "OWNER", memberships: [{ id: m.id, name: m.name }], asAdmin: true };
  }
  const memberships = await prisma.merchantStaff.findMany({
    where: { userId: user.id },
    include: { merchant: true },
    orderBy: { createdAt: "asc" },
  });
  if (!memberships.length) return null;
  const chosen = jar.get(MERCHANT_COOKIE)?.value;
  const m = memberships.find((x) => x.merchantId === chosen) ?? memberships[0];
  return {
    user,
    merchant: m.merchant,
    staffRole: m.role,
    memberships: memberships.map((x) => ({ id: x.merchant.id, name: x.merchant.name })),
  };
});

export async function requireMerchant(minRole: StaffRole = "STAFF"): Promise<MerchantContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/merchant");
  const ctx = await getMerchantContext();
  if (!ctx) redirect("/business/join");
  if (STAFF_RANK[ctx.staffRole] < STAFF_RANK[minRole]) throw new PermissionError(`Requires ${minRole.toLowerCase()} access`);
  return ctx;
}

export function canAccess(role: StaffRole, minRole: StaffRole) {
  return STAFF_RANK[role] >= STAFF_RANK[minRole];
}

export class PermissionError extends Error {
  status = 403;
}

export class UserError extends Error {
  status = 400;
}
