import "server-only";
import { prisma } from "./db";
import { sendEmail } from "./email";
import { tFor } from "@/i18n/server";
import type { Vars } from "@/i18n/core";
import { appUrl } from "./urls";

/**
 * In-app notification + (optional) email, in the recipient's language.
 * `title` and `body` are English texts translated through the dictionaries.
 */
export async function notifyUser(userId: string, n: { kind: string; title: string; body: string; vars?: Vars; link?: string; email?: boolean }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const t = await tFor(user.locale);
  const title = t(n.title, n.vars);
  const body = t(n.body, n.vars);
  await prisma.notification.create({ data: { userId, kind: n.kind, title, body, link: n.link } });
  if (n.email !== false && user.notifyEmail) {
    await sendEmail(user.email, title, `${body}${n.link ? `\n\n${appUrl()}${n.link}` : ""}`).catch(() => false);
  }
}

/** Notification to a merchant's dashboard + email to the owners and managers. */
export async function notifyMerchant(merchantId: string, n: { kind: string; title: string; body: string; vars?: Vars; link?: string; email?: boolean }) {
  const staff = await prisma.merchantStaff.findMany({ where: { merchantId, role: { in: ["OWNER", "MANAGER"] } }, include: { user: true } });
  const owner = staff[0]?.user;
  const t = await tFor(owner?.locale ?? "en");
  await prisma.notification.create({ data: { merchantId, kind: n.kind, title: t(n.title, n.vars), body: t(n.body, n.vars), link: n.link } });
  if (n.email === false) return;
  for (const s of staff) {
    const st = await tFor(s.user.locale);
    await sendEmail(s.user.email, st(n.title, n.vars), `${st(n.body, n.vars)}${n.link ? `\n\n${appUrl()}${n.link}` : ""}`).catch(() => false);
  }
}

export async function notifyAdmins(n: { kind: string; title: string; body: string; link?: string }) {
  await prisma.notification.create({ data: { kind: n.kind, title: n.title, body: n.body, link: n.link } });
}
