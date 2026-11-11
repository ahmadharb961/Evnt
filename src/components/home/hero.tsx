import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SearchBox } from "@/components/site/search-box";
import { HeroVideo } from "@/components/home/hero-video";

export function Hero({ videoSrc, poster, headline, subline, ctaText, ctaHref }: { videoSrc: string | null; poster: string; headline: string; subline: string; ctaText: string; ctaHref: string }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <HeroVideo src={videoSrc} poster={poster} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/20 to-black/55" />
      </div>
      <div className="container-x flex min-h-[60svh] flex-col justify-end pb-8 pt-16 sm:min-h-[640px] sm:justify-center sm:pb-16">
        <div className="max-w-2xl animate-rise-in">
          <h1 className="text-[2.4rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">{headline}</h1>
          <p className="mt-4 max-w-xl text-base text-white/90 sm:text-lg">{subline}</p>
        </div>
        <div className="mt-7 max-w-2xl animate-rise-in [animation-delay:120ms]">
          <SearchBox />
        </div>
        {ctaText && (
          <div className="mt-5 animate-rise-in [animation-delay:200ms]">
            <Link href={ctaHref} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/25">
              {ctaText}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
