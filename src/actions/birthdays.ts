"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireMerchant, UserError } from "@/server/auth";
import { buyLead, createInquiry, requestQuotes, sendQuote } from "@/server/birthdays";
import { prisma } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { normalizeMobile } from "@/lib/phone";
import { parseMoney } from "@/lib/money";
import { parseBeirutLocal } from "@/lib/dates";
import { AREAS } from "@/lib/areas";
import { getT } from "@/i18n/server";

export type FormResult = { error?: string; fieldErrors?: Record<string, string>; message?: string } | undefined;

export async function createInquiryAction(_: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in to send your request") };
  if (!rateLimit(`inquiry:${user.id}`, 5, 3600_000).ok) return { error: t("Too many attempts. Try again in a few minutes.") };
  if (form.get("consent") !== "on") return { error: t("Please agree to share these details with the businesses you choose") };
  const date = parseBeirutLocal(String(form.get("date") ?? ""), "12:00");
  const area = String(form.get("area") ?? "");
  const phone = normalizeMobile(String(form.get("phone") ?? ""));
  if (!date) return { fieldErrors: { date: t("Choose the party date") } };
  if (!AREAS.some((a) => a.slug === area)) return { fieldErrors: { area: t("Choose an area") } };
  if (!phone.ok) return { fieldErrors: { phone: t(phone.error) } };
  let id: string;
  try {
    id = (
      await createInquiry(user.id, {
        childAge: parseInt(String(form.get("childAge") ?? ""), 10),
        date,
        area,
        guests: parseInt(String(form.get("guests") ?? ""), 10) || 0,
        budgetCents: parseMoney(String(form.get("budget") ?? "0")) ?? 0,
        services: form.getAll("services").map(String),
        notes: String(form.get("notes") ?? ""),
        phone: phone.e164,
      })
    ).id;
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  redirect(`/birthdays/plan/${id}`);
}

export async function requestQuotesAction(inquiryId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t("Please sign in") };
  const ids = form.getAll("merchant").map(String);
  if (!ids.length) return { error: t("Choose at least one business") };
  try {
    const n = await requestQuotes(user.id, inquiryId, ids);
    revalidatePath(`/birthdays/plan/${inquiryId}`);
    return { message: t("Sent to {n} businesses. You'll be notified when they reply.", { n }) };
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
}

export async function closeInquiryAction(inquiryId: string) {
  const user = await getCurrentUser();
  const i = await prisma.birthdayInquiry.findUnique({ where: { id: inquiryId } });
  if (!user || !i || i.userId !== user.id) return { error: "Not found" };
  await prisma.birthdayInquiry.update({ where: { id: inquiryId }, data: { status: "CLOSED" } });
  revalidatePath(`/birthdays/plan/${inquiryId}`);
  return {};
}

export async function sendQuoteAction(quoteId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const t = await getT();
  const ctx = await requireMerchant("STAFF");
  const decline = form.get("decline") === "1";
  const price = decline ? null : parseMoney(String(form.get("price") ?? ""));
  if (!decline && price == null) return { error: t("Enter your price") };
  try {
    await sendQuote(quoteId, ctx.merchant.id, price, String(form.get("message") ?? ""), decline);
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  revalidatePath("/merchant/leads");
  return { message: decline ? t("Declined") : t("Quote sent") };
}

export async function buyLeadAction(inquiryId: string) {
  const t = await getT();
  const ctx = await requireMerchant("MANAGER");
  try {
    await buyLead(ctx.merchant.id, inquiryId, ctx.user.id);
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  revalidatePath("/merchant/leads");
  return {};
}
