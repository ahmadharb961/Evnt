"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { destroySession, getCurrentUser, verifyPassword } from "@/server/auth";
import { parseMoney } from "@/lib/money";
import { AGE_BANDS, AREAS } from "@/lib/areas";
import { getT } from "@/i18n/server";

export type FormResult = { error?: string; message?: string; fieldErrors?: Record<string, string> } | undefined;

/** Family preferences: age bands, interests, areas, budget. Never names or birth dates. */
export async function saveFamilyAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in") };
  if (form.get("consent") !== "on") return { error: t("Please confirm you're the parent or guardian and agree to save these preferences") };
  const bands = form.getAll("ageBands").map(String).filter((b) => AGE_BANDS.some((x) => x.key === b));
  const areas = form.getAll("areas").map(String).filter((a) => AREAS.some((x) => x.slug === a)).slice(0, 5);
  const cats = await prisma.category.findMany({ where: { slug: { in: form.getAll("interests").map(String) } }, select: { slug: true } });
  const budget = String(form.get("budget") ?? "").trim() ? parseMoney(String(form.get("budget"))) : null;
  const data = { ageBands: bands, interests: cats.map((c) => c.slug), preferredAreas: areas, maxBudgetCents: budget, consentAt: new Date() };
  await prisma.familyProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  revalidatePath("/");
  return { message: t("Saved. Your suggestions are now personalised.") };
}

export async function deleteFamilyAction() {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.familyProfile.deleteMany({ where: { userId: user.id } });
  revalidatePath("/account/family");
}

export async function markNotificationsReadAction() {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/account/notifications");
}

/** Deletes the account. Personal data is removed or anonymised; financial records are kept as the law requires. */
export async function deleteAccountAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in") };
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (u.passwordHash && !(await verifyPassword(String(form.get("password") ?? ""), u.passwordHash))) return { fieldErrors: { password: t("Incorrect password") } };
  if (await prisma.merchantStaff.count({ where: { userId: user.id, role: "OWNER" } })) return { error: t("You own a business on EVNT. Transfer or close it first.") };
  await prisma.$transaction([
    prisma.familyProfile.deleteMany({ where: { userId: user.id } }),
    prisma.favorite.deleteMany({ where: { userId: user.id } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.oAuthAccount.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { email: `deleted-${user.id}@deleted.evnt`, name: "Deleted user", phone: null, passwordHash: null, disabled: true, marketingEmail: false, marketingWhatsapp: false } }),
    prisma.auditLog.create({ data: { actorId: user.id, action: "account.deleted", entityType: "user", entityId: user.id } }),
  ]);
  await destroySession();
  redirect("/?deleted=1");
}
