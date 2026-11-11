"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { useT } from "@/i18n/client";

/** The one search box: activities, venues, restaurants, products, places and ages. */
export function SearchBox({ compact = false, autoFocus = false }: { compact?: boolean; autoFocus?: boolean }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const s = q.trim();
        router.push(s ? `/discover?q=${encodeURIComponent(s)}` : "/discover");
      }}
      className={`flex items-center gap-2 rounded-full border border-ink/10 bg-white ${compact ? "h-11 ps-4 pe-1.5" : "h-14 ps-5 pe-2 shadow-lift sm:h-16"}`}
    >
      <Search className={`${compact ? "h-4 w-4" : "h-5 w-5"} shrink-0 text-ink-muted`} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        enterKeyHint="search"
        aria-label={t("Search")}
        placeholder={t("What shall we do with the kids today?")}
        className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-muted ${compact ? "text-sm" : "text-[15px] sm:text-base"}`}
      />
      {!compact && (
        <button type="submit" className="btn-primary h-11 shrink-0 sm:h-12 sm:px-6">
          {t("Search")}
        </button>
      )}
    </form>
  );
}
