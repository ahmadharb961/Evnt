import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { AR } from "./ar";
import { FR } from "./fr";
import { format, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Dict, type Locale, type T } from "./core";
import { getOverrides } from "@/server/translations";

/** The visitor's language: ?lang= in the URL (SEO links), then their saved choice, then the phone's language. */
export const getLocale = cache(async (): Promise<Locale> => {
  const h = await headers();
  const fromUrl = h.get(LOCALE_HEADER);
  if (isLocale(fromUrl)) return fromUrl;
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(v)) return v;
  const accept = h.get("accept-language") ?? "";
  if (/^\s*ar\b/i.test(accept)) return "ar";
  if (/^\s*fr\b/i.test(accept)) return "fr";
  return "en";
});

const BASE: Record<Locale, Dict | null> = { en: null, ar: AR, fr: FR };

/** The dictionary for a language, including admin overrides. */
export async function dictFor(l: Locale): Promise<Dict | null> {
  const o = await getOverrides(l);
  const base = BASE[l];
  if (!Object.keys(o).length) return base;
  return { ...(base ?? {}), ...o };
}

export async function tFor(locale: string | null | undefined): Promise<T> {
  const l: Locale = isLocale(locale) ? locale : "en";
  const dict = await dictFor(l);
  return (text, vars) => format(dict, text, vars);
}

/** Translator for server components and actions: `const t = await getT()`. */
export async function getT(): Promise<T> {
  return tFor(await getLocale());
}
