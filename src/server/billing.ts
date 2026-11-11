import "server-only";
import type { BillingInterval, InvoiceLineKind, PlanCode } from "@prisma/client";
import { prisma, type Tx } from "./db";
import { UserError } from "./auth";
import { getSetting } from "./settings";
import { notifyMerchant } from "./notify";

// Merchant billing: invoices for subscriptions, commissions, ads, leads, certifications and reports.
// An invoice is paid by Whish (verified) or recorded by an admin as a verified offline settlement.

export async function nextInvoiceNumber(tx: Tx) {
  const year = new Date().getFullYear();
  const count = await tx.invoice.count({ where: { number: { startsWith: `INV-${year}-` } } });
  return `INV-${year}-${String(count + 1).padStart(5, "0")}`;
}

export async function createInvoice(
  merchantId: string,
  lines: { kind: InvoiceLineKind; description: string; amountCents: number; refType?: string; refId?: string }[],
  tx?: Tx,
) {
  const run = async (t: Tx) => {
    const due = await getSetting("billing.invoiceDueDays");
    const total = lines.reduce((a, l) => a + l.amountCents, 0);
    return t.invoice.create({
      data: { number: await nextInvoiceNumber(t), merchantId, totalCents: total, dueAt: new Date(Date.now() + due * 86400_000), lines: { create: lines } },
      include: { lines: true },
    });
  };
  const inv = tx ? await run(tx) : await prisma.$transaction(run);
  if (!tx) await notifyMerchant(merchantId, { kind: "invoice.new", title: "New invoice {number}", body: "A new invoice is available in your billing page.", vars: { number: inv.number }, link: `/merchant/billing/${inv.id}` });
  return inv;
}

const addPeriod = (from: Date, interval: BillingInterval) => {
  const d = new Date(from);
  if (interval === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
};

export async function activeSubscription(merchantId: string, tx?: Tx) {
  return (tx ?? prisma).merchantSubscription.findFirst({
    where: { merchantId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE"] } },
    orderBy: { createdAt: "desc" },
  });
}

/** Can this merchant still get the free promotional trial? (first N qualified merchants, admin-controlled) */
export async function trialAvailable(merchantId: string) {
  if (!(await getSetting("trial.enabled"))) return false;
  const used = await prisma.merchantSubscription.count({ where: { trialEndsAt: { not: null } } });
  if (used >= (await getSetting("trial.maxMerchants"))) return false;
  const mine = await prisma.merchantSubscription.count({ where: { merchantId, trialEndsAt: { not: null } } });
  return mine === 0;
}

/**
 * Changes a merchant's plan.
 * - BASIC: free, immediate (a downgrade from a paid plan takes effect at the end of the paid period).
 * - PRO/FEATURED: starts the promotional trial when eligible; otherwise an invoice is issued and the plan
 *   becomes active once it's paid. Feature access follows Merchant.plan, updated on activation.
 */
export async function changePlan(merchantId: string, plan: PlanCode, interval: BillingInterval, opts: { useTrial?: boolean; actorId?: string; immediate?: boolean } = {}) {
  const p = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: plan } });
  const current = await activeSubscription(merchantId);
  const now = new Date();
  if (current && current.plan === plan && current.interval === interval && ["ACTIVE", "TRIALING"].includes(current.status) && !current.cancelAtPeriodEnd)
    throw new UserError("You're already on this plan");

  if (plan === "BASIC") {
    if (!opts.immediate && current && current.plan !== "BASIC" && current.status === "ACTIVE" && current.currentPeriodEnd > now) {
      await prisma.merchantSubscription.update({ where: { id: current.id }, data: { cancelAtPeriodEnd: true } });
      return { scheduled: true as const, until: current.currentPeriodEnd };
    }
    await prisma.$transaction(async (tx) => {
      await tx.merchantSubscription.updateMany({ where: { merchantId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE", "PENDING_PAYMENT"] } }, data: { status: "CANCELED", endedAt: now } });
      await tx.merchantSubscription.create({ data: { merchantId, plan: "BASIC", interval: "MONTHLY", status: "ACTIVE", priceCents: 0, currentPeriodStart: now, currentPeriodEnd: addPeriod(now, "YEARLY") } });
      await tx.merchant.update({ where: { id: merchantId }, data: { plan: "BASIC" } });
      await tx.auditLog.create({ data: { actorId: opts.actorId, action: "subscription.basic", entityType: "merchant", entityId: merchantId } });
    });
    return { active: true as const };
  }

  const price = interval === "YEARLY" ? p.yearlyCents : p.monthlyCents;
  if (opts.useTrial && (await trialAvailable(merchantId))) {
    const days = await getSetting("trial.days");
    const end = new Date(now.getTime() + days * 86400_000);
    await prisma.$transaction(async (tx) => {
      await tx.merchantSubscription.updateMany({ where: { merchantId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE", "PENDING_PAYMENT"] } }, data: { status: "CANCELED", endedAt: now } });
      await tx.merchantSubscription.create({ data: { merchantId, plan, interval, status: "TRIALING", priceCents: price, currentPeriodStart: now, currentPeriodEnd: end, trialEndsAt: end } });
      await tx.merchant.update({ where: { id: merchantId }, data: { plan } });
      await tx.auditLog.create({ data: { actorId: opts.actorId, action: "subscription.trial", entityType: "merchant", entityId: merchantId, data: { plan, days } } });
    });
    return { trial: true as const, until: end };
  }

  // Paid upgrade: issue an invoice; activation happens when it's paid. Current features stay until then.
  const pendings = await prisma.merchantSubscription.findMany({ where: { merchantId, status: "PENDING_PAYMENT" } });
  for (const pending of pendings) {
    await prisma.merchantSubscription.update({ where: { id: pending.id }, data: { status: "CANCELED", endedAt: now } });
    await prisma.invoice.updateMany({ where: { merchantId, status: { in: ["OPEN", "OVERDUE"] }, lines: { some: { refType: "subscription", refId: pending.id } } }, data: { status: "VOID" } });
  }
  const sub = await prisma.merchantSubscription.create({ data: { merchantId, plan, interval, status: "PENDING_PAYMENT", priceCents: price, currentPeriodStart: now, currentPeriodEnd: addPeriod(now, interval) } });
  const inv = await createInvoice(merchantId, [
    { kind: "SUBSCRIPTION", description: `EVNT ${p.name} plan (${interval === "YEARLY" ? "yearly" : "monthly"})`, amountCents: price, refType: "subscription", refId: sub.id },
  ]);
  return { invoiceId: inv.id };
}

async function activateSubscription(tx: Tx, subId: string) {
  const sub = await tx.merchantSubscription.findUnique({ where: { id: subId } });
  if (!sub || sub.status !== "PENDING_PAYMENT") return;
  const now = new Date();
  const others = await tx.merchantSubscription.findMany({ where: { merchantId: sub.merchantId, id: { not: sub.id }, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE"] } } });
  // A renewal of the same plan extends from the current end; anything else starts now.
  const renewalOf = others.find((o) => o.plan === sub.plan && o.interval === sub.interval && o.status !== "TRIALING");
  const start = renewalOf && renewalOf.currentPeriodEnd > now ? renewalOf.currentPeriodEnd : now;
  for (const o of others) await tx.merchantSubscription.update({ where: { id: o.id }, data: { status: "CANCELED", endedAt: now } });
  await tx.merchantSubscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", currentPeriodStart: start, currentPeriodEnd: addPeriod(start, sub.interval), graceEndsAt: null } });
  await tx.merchant.update({ where: { id: sub.merchantId }, data: { plan: sub.plan } });
  await tx.auditLog.create({ data: { action: "subscription.activated", entityType: "merchant", entityId: sub.merchantId, data: { plan: sub.plan, interval: sub.interval } } });
}

/** Marks an invoice paid and applies what it pays for (subscription, ad campaign, certification…). */
export async function markInvoicePaid(invoiceId: string, opts: { paymentId?: string; recordedById?: string; reference?: string } = {}) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true } });
  if (!inv) throw new UserError("Invoice not found");
  if (inv.status === "PAID") return inv;
  if (inv.status === "VOID") throw new UserError("This invoice was voided");
  await prisma.$transaction(async (tx) => {
    const flipped = await tx.invoice.updateMany({ where: { id: inv.id, status: { in: ["OPEN", "OVERDUE"] } }, data: { status: "PAID", paidAt: new Date() } });
    if (!flipped.count) return;
    if (!opts.paymentId) {
      await tx.payment.create({
        data: { purpose: "INVOICE", method: "OFFLINE", status: "SUCCEEDED", amountCents: inv.totalCents, idempotencyKey: `invoice-offline:${inv.id}`, merchantId: inv.merchantId, invoiceId: inv.id, recordedById: opts.recordedById, confirmedAt: new Date(), failureReason: opts.reference ? `Ref: ${opts.reference.slice(0, 180)}` : null },
      });
    }
    for (const l of inv.lines) {
      if (l.refType === "subscription" && l.refId) await activateSubscription(tx, l.refId);
      if (l.refType === "campaign" && l.refId) await tx.adCampaign.updateMany({ where: { id: l.refId, status: "PENDING_PAYMENT" }, data: { status: "PENDING_APPROVAL" } });
      if (l.refType === "certification" && l.refId) await tx.certification.updateMany({ where: { id: l.refId, status: "AWAITING_PAYMENT" }, data: { status: "PAID" } });
      if (l.refType === "farah-license" && l.refId) {
        const c = await tx.certification.findUnique({ where: { id: l.refId } });
        if (c?.status === "APPROVED" && c.validUntil) await tx.merchant.update({ where: { id: c.merchantId }, data: { farahUntil: c.validUntil } });
      }
      if (l.refType === "commissions") {
        await tx.commission.updateMany({ where: { invoiceId: inv.id }, data: { status: "SETTLED" } });
        await tx.settlement.updateMany({ where: { reference: inv.number, status: "DRAFT" }, data: { status: "PAID", paidAt: new Date() } });
      }
    }
    // Paying clears a service restriction when nothing else is seriously overdue.
    const stillOverdue = await tx.invoice.count({ where: { merchantId: inv.merchantId, status: "OVERDUE" } });
    if (!stillOverdue) await tx.merchant.update({ where: { id: inv.merchantId }, data: { restrictedAt: null } });
    await tx.auditLog.create({ data: { actorId: opts.recordedById, action: "invoice.paid", entityType: "invoice", entityId: inv.id, data: { paymentId: opts.paymentId, reference: opts.reference } } });
  });
  await notifyMerchant(inv.merchantId, { kind: "invoice.paid", title: "Invoice {number} paid", body: "Thank you, your payment was received.", vars: { number: inv.number }, link: `/merchant/billing/${inv.id}`, email: false });
  return inv;
}

export async function applyInvoicePayment(paymentId: string, outcome: "success" | "failed") {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p?.invoiceId) return;
  if (outcome === "failed") {
    await prisma.payment.updateMany({ where: { id: p.id, status: { in: ["INITIATED", "PENDING"] } }, data: { status: "FAILED" } });
    return;
  }
  const marked = await prisma.payment.updateMany({ where: { id: p.id, status: { in: ["INITIATED", "PENDING", "FAILED"] } }, data: { status: "SUCCEEDED", confirmedAt: new Date() } });
  if (marked.count) await markInvoicePaid(p.invoiceId, { paymentId: p.id });
}

/**
 * Daily billing run (cron): renewal invoices, grace periods, return to Basic when unpaid,
 * overdue invoices, service restrictions, scheduled downgrades.
 */
export async function runBilling(now = new Date()) {
  const grace = await getSetting("billing.graceDays");
  const restrictAfter = await getSetting("billing.restrictAfterDaysOverdue");
  const log: string[] = [];

  // 1. Renewal invoices 5 days before a paid period (or trial) ends.
  const soon = new Date(now.getTime() + 5 * 86400_000);
  const renewing = await prisma.merchantSubscription.findMany({ where: { status: { in: ["ACTIVE", "TRIALING"] }, plan: { not: "BASIC" }, cancelAtPeriodEnd: false, adminOverride: false, currentPeriodEnd: { lte: soon } } });
  for (const s of renewing) {
    const already = await prisma.merchantSubscription.findFirst({ where: { merchantId: s.merchantId, status: "PENDING_PAYMENT", plan: s.plan } });
    if (already) continue;
    const next = await prisma.merchantSubscription.create({ data: { merchantId: s.merchantId, plan: s.plan, interval: s.interval, status: "PENDING_PAYMENT", priceCents: s.priceCents, currentPeriodStart: s.currentPeriodEnd, currentPeriodEnd: addPeriod(s.currentPeriodEnd, s.interval) } });
    const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: s.plan } });
    await createInvoice(s.merchantId, [{ kind: "SUBSCRIPTION", description: `EVNT ${plan.name} plan renewal`, amountCents: s.priceCents, refType: "subscription", refId: next.id }]);
    await notifyMerchant(s.merchantId, { kind: "subscription.renewal", title: "Your EVNT plan renews soon", body: "Your renewal invoice is ready. Pay it before your plan ends to keep your features.", link: "/merchant/subscription" });
    log.push(`renewal invoice ${s.merchantId}`);
  }

  // 2. Periods that ended without payment → grace → Basic.
  const ended = await prisma.merchantSubscription.findMany({ where: { status: { in: ["ACTIVE", "TRIALING"] }, plan: { not: "BASIC" }, adminOverride: false, currentPeriodEnd: { lt: now } } });
  for (const s of ended) {
    if (s.cancelAtPeriodEnd) {
      await changePlan(s.merchantId, "BASIC", "MONTHLY", { immediate: true }).catch(() => {});
      log.push(`downgraded ${s.merchantId}`);
      continue;
    }
    await prisma.merchantSubscription.update({ where: { id: s.id }, data: { status: "GRACE", graceEndsAt: new Date(now.getTime() + grace * 86400_000) } });
    await notifyMerchant(s.merchantId, { kind: "subscription.past_due", title: "Payment needed for your EVNT plan", body: "Your plan period ended. Pay your invoice within the grace period to keep your features.", link: "/merchant/billing" });
    log.push(`grace ${s.merchantId}`);
  }
  const graceOver = await prisma.merchantSubscription.findMany({ where: { status: "GRACE", graceEndsAt: { lt: now } } });
  for (const s of graceOver) {
    await changePlan(s.merchantId, "BASIC", "MONTHLY", { immediate: true }).catch(() => {});
    log.push(`expired → basic ${s.merchantId}`);
  }

  // 3. Overdue invoices and restrictions.
  const overdue = await prisma.invoice.findMany({ where: { status: "OPEN", dueAt: { lt: now } } });
  for (const i of overdue) {
    await prisma.invoice.update({ where: { id: i.id }, data: { status: "OVERDUE", remindedAt: now } });
    await notifyMerchant(i.merchantId, { kind: "invoice.overdue", title: "Invoice {number} is overdue", body: "Please pay your overdue invoice to avoid service restrictions.", vars: { number: i.number }, link: `/merchant/billing/${i.id}` });
  }
  if (restrictAfter > 0) {
    const serious = await prisma.invoice.findMany({ where: { status: "OVERDUE", dueAt: { lt: new Date(now.getTime() - restrictAfter * 86400_000) } }, select: { merchantId: true } });
    for (const m of new Set(serious.map((s) => s.merchantId))) await prisma.merchant.updateMany({ where: { id: m, restrictedAt: null }, data: { restrictedAt: now } });
  }
  return log;
}

/**
 * Commission invoice: what the merchant owes EVNT for money EVNT didn't collect (pay at venue,
 * cash on delivery, restaurant guests), net of what EVNT owes them from online payments.
 */
export async function invoiceCommissions(merchantId: string, actorId?: string) {
  const ledger = await prisma.ledgerEntry.aggregate({ where: { merchantId, settlementId: null }, _sum: { amountCents: true } });
  const balance = ledger._sum.amountCents ?? 0;
  if (balance >= 0) throw new UserError("Nothing to invoice: this merchant doesn't owe EVNT anything right now");
  const owed = await prisma.commission.findMany({ where: { merchantId, status: "EARNED", invoiceId: null, amountCents: { gt: 0 } } });
  const inv = await prisma.$transaction(async (tx) => {
    const i = await createInvoice(merchantId, [{ kind: "COMMISSION", description: `EVNT commissions (${owed.length} transactions)`, amountCents: -balance, refType: "commissions" }], tx);
    await tx.commission.updateMany({ where: { id: { in: owed.map((c) => c.id) } }, data: { status: "INVOICED", invoiceId: i.id } });
    const s = await tx.settlement.create({ data: { number: `SET-${i.number}`, merchantId, periodEnd: new Date(), amountCents: balance, status: "DRAFT", reference: i.number, createdById: actorId } });
    await tx.ledgerEntry.updateMany({ where: { merchantId, settlementId: null }, data: { settlementId: s.id } });
    await tx.auditLog.create({ data: { actorId, action: "commissions.invoiced", entityType: "merchant", entityId: merchantId, data: { invoice: i.number, amount: -balance } } });
    return i;
  });
  await notifyMerchant(merchantId, { kind: "invoice.new", title: "New invoice {number}", body: "Your EVNT commission invoice is ready.", vars: { number: inv.number }, link: `/merchant/billing/${inv.id}` });
  return inv;
}

/** Payout: EVNT pays the merchant their positive balance (online sales minus commissions and refunds). */
export async function createPayout(merchantId: string, actorId: string, reference: string) {
  const ledger = await prisma.ledgerEntry.aggregate({ where: { merchantId, settlementId: null }, _sum: { amountCents: true } });
  const balance = ledger._sum.amountCents ?? 0;
  if (balance <= 0) throw new UserError("This merchant has no positive balance to pay out");
  return prisma.$transaction(async (tx) => {
    const count = await tx.settlement.count();
    const s = await tx.settlement.create({ data: { number: `PAY-${String(count + 1).padStart(5, "0")}`, merchantId, periodEnd: new Date(), amountCents: balance, status: "PAID", reference: reference.slice(0, 120), paidAt: new Date(), createdById: actorId } });
    await tx.ledgerEntry.updateMany({ where: { merchantId, settlementId: null }, data: { settlementId: s.id } });
    await tx.ledgerEntry.create({ data: { merchantId, type: "PAYOUT", amountCents: -balance, memo: `Payout ${s.number}`, settlementId: s.id, createdById: actorId } });
    await tx.commission.updateMany({ where: { merchantId, status: "EARNED" }, data: { status: "SETTLED" } });
    await tx.auditLog.create({ data: { actorId, action: "settlement.payout", entityType: "merchant", entityId: merchantId, data: { amount: balance, reference } } });
    return s;
  });
}
