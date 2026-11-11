import { notFound } from "next/navigation";
import { requireAdmin, hasRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { scheduleFarahAction, submitAssessmentAction, decideFarahAction } from "@/actions/farah";
import { CHECKLIST, PASS_SCORE } from "@/server/farah";
import { formatMoney } from "@/lib/money";
import { fmtDateTime, ymdString } from "@/lib/dates";
import { areaName } from "@/lib/areas";

export const metadata = { title: "Assessment" };

export default async function FarahDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireAdmin("ADMIN", "EVALUATOR");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const c = await prisma.certification.findUnique({ where: { id }, include: { merchant: { include: { locations: true } } } });
  if (!c) notFound();
  const admin = hasRole(u, "ADMIN");
  if (!admin && c.evaluatorId !== u.id) notFound();
  const evaluators = admin ? await prisma.user.findMany({ where: { roles: { some: { role: { in: ["EVALUATOR", "SUPER_ADMIN"] } } } }, select: { id: true, name: true } }) : [];
  const results = (c.checklist ?? []) as { key: string; passed: boolean; note?: string }[];
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`${c.merchant.name} · ${c.kind}`} subtitle={`${c.status} · ${formatMoney(c.feeCents, locale)}`} />
      <Panel title={t("Venue")}>
        <ul className="text-sm">
          {c.merchant.locations.map((l) => (
            <li key={l.id}>
              {l.name}: {l.address}, {areaName(l.area, locale)}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm" dir="ltr">
          {c.merchant.phone ? `+${c.merchant.phone}` : ""}
        </p>
        {c.scheduledAt && <p className="mt-2 text-sm">{t("Visit: {date}", { date: fmtDateTime(c.scheduledAt, locale) })}</p>}
      </Panel>
      {c.status === "AWAITING_PAYMENT" && <p className="rounded-2xl bg-peach-soft p-4 text-sm text-peach-deep">{t("Waiting for the merchant to pay the assessment invoice. It can't be scheduled before that.")}</p>}
      {admin && ["PAID", "SCHEDULED"].includes(c.status) && (
        <Panel title={c.status === "SCHEDULED" ? t("Reschedule") : t("Schedule the assessment")}>
          <ActionForm action={scheduleFarahAction.bind(null, c.id)} submit={t("Save")}>
            <div className="grid gap-3 sm:grid-cols-3">
              <select name="evaluatorId" defaultValue={c.evaluatorId ?? ""} required className="input">
                <option value="">{t("Evaluator")}</option>
                {evaluators.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <input name="date" type="date" min={ymdString(new Date())} required className="input" />
              <input name="time" type="time" defaultValue="10:00" className="input" />
            </div>
          </ActionForm>
        </Panel>
      )}
      {c.status === "SCHEDULED" && (c.evaluatorId === u.id || hasRole(u, "SUPER_ADMIN")) && (
        <Panel title={t("Assessment checklist")}>
          <ActionForm action={submitAssessmentAction.bind(null, c.id)} submit={t("Submit assessment")}>
            {CHECKLIST.map((item) => (
              <div key={item.key} className="rounded-2xl border border-ink/[.06] p-3">
                <p className="text-xs text-ink-muted">{item.group}</p>
                <p className="text-sm font-medium">{item.label}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name={`c_${item.key}`} value="pass" className="accent-ink" /> {t("Pass")}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name={`c_${item.key}`} value="fail" className="accent-ink" /> {t("Fail")}
                  </label>
                  <input name={`n_${item.key}`} placeholder={t("Note")} className="input !w-auto flex-1 !py-1.5" />
                </div>
              </div>
            ))}
            <label className="block">
              <span className="label">{t("Findings & recommendations (shared with the venue)")}</span>
              <textarea name="findings" rows={4} className="input" />
            </label>
          </ActionForm>
        </Panel>
      )}
      {results.length > 0 && (
        <Panel title={t("Results: {n}% (pass mark {p}%)", { n: c.score ?? 0, p: PASS_SCORE })}>
          <ul className="space-y-1 text-sm">
            {results.map((r) => (
              <li key={r.key} className={r.passed ? "" : "text-red-600"}>
                {r.passed ? "✓" : "✗"} {CHECKLIST.find((x) => x.key === r.key)?.label} {r.note ? `— ${r.note}` : ""}
              </li>
            ))}
          </ul>
          {c.findings && <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{c.findings}</p>}
          {admin && c.status === "ASSESSED" && (
            <div className="mt-4 flex gap-2">
              <ActionButton action={decideFarahAction.bind(null, c.id, true)} className="btn-primary btn-sm" prompt={t("Decision note (optional):")}>
                {t("Approve certification")}
              </ActionButton>
              <ActionButton action={decideFarahAction.bind(null, c.id, false)} className="btn-outline btn-sm" prompt={t("Why it didn't pass (shared with the venue):")}>
                {t("Reject")}
              </ActionButton>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
