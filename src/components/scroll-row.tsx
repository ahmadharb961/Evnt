"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/i18n/client";

/**
 * Horizontal card row: swipe on touch, arrow buttons and click-and-drag with a mouse.
 * Cards line up with the section title (scroll padding matches the side padding).
 */
export function ScrollRow({ children, className = "", compact = false }: { children: React.ReactNode; className?: string; compact?: boolean }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft); // RTL scrolls negative
    setEdges({ start: pos <= 2, end: pos >= max - 2 });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="group/row relative">
      <div
        ref={ref}
        onScroll={update}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !ref.current) return;
          drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const el = ref.current;
          if (!d || !el) return;
          const dx = e.clientX - d.x;
          if (!d.moved && Math.abs(dx) > 6) {
            d.moved = true;
            el.style.scrollSnapType = "none";
            el.style.cursor = "grabbing";
          }
          if (d.moved) el.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => {
          const el = ref.current;
          if (el) {
            el.style.scrollSnapType = "";
            el.style.cursor = "";
          }
          setTimeout(() => (drag.current = null), 0);
        }}
        onPointerLeave={() => {
          if (ref.current) {
            ref.current.style.scrollSnapType = "";
            ref.current.style.cursor = "";
          }
          drag.current = null;
        }}
        // A drag must not open the card that was under the mouse.
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        className={`${compact ? "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" : "scroll-row"} ${className}`}
      >
        {children}
      </div>
      {!edges.start && (
        <button
          type="button"
          onClick={() => page(-1)}
          aria-label={t("Previous")}
          className={`absolute z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lift ring-1 ring-ink/[.06] transition hover:scale-105 sm:flex ${compact ? "-start-2 top-1/2 h-8 w-8" : "-start-3 top-[38%] h-11 w-11"}`}
        >
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          onClick={() => page(1)}
          aria-label={t("Next")}
          className={`absolute z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lift ring-1 ring-ink/[.06] transition hover:scale-105 sm:flex ${compact ? "-end-2 top-1/2 h-8 w-8" : "-end-3 top-[38%] h-11 w-11"}`}
        >
          <ChevronRight className="h-5 w-5 rtl:rotate-180" />
        </button>
      )}
    </div>
  );
}
