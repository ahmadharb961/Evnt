"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin bar at the very top that starts the moment a link is tapped and finishes when the new page shows,
 * so visitors always know their tap worked.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [w, setW] = useState(0); // 0 = hidden
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      clearInterval(timer.current);
      setW(12);
      // Creeps towards 90% while the page loads; the last bit happens when it arrives.
      timer.current = setInterval(() => setW((x) => (x >= 90 ? x : x + (90 - x) * 0.12)), 200);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    clearInterval(timer.current);
    setW((x) => (x ? 100 : 0));
    const t = setTimeout(() => setW(0), 300);
    return () => clearTimeout(t);
  }, [pathname, search]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div
        className="h-full rounded-e-full bg-gradient-to-r from-peach-deep via-blush-deep to-powder-deep shadow-[0_0_8px_rgba(0,0,0,.15)]"
        style={{ width: `${w}%`, opacity: w && w < 100 ? 1 : 0, transition: w === 0 ? "none" : "width 200ms ease-out, opacity 300ms ease 150ms" }}
      />
    </div>
  );
}
