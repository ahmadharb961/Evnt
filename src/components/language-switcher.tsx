"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { setLocaleAction } from "@/actions/locale";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/core";
import { useLocale, useT } from "@/i18n/client";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function choose(l: Locale) {
    setOpen(false);
    if (l === locale) return;
    start(async () => {
      await setLocaleAction(l);
      // Drop a ?lang= from the address so the new choice applies.
      const q = new URLSearchParams(params.toString());
      q.delete("lang");
      const s = q.toString();
      router.replace(pathname + (s ? `?${s}` : ""));
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft hover:bg-ink/5"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("Language")}
        disabled={pending}
      >
        <Globe className="h-[18px] w-[18px]" />
        {!compact && <span className="uppercase">{locale}</span>}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} />
          <div role="menu" className="absolute end-0 z-50 mt-2 w-44 animate-fade-in overflow-hidden rounded-2xl border border-ink/10 bg-white p-1 shadow-lift">
            {LOCALES.map((l) => (
              <button
                key={l}
                role="menuitem"
                onClick={() => choose(l)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-sm hover:bg-ink/5"
              >
                <span lang={l}>{LOCALE_NAMES[l]}</span>
                {l === locale && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
