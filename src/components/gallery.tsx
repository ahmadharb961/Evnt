"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useT } from "@/i18n/client";

export function Gallery({ images, video, title }: { images: string[]; video?: string | null; title: string }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  const imgs = images.filter(Boolean);
  if (!imgs.length) return null;
  const show = (i: number) => setOpen(((i % imgs.length) + imgs.length) % imgs.length);
  return (
    <>
      <div className="grid grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-4xl" style={{ aspectRatio: "16 / 7" }}>
        <button type="button" onClick={() => show(0)} className="col-span-4 row-span-2 sm:col-span-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgs[0]} alt={title} className="h-full w-full object-cover" fetchPriority="high" />
        </button>
        {imgs.slice(1, 5).map((src, i) => (
          <button key={src + i} type="button" onClick={() => show(i + 1)} className="relative hidden sm:block">
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
      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" role="dialog" aria-modal onClick={() => setOpen(null)}>
          <button className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white" aria-label={t("Close")}>
            <X className="h-5 w-5" />
          </button>
          <button className="absolute start-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white" onClick={(e) => (e.stopPropagation(), show(open - 1))} aria-label={t("Previous")}>
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgs[open]} alt="" className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          <button className="absolute end-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white" onClick={(e) => (e.stopPropagation(), show(open + 1))} aria-label={t("Next")}>
            <ChevronRight className="h-5 w-5 rtl:rotate-180" />
          </button>
        </div>
      )}
    </>
  );
}
