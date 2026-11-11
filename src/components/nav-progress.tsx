"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/i18n/client";

/* Shared "a page is loading" state, so the bottom menu can react to taps too. */
let pending: string | null = null;
const subs = new Set<() => void>();
const set = (v: string | null) => {
  if (pending === v) return;
  pending = v;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => (subs.add(f), () => subs.delete(f));
/** The path being opened right now, or null. */
export const usePendingNav = () => useSyncExternalStore(subscribe, () => pending, () => null);

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

  // Start / animate.
  useEffect(() => {
    clearInterval(timer.current);
    clearTimeout(safety.current);
    if (!busy) return;
    setW(15);
    timer.current = setInterval(() => setW((x) => (x >= 92 ? x : x + (92 - x) * 0.1)), 150);
    const b = setTimeout(() => setBubble(true), 250);
    safety.current = setTimeout(() => set(null), 20_000); // never stick forever
    return () => {
      clearTimeout(b);
      clearInterval(timer.current);
    };
  }, [busy]);

  // New page arrived: finish.
  useEffect(() => {
    set(null);
    setBubble(false);
    setW((x) => (x ? 100 : 0));
    const h = setTimeout(() => setW(0), 350);
    return () => clearTimeout(h);
  }, [pathname, search]);

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 z-[100] h-1" style={{ top: "env(safe-area-inset-top)" }}>
        <div
          className="h-full rounded-e-full bg-ink"
          style={{ width: `${w}%`, opacity: w && w < 100 ? 1 : 0, transition: w === 0 ? "none" : "width 150ms ease-out, opacity 250ms ease 100ms" }}
        />
      </div>
      {busy && bubble && (
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
