import { Star, BadgeCheck, MessageSquareReply } from "lucide-react";
import type { listReviews } from "@/server/reviews";
import type { Locale, T } from "@/i18n/core";
import { fmtDate } from "@/lib/dates";
import { ReviewForm } from "@/components/review-form";
import { ReportReviewButton } from "@/components/report-review";

export function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? "fill-ink text-ink" : "text-ink/20"}`} />
      ))}
    </span>
  );
}

export function ReviewsSection({
  data,
  t,
  locale,
  target,
  canReview,
}: {
  data: Awaited<ReturnType<typeof listReviews>>;
  t: T;
  locale: Locale;
  target: { eventId?: string; restaurantId?: string; productId?: string };
  canReview: boolean;
}) {
  return (
    <section>
      <h2 className="h-section">{t("Parent reviews")}</h2>
      {data.total > 0 ? (
        <div className="mt-4 grid gap-6 sm:grid-cols-[200px_1fr]">
          <div>
            <p className="text-4xl font-bold">{data.avg.toFixed(1)}</p>
            <Stars value={data.avg} />
            <p className="mt-1 text-sm text-ink-muted">{t(data.total === 1 ? "{n} review" : "{n} reviews", { n: data.total })}</p>
            <div className="mt-4 space-y-1.5">
              {data.breakdown.map((b) => (
                <div key={b.rating} className="flex items-center gap-2 text-xs">
                  <span className="w-3">{b.rating}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${data.total ? (b.count / data.total) * 100 : 0}%` }} />
                  </div>
                  <span className="w-5 text-end text-ink-muted">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
          <ul className="space-y-6">
            {data.items.map((r) => (
              <li key={r.id} className="border-b border-ink/[.06] pb-6 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.author}</span>
                  {r.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-[11px] font-semibold text-mint-deep">
                      <BadgeCheck className="h-3 w-3" />
                      {t("Verified booking")}
                    </span>
                  )}
                  <span className="text-xs text-ink-muted">{fmtDate(r.createdAt, locale, { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <div className="mt-1">
                  <Stars value={r.rating} size="h-3.5 w-3.5" />
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{r.body}</p>
                {r.photos.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {r.photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p} src={`/media/${p}`} alt="" className="h-20 w-20 rounded-xl object-cover" loading="lazy" />
                    ))}
                  </div>
                )}
                {r.reply && (
                  <div className="mt-3 rounded-2xl bg-canvas p-3 text-sm">
                    <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted">
                      <MessageSquareReply className="h-3.5 w-3.5" />
                      {t("Reply from the business")}
                    </p>
                    <p className="text-ink-soft">{r.reply}</p>
                  </div>
                )}
                <ReportReviewButton reviewId={r.id} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">{t("No reviews yet. Reviews come from parents who booked through EVNT.")}</p>
      )}
      {canReview && (
        <div className="mt-6">
          <ReviewForm target={target} />
        </div>
      )}
    </section>
  );
}
