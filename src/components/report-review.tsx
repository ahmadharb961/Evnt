"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { reportReviewAction } from "@/actions/reviews";
import { useT } from "@/i18n/client";

export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p className="mt-2 text-xs text-ink-muted">{t("Thanks, our team will take a look.")}</p>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const reason = window.prompt(t("Why are you reporting this review?"));
        if (reason === null) return;
        start(async () => {
          await reportReviewAction(reviewId, reason);
          setDone(true);
        });
      }}
      className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
    >
      <Flag className="h-3 w-3" />
      {t("Report")}
    </button>
  );
}
