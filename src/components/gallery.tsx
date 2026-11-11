"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useT } from "@/i18n/client";

export function Gallery({ images, video, title, variant = "wide" }: { images: string[]; video?: string | null; title: string; variant?: "wide" | "product" }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  const imgs = images.filter(Boolean);
  if (!imgs.length) return null;
  const show = (i: number) => setOpen(((i % imgs.length) + imgs.length) % imgs.length);
  const [active, setActive] = useState(0);
  const viewer = open !== null && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" role="dialog" aria-modal onClick={() => setOpen(null)}>
      <button className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white" aria-label={t("Close")}>
        <X className="h-5 w-5" />
      </button>
      <button className="absolute start-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white" onClick={(e) => (e.stopPropagation(), show(open - 1))} aria-label={t("Previous")}>
        <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgs[open]} alt="" className="max-h-[85vh] max-w-[92vw] rounded-2xl bg-white object-contain" onClick={(e) => e.stopPropagation()} />
      <button className="absolute end-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white" onClick={(e) => (e.stopPropagation(), show(open + 1))} aria-label={t("Next")}>
        <ChevronRight className="h-5 w-5 rtl:rotate-180" />
      </button>
    </div>
  );
  if (variant === "product")
    return (
      <>
        {/* Shop products: a large square photo on white (the whole product visible), thumbnails below. */}
        <button type="button" onClick={() => show(active)} className="block aspect-square w-full overflow-hidden rounded-4xl border border-ink/[.06] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgs[active]} alt={title} className="h-full w-full object-contain p-4 sm:p-6" fetchPriority="high" />
        </button>
        {imgs.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {imgs.map((src, i) => (
              <button key={src + i} type="button" onClick={() => setActive(i)} aria-label={t("{n} photos", { n: i + 1 })} className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-white ${i === active ? "border-ink" : "border-transparent"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
        {viewer}
      </>
    );
  return (
    <>
      <div className="grid aspect-[4/3] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-4xl sm:aspect-[16/7]">
        <button type="button" onClick={() => show(0)} className={`col-span-4 row-span-2 h-full w-full ${imgs.length > 1 ? "sm:col-span-2" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgs[0]} alt={title} className="h-full w-full object-cover" fetchPriority="high" />
        </button>
        {imgs.slice(1, 5).map((src, i) => (
          <button key={src + i} type="button" onClick={() => show(i + 1)} className="relative hidden h-full w-full sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {imgs.length > 1 && (
        <button type="button" onClick={() => show(0)} className="relative -mt-14 ms-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-card">
          <Images className="h-3.5 w-3.5" />
          {t("{n} photos", { n: imgs.length })}
        </button>
      )}
      {video && (
        <video src={video} controls playsInline preload="none" className="mt-4 w-full rounded-3xl" poster={imgs[0]} />
      )}
      {viewer}
    </>
  );
}
