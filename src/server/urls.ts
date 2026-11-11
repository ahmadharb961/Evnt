export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Absolute URL in a given language (English has no ?lang so it stays the canonical default). */
export function localizedUrl(path: string, locale: string): string {
  const base = appUrl() + path;
  if (locale === "en") return base;
  return base + (path.includes("?") ? "&" : "?") + "lang=" + locale;
}

/** hreflang alternates for a page path. */
export function alternates(path: string) {
  return {
    canonical: path,
    languages: {
      en: localizedUrl(path, "en"),
      ar: localizedUrl(path, "ar"),
      fr: localizedUrl(path, "fr"),
      "x-default": localizedUrl(path, "en"),
    },
  };
}
