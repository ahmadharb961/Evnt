// Serves photos at the size they're shown, in a lighter format (resized by Next's image service and cached).
// Card photos get ~400–1080 px instead of the 1600–2560 px originals.

const WIDTHS = [256, 384, 640, 828, 1080, 1200, 1920] as const;

const optimizable = (src?: string | null): src is string => !!src && src.startsWith("/") && !src.startsWith("/_next/") && !src.endsWith(".svg");

/** URL of a photo resized to (at least) `w` pixels wide. Falls back to the original for SVGs and external links. */
export function imgUrl(src: string | null | undefined, w: number, q = 72): string {
  if (!optimizable(src)) return src ?? "";
  const width = WIDTHS.find((x) => x >= w) ?? 1920;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${q}`;
}

/** src + srcSet + sizes for an <img>: the browser picks the smallest file that looks sharp on this screen. */
export function imgProps(src: string | null | undefined, sizes: string, widths: number[] = [384, 640, 828, 1080], q = 72) {
  if (!optimizable(src)) return { src: src ?? "" };
  return { src: imgUrl(src, widths[Math.min(1, widths.length - 1)], q), srcSet: widths.map((w) => `${imgUrl(src, w, q)} ${w}w`).join(", "), sizes };
}
