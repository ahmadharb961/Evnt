"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/i18n/client";

/* Shared "a page is loading" state, so the bottom menu can react to taps too.
   `clicked` = the path just tapped; `holds` = loading placeholders currently on screen. */
let clicked: string | null = null;
let holds = 0;
let snapshot: string | null = null;
const subs = new Set<() => void>();
const emit = () => {
  const next = clicked ?? (holds > 0 ? "…" : null);
  if (next === snapshot) return;
  snapshot = next;
  subs.forEach((f) => f());
};
const set = (v: string | null) => {
  clicked = v;
  emit();
};
const subscribe = (f: () => void) => (subs.add(f), () => subs.delete(f));
/** The path being opened right now ("…" while a placeholder is showing), or null. */
export const usePendingNav = () => useSyncExternalStore(subscribe, () => snapshot, () => null);

/** Put inside loading screens: keeps the loader visible until the real page replaces the placeholder. */
export function LoadingHold() {
  useEffect(() => {
    holds++;
    emit();
    return () => {
      holds = Math.max(0, holds - 1);
      emit();
    };
  }, []);
  return null;
}

/**
 * Clear loading signal on every tap: a bar along the top (below the iPhone notch) right away,
 * then a "Loading…" bubble if the page takes more than a moment.
 */
export function NavProgress() {
  const t = useT();
  const pathname = usePathname();
  const search = useSearchParams();
  const busy = usePendingNav();
  const [w, setW] = useState(0);
  const [bubble, setBubble] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const safety = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || /^(mailto|tel|sms|whatsapp):/.test(href)) return;
      let url: URL;
      try {
        url = new URL(href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      set(url.pathname);
    };
    // Forms that move to another page (search, filters) count too.
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      if (!e.defaultPrevented && (f.method || "get").toLowerCase() === "get") set(f.action || location.pathname);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  const on = busy != null;
  // Start while busy; finish when the real page is on screen.
  useEffect(() => {
    clearInterval(timer.current);
    clearTimeout(safety.current);
    if (!on) {
      setBubble(false);
      setW((x) => (x ? 100 : 0));
      const h = setTimeout(() => setW(0), 350);
      return () => clearTimeout(h);
    }
    setW(15);
    timer.current = setInterval(() => setW((x) => (x >= 92 ? x : x + (92 - x) * 0.1)), 150);
    const bt = setTimeout(() => setBubble(true), 200);
    safety.current = setTimeout(() => ((holds = 0), set(null)), 20_000); // never stick forever
    return () => {
      clearTimeout(bt);
      clearInterval(timer.current);
    };
  }, [on]);

  // New address: the tap is done; a loading placeholder (if any) keeps the loader up until the page arrives.
  useEffect(() => {
    set(null);
  }, [pathname, search]);

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 z-[100] h-1" style={{ top: "env(safe-area-inset-top)" }}>
        <div
          className="h-full rounded-e-full bg-ink"
          style={{ width: `${w}%`, opacity: w && w < 100 ? 1 : 0, transition: w === 0 ? "none" : "width 150ms ease-out, opacity 250ms ease 100ms" }}
        />
      </div>
      {on && bubble && (
        <div role="status" className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center" style={{ top: "calc(env(safe-area-inset-top) + 14px)" }}>
          <span className="inline-flex animate-rise-in items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lift">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {t("Loading…")}
          </span>
        </div>
      )}
    </>
  );
}
