import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { Stars } from "@/components/reviews";
import { replyReviewAction, reportReviewAsMerchantAction } from "@/actions/merchant-growth";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Reviews" };

export default async function MerchantReviews() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const reviews = await prisma.review.findMany({ where: { merchantId: ctx.merchant.id, status: "PUBLISHED" }, include: { user: { select: { name: true } }, event: { select: { title: true } }, restaurant: { select: { name: true } }, product: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="max-w-3xl">
      <PageHeader title={t("Reviews")} subtitle={t("{avg} average from {n} reviews. Ratings can't be edited or bought — reply to show you care.", { avg: ctx.merchant.ratingAvg.toFixed(1), n: ctx.merchant.ratingCount })} />
      <Panel>
        {!reviews.length ? (
          <p className="text-sm text-ink-muted">{t("No reviews yet.")}</p>
        ) : (
          <ul className="space-y-5">
            {reviews.map((r) => (
              <li key={r.id} className="border-b border-ink/[.06] pb-5 last:border-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Stars value={r.rating} size="h-3.5 w-3.5" />
                  <span className="font-medium">{r.user.name.split(" ")[0]}</span>
                  {r.verified && <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[11px] font-semibold text-mint-deep">{t("Verified")}</span>}
                  <span className="text-xs text-ink-muted">
                    {loc(r.event?.title, locale) || r.restaurant?.name || loc(r.product?.title, locale)} · {fmtDate(r.createdAt, locale, { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-soft">{r.body}</p>
                {r.merchantReply ? (
                  <p className="mt-2 rounded-2xl bg-canvas p-3 text-sm">
                    <b>{t("Your reply")}:</b> {r.merchantReply}
                  </p>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <ActionButton action={replyReviewAction.bind(null, r.id)} prompt={t("Your public reply:")}>
                      {t("Reply")}
                    </ActionButton>
                    <ActionButton action={reportReviewAsMerchantAction.bind(null, r.id)} className="btn-ghost btn-sm" prompt={t("Why should EVNT review this? (e.g. fake, abusive)")}>
                      {t("Report")}
                    </ActionButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
