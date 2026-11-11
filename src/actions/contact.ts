"use server";

import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { notifyAdmins } from "@/server/notify";
import { getT } from "@/i18n/server";

export async function contactAction(_: { error?: string; message?: string } | undefined, form: FormData) {
  const t = await getT();
  if (String(form.get("website") ?? "")) return { message: t("Thanks! We'll get back to you soon.") }; // honeypot
  const ip = (await clientIp()) ?? "unknown";
  if (!rateLimit(`contact:${ip}`, 5, 3600_000).ok) return { error: t("Too many attempts. Try again in a few minutes.") };
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  const message = String(form.get("message") ?? "").trim().slice(0, 3000);
  const topic = String(form.get("topic") ?? "other").slice(0, 20);
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || message.length < 10) return { error: t("Please fill in your name, a valid email and your message") };
  const user = await getCurrentUser();
  await prisma.contactMessage.create({ data: { name, email, topic, message, userId: user?.id } });
  await notifyAdmins({ kind: "contact", title: `Contact: ${topic}`, body: `${name} <${email}>`, link: "/admin/marketing" });
  return { message: t("Thanks! We'll get back to you soon.") };
}
