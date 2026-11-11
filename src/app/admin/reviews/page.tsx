import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { Stars } from "@/components/reviews";
import { moderateReviewAction } from "@/actions/admin";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Reviews & moderation" };

export default async function ReviewsAdmin() {
  await requireAdmin("CONTENT", "ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const [reported, recent] = await Promise.all([
    prisma.review.findMany({ where: { reports: { some: { status: "OPEN" } } }, include: { reports: { where: { status: "OPEN" } }, user: { select: { name: true, email: true } }, merchant: { select: { name: true } } } }),
    prisma.review.findMany({ include: { user: { select: { name: true } }, merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t("Reviews & moderation")} subtitle={t("Verified badges are set automatically from completed bookings/orders and can't be edited. Hiding a review recalculates ratings.")} />
      <Panel title={t("Reported")}>
        {!reported.length ? (
          <p className="text-sm text-ink-muted">{t("No open reports.")}</p>
        ) : (
          <ul className="space-y-4">
            {reported.map((r) => (
              <li key={r.id} className="rounded-2xl border border-ink/[.06] p-4 text-sm">
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} size="h-3.5 w-3.5" /> {r.merchant.name} · {r.user.name} ({r.user.email}) {r.verified ? "· ✓" : ""}
                </div>
                <p className="mt-2">{r.body}</p>
                <ul className="mt-2 text-xs text-ink-muted">
                  {r.reports.map((x) => (
                    <li key={x.id}>⚑ {x.reason}</li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <ActionButton action={moderateReviewAction.bind(null, r.id, true)} className="btn-danger btn-sm">
                    {t("Hide review")}
                  </ActionButton>
                  <ActionButton action={moderateReviewAction.bind(null, r.id, false)} className="btn-outline btn-sm">
                    {t("Keep (dismiss reports)")}
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={t("Latest reviews")}>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {recent.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
              <span>
                <Stars value={r.rating} size="h-3 w-3" /> {r.merchant.name} · {r.user.name} {r.verified ? `· ${t("Verified")}` : ""}
                <span className="block text-ink-soft">{r.body.slice(0, 160)}</span>
                <span className="text-xs text-ink-muted">{fmtDate(r.createdAt, locale, { day: "numeric", month: "short" })}</span>
              </span>
              <ActionButton action={moderateReviewAction.bind(null, r.id, r.status !== "HIDDEN")} className="btn-ghost btn-sm">
                {r.status === "HIDDEN" ? t("Restore") : t("Hide")}
              </ActionButton>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
