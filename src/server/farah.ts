import "server-only";
import { prisma } from "./db";
import { UserError } from "./auth";
import { getSetting } from "./settings";
import { createInvoice } from "./billing";
import { notifyAdmins, notifyMerchant } from "./notify";

// Farah Approved: an independent family-friendliness certification.
// Payment never grants the badge. Flow: apply → pay assessment → scheduled → evaluator checklist →
// admin decision → (approved) annual license invoice → badge visible once the license is paid → expires.

export const CHECKLIST = [
  { key: "safety_surfaces", group: "Safety", label: "Safe surfaces, no sharp edges or hazards in kids' areas" },
  { key: "safety_exits", group: "Safety", label: "Clear emergency exits and first-aid kit" },
  { key: "safety_supervision", group: "Safety", label: "Supervision and child-safe procedures" },
  { key: "clean_toilets", group: "Cleanliness", label: "Clean toilets with changing table" },
  { key: "clean_areas", group: "Cleanliness", label: "Clean play and dining areas" },
  { key: "staff_friendly", group: "Staff", label: "Staff welcoming to children and parents" },
  { key: "staff_trained", group: "Staff", label: "Staff briefed on child safety" },
  { key: "access_stroller", group: "Comfort", label: "Stroller access" },
  { key: "comfort_seating", group: "Comfort", label: "Family seating and high chairs where relevant" },
  { key: "comfort_food", group: "Comfort", label: "Kids' food/drinks options or allowed" },
  { key: "info_clear", group: "Transparency", label: "Clear prices, ages and rules" },
  { key: "noise_light", group: "Comfort", label: "Reasonable noise, lighting and temperature for kids" },
] as const;

export const PASS_SCORE = 80; // percent

export async function applyForCertification(merchantId: string, actorId: string) {
  const m = await prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } });
  if (m.status !== "APPROVED") throw new UserError("Your business must be verified first");
  const open = await prisma.certification.findFirst({ where: { merchantId, status: { in: ["AWAITING_PAYMENT", "PAID", "SCHEDULED", "ASSESSED"] } } });
  if (open) throw new UserError("You already have an application in progress");
  const last = await prisma.certification.findFirst({ where: { merchantId, status: { in: ["APPROVED", "REJECTED", "EXPIRED"] } }, orderBy: { createdAt: "desc" } });
  const kind = !last ? "INITIAL" : last.status === "REJECTED" ? "REEVALUATION" : "RENEWAL";
  const fee = kind === "INITIAL" ? await getSetting("cert.assessmentCents") : kind === "RENEWAL" ? await getSetting("cert.renewalCents") : await getSetting("cert.reevaluationCents");
  const cert = await prisma.certification.create({ data: { merchantId, kind, feeCents: fee } });
  const label = { INITIAL: "Farah Approved initial venue assessment", RENEWAL: "Farah Approved annual renewal assessment", REEVALUATION: "Farah Approved re-evaluation" }[kind];
  const inv = await createInvoice(merchantId, [{ kind: "CERTIFICATION", description: label, amountCents: fee, refType: "certification", refId: cert.id }]);
  await prisma.certification.update({ where: { id: cert.id }, data: { invoiceId: inv.id } });
  await prisma.auditLog.create({ data: { actorId, action: "farah.applied", entityType: "certification", entityId: cert.id, data: { kind } } });
  await notifyAdmins({ kind: "farah.applied", title: `Farah Approved application: ${m.name}`, body: kind, link: `/admin/farah/${cert.id}` });
  return cert;
}

export async function scheduleAssessment(certId: string, evaluatorId: string, at: Date, actorId: string) {
  const c = await prisma.certification.findUnique({ where: { id: certId } });
  if (!c || !["PAID", "SCHEDULED"].includes(c.status)) throw new UserError("The assessment fee must be paid before scheduling");
  const ev = await prisma.userRole.findFirst({ where: { userId: evaluatorId, role: { in: ["EVALUATOR", "SUPER_ADMIN"] } } });
  if (!ev) throw new UserError("Choose an evaluator");
  await prisma.certification.update({ where: { id: certId }, data: { status: "SCHEDULED", evaluatorId, scheduledAt: at } });
  await prisma.auditLog.create({ data: { actorId, action: "farah.scheduled", entityType: "certification", entityId: certId, data: { evaluatorId, at } } });
  await notifyMerchant(c.merchantId, { kind: "farah.scheduled", title: "Your Farah Approved assessment is scheduled", body: "An independent evaluator will visit on the scheduled date.", link: "/merchant/certification" });
}

/** The evaluator records the structured checklist. Only the assigned evaluator (or a super admin) can. */
export async function submitAssessment(certId: string, evaluatorId: string, isSuper: boolean, results: { key: string; passed: boolean; note?: string }[], findings: string) {
  const c = await prisma.certification.findUnique({ where: { id: certId } });
  if (!c || c.status !== "SCHEDULED") throw new UserError("This assessment isn't scheduled");
  if (c.evaluatorId !== evaluatorId && !isSuper) throw new UserError("Only the assigned evaluator can submit this assessment");
  const keys = new Set(CHECKLIST.map((x) => x.key));
  const clean = results.filter((r) => keys.has(r.key as (typeof CHECKLIST)[number]["key"]));
  if (clean.length !== CHECKLIST.length) throw new UserError("Complete every checklist item");
  const score = Math.round((clean.filter((r) => r.passed).length / clean.length) * 100);
  await prisma.certification.update({ where: { id: certId }, data: { status: "ASSESSED", checklist: clean, score, findings: findings.slice(0, 4000) } });
  await prisma.auditLog.create({ data: { actorId: evaluatorId, action: "farah.assessed", entityType: "certification", entityId: certId, data: { score } } });
}

/** Admin decision on an assessed application. Sponsored content and payments play no part here. */
export async function decideCertification(certId: string, approve: boolean, note: string, actorId: string) {
  const c = await prisma.certification.findUnique({ where: { id: certId } });
  if (!c || c.status !== "ASSESSED") throw new UserError("Only assessed applications can be decided");
  if (approve && (c.score ?? 0) < PASS_SCORE) throw new UserError(`The score is below the ${PASS_SCORE}% pass mark`);
  const months = await getSetting("cert.validMonths");
  const from = new Date();
  const until = new Date(from);
  until.setMonth(until.getMonth() + months);
  await prisma.certification.update({ where: { id: certId }, data: { status: approve ? "APPROVED" : "REJECTED", decidedById: actorId, decidedAt: from, decisionNote: note.slice(0, 1000), validFrom: approve ? from : null, validUntil: approve ? until : null } });
  if (approve) {
    const fee = await getSetting("cert.licenseCents");
    await createInvoice(c.merchantId, [{ kind: "CERTIFICATION", description: "Farah Approved annual certification license", amountCents: fee, refType: "farah-license", refId: c.id }]);
  }
  await prisma.auditLog.create({ data: { actorId, action: approve ? "farah.approved" : "farah.rejected", entityType: "certification", entityId: certId, data: { note } } });
  await notifyMerchant(c.merchantId, {
    kind: approve ? "farah.approved" : "farah.rejected",
    title: approve ? "You passed the Farah Approved assessment!" : "Farah Approved assessment result",
    body: approve ? "Pay your annual license invoice to display the Farah Approved badge." : "Your venue didn't pass this time. See the findings and apply for a re-evaluation when ready.",
    link: "/merchant/certification",
  });
}

/** Called when the license invoice is paid: the badge becomes visible until the end of the licensed period. */
export async function activateLicense(certId: string) {
  const c = await prisma.certification.findUnique({ where: { id: certId } });
  if (!c || c.status !== "APPROVED" || !c.validUntil) return;
  await prisma.merchant.update({ where: { id: c.merchantId }, data: { farahUntil: c.validUntil } });
}

/** Cron: expired certifications. The badge stops showing automatically (farahUntil in the past). */
export async function expireCertifications(now = new Date()) {
  const r = await prisma.certification.updateMany({ where: { status: "APPROVED", validUntil: { lt: now } }, data: { status: "EXPIRED" } });
  const soon = await prisma.certification.findMany({ where: { status: "APPROVED", validUntil: { gt: now, lt: new Date(now.getTime() + 30 * 86400_000) } } });
  for (const c of soon) {
    const already = await prisma.notification.findFirst({ where: { merchantId: c.merchantId, kind: "farah.renew", createdAt: { gt: new Date(now.getTime() - 25 * 86400_000) } } });
    if (!already) await notifyMerchant(c.merchantId, { kind: "farah.renew", title: "Your Farah Approved certification expires soon", body: "Apply for your renewal assessment to keep the badge.", link: "/merchant/certification" });
  }
  return r.count;
}
