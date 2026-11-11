"use client";

import { useEffect, useRef, useState } from "react";

/** Muted, looping background video with a poster fallback. Respects reduced-motion and data-saver. */
export function HeroVideo({ src, poster }: { src: string | null; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!src) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!reduce && !saveData) setPlay(true);
  }, [src]);
  useEffect(() => {
    if (play) ref.current?.play().catch(() => {});
  }, [play]);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
      {src && play && (
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full animate-fade-in object-cover"
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden
        />
      )}
    </>
  );
}
