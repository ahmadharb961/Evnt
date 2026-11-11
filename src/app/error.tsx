"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useT } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => console.error(error), [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">{offline ? t("You're offline") : t("Something went wrong")}</h1>
      <p className="mt-2 max-w-md text-ink-muted">{offline ? t("Check your connection and try again.") : t("Please try again. If it keeps happening, contact us and we'll sort it out.")}</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-primary">
          {t("Try again")}
        </button>
        <Link href="/" className="btn-outline">
          {t("Go home")}
        </Link>
      </div>
      {error.digest && <p className="mt-4 font-mono text-xs text-ink-muted">{error.digest}</p>}
    </div>
  );
}
