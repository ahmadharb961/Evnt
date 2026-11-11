"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useT } from "@/i18n/client";

export function ShareButton({ title }: { title: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href.split("?")[0];
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {}
          return;
        }
        await navigator.clipboard?.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="btn-outline h-11 w-11 !px-0"
      aria-label={t("Share")}
    >
      {copied ? <Check className="h-[18px] w-[18px]" /> : <Share2 className="h-[18px] w-[18px]" />}
    </button>
  );
}
