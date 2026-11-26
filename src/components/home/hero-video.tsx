"use client";

import { useEffect, useRef, useState } from "react";
import { imgProps } from "@/lib/img";

/** Muted, looping background video with a poster fallback. Respects reduced-motion and data-saver. */
export function HeroVideo({ src, poster }: { src: string | null; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [play, setPlay] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    // Slow connection or data saver: keep the photo only.
    if (reduce || conn?.saveData || /(^|-)(2g|3g)$/.test(conn?.effectiveType ?? "")) return;
    // Phones get the lighter video (the built-in one has a phone version).
    const small = window.matchMedia("(max-width: 767px)").matches;
    const chosen = small && src === "/brand/hero.mp4" ? "/brand/hero-mobile.mp4" : src;
    // Start the video only after the page, its text and photos have loaded.
    const start = () => setTimeout(() => setPlay(chosen), 300);
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, [src]);
  useEffect(() => {
    if (play) ref.current?.play().catch(() => {});
  }, [play]);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...imgProps(poster, "100vw", [640, 828, 1200, 1920], 62)} alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
      {play && (
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full animate-fade-in object-cover"
          src={play}
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
