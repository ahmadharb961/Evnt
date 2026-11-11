"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useT } from "@/i18n/client";

export function CopyText({ text }: { text: string }) {
  const t = useT();
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-canvas px-3 py-2.5 text-start text-xs"
      aria-label={t("Copy")}
    >
      <span className="min-w-0 flex-1 truncate font-mono" dir="ltr">
        {text}
      </span>
      {ok ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
    </button>
  );
}
