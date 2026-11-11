import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getSettings } from "@/server/settings";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { applyFarahAction } from "@/actions/farah";
import { CHECKLIST, PASS_SCORE } from "@/server/farah";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Farah Approved" };

export default async function MerchantCertification() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const s = await getSettings(["cert.assessmentCents", "cert.licenseCents", "cert.renewalCents", "cert.reevaluationCents"]);
  const certs = await prisma.certification.findMany({ where: { merchantId: ctx.merchant.id }, orderBy: { createdAt: "desc" } });
  const current = certs[0];
  const active = ctx.merchant.farahUntil && ctx.merchant.farahUntil > new Date();
  const inProgress = current && ["AWAITING_PAYMENT", "PAID", "SCHEDULED", "ASSESSED"].includes(current.status);
  const statusText: Record<string, string> = {
    AWAITING_PAYMENT: t("Waiting for the assessment fee to be paid"),
    PAID: t("Paid — we'll schedule your assessment"),
    SCHEDULED: t("Assessment scheduled"),
    ASSESSED: t("Assessment done — awaiting the decision"),
    APPROVED: t("Passed"),
    REJECTED: t("Not passed"),
    EXPIRED: t("Expired"),
    CANCELED: t("Cancelled"),
  };
  const fmt = (c: number) => formatMoney(c, locale);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t("Farah Approved")} subtitle={t("An independent certification that your venue is genuinely family-friendly.")} />
      {active && (
        <div className="flex items-center gap-3 rounded-3xl bg-mint p-5">
          <BadgeCheck className="h-8 w-8 text-mint-deep" />
          <div>
            <p className="font-bold">{t("You're Farah Approved")}</p>
            <p className="text-sm">{t("Badge visible until {date}", { date: fmtDate(ctx.merchant.farahUntil!, locale, { day: "numeric", month: "long", year: "numeric" }) })}</p>
          </div>
        </div>
      )}
      {current && (
        <Panel title={t("Your application")}>
          <p className="font-semibold">{statusText[current.status]}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {current.kind === "INITIAL" ? t("Initial assessment") : current.kind === "RENEWAL" ? t("Renewal assessment") : t("Re-evaluation")} · {fmt(current.feeCents)}
          </p>
          {current.scheduledAt && <p className="mt-1 text-sm">{t("Visit: {date}", { date: fmtDateTime(current.scheduledAt, locale) })}</p>}
          {current.score != null && ["APPROVED", "REJECTED"].includes(current.status) && (
            <p className="mt-2 text-sm">
              {t("Score: {n}% (pass mark {p}%)", { n: current.score, p: PASS_SCORE })}
            </p>
          )}
          {current.status === "APPROVED" && !active && <p className="mt-2 rounded-2xl bg-peach-soft p-3 text-sm text-peach-deep">{t("Pay your license invoice to show the badge.")}</p>}
          {current.decisionNote && <p className="mt-2 whitespace-pre-line rounded-2xl bg-canvas p-3 text-sm">{current.decisionNote}</p>}
          {current.findings && current.status !== "ASSESSED" && <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{current.findings}</p>}
          {current.invoiceId && current.status === "AWAITING_PAYMENT" && (
            <Link href={`/merchant/billing/${current.invoiceId}`} className="btn-primary btn-sm mt-3">
              {t("Pay the assessment invoice")}
            </Link>
          )}
        </Panel>
      )}
      {!inProgress && (
        <Panel title={current ? t("Apply again") : t("Apply")}>
          <ul className="mb-4 space-y-1 text-sm">
            <li>
              {t("Initial venue assessment")}: <b>{fmt(s["cert.assessmentCents"])}</b>
            </li>
            <li>
              {t("Annual certification license (only if you pass)")}: <b>{fmt(s["cert.licenseCents"])}</b>
            </li>
            <li>
              {t("Annual renewal assessment")}: <b>{fmt(s["cert.renewalCents"])}</b>
            </li>
            <li>
              {t("Re-evaluation after a failed assessment")}: <b>{fmt(s["cert.reevaluationCents"])}</b>
            </li>
          </ul>
          <ActionButton action={applyFarahAction} className="btn-primary" confirm={t("Apply now? An invoice for the assessment fee will be issued.")}>
            {t("Apply for an assessment")}
          </ActionButton>
          <p className="mt-3 text-xs text-ink-muted">{t("Paying the assessment fee does not guarantee certification. Sponsored content never influences results.")}</p>
        </Panel>
      )}
      <Panel title={t("What evaluators check")}>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {CHECKLIST.map((c) => (
            <li key={c.key} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint-deep" />
              {t(c.label)}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
