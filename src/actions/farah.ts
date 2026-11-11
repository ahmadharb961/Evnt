"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireMerchant, hasRole, UserError } from "@/server/auth";
import { applyForCertification, decideCertification, scheduleAssessment, submitAssessment, CHECKLIST } from "@/server/farah";
import { parseBeirutLocal } from "@/lib/dates";
import { getT } from "@/i18n/server";

export type FormResult = { error?: string; message?: string } | undefined;

const run = async (fn: () => Promise<unknown>, path: string) => {
  const t = await getT();
  try {
    await fn();
  } catch (e) {
    if (e instanceof UserError) return { error: t(e.message) };
    throw e;
  }
  revalidatePath(path);
  return { message: t("Saved") };
};

export async function applyFarahAction() {
  const ctx = await requireMerchant("OWNER");
  return run(() => applyForCertification(ctx.merchant.id, ctx.user.id), "/merchant/certification");
}

export async function scheduleFarahAction(certId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireAdmin("ADMIN");
  const at = parseBeirutLocal(String(form.get("date") ?? ""), String(form.get("time") ?? "10:00"));
  if (!at) return { error: "Choose a date" };
  return run(() => scheduleAssessment(certId, String(form.get("evaluatorId") ?? ""), at, admin.id), `/admin/farah/${certId}`);
}

export async function submitAssessmentAction(certId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const u = await requireAdmin("EVALUATOR", "ADMIN");
  const results = CHECKLIST.map((c) => ({ key: c.key, passed: form.get(`c_${c.key}`) === "pass", note: String(form.get(`n_${c.key}`) ?? "").slice(0, 300) || undefined }));
  const missing = CHECKLIST.filter((c) => !form.get(`c_${c.key}`));
  if (missing.length) return { error: "Mark every checklist item as pass or fail" };
  return run(() => submitAssessment(certId, u.id, hasRole(u, "SUPER_ADMIN"), results, String(form.get("findings") ?? "")), `/admin/farah/${certId}`);
}

export async function decideFarahAction(certId: string, approve: boolean, note?: string) {
  const admin = await requireAdmin("ADMIN");
  return run(() => decideCertification(certId, approve, note ?? "", admin.id), `/admin/farah/${certId}`);
}
