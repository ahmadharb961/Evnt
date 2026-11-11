"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { createReviewAction } from "@/actions/reviews";
import { FormMessage, SubmitButton } from "@/components/form";
import { useT } from "@/i18n/client";

export function ReviewForm({ target }: { target: { eventId?: string; restaurantId?: string; productId?: string } }) {
  const t = useT();
  const [state, action] = useActionState(createReviewAction, undefined);
  const [rating, setRating] = useState(0);
  const [open, setOpen] = useState(false);
  if (state?.ok)
    return <p className="rounded-2xl bg-mint-soft px-4 py-3 text-sm text-mint-deep">{state.verified ? t("Thanks! Your verified review is live.") : t("Thanks! Your review is live.")}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-outline">
        {t("Write a review")}
      </button>
    );
  return (
    <form action={action} className="card space-y-4 p-5">
      {target.eventId && <input type="hidden" name="eventId" value={target.eventId} />}
      {target.restaurantId && <input type="hidden" name="restaurantId" value={target.restaurantId} />}
      {target.productId && <input type="hidden" name="productId" value={target.productId} />}
      <input type="hidden" name="rating" value={rating} />
      <FormMessage state={state} />
      <div className="flex gap-1" role="radiogroup" aria-label={t("Rating")}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={rating === i} onClick={() => setRating(i)} className="p-1" aria-label={`${i}`}>
            <Star className={`h-7 w-7 ${i <= rating ? "fill-ink text-ink" : "text-ink/25"}`} />
          </button>
        ))}
      </div>
      <textarea name="body" rows={4} required minLength={10} maxLength={2000} className="input" placeholder={t("What did your kids love? Anything parents should know?")} />
      <p className="text-xs text-ink-muted">{t("Reviews are marked verified only when linked to a completed booking or order on EVNT.")}</p>
      <SubmitButton className="btn-primary">{t("Post review")}</SubmitButton>
    </form>
  );
}
