// Shared (server + browser) translation helpers.
// Interface texts are written in English in the code and looked up in the Arabic and French
// dictionaries (src/i18n/ar.ts, src/i18n/fr.ts); anything missing falls back to English.
// Content written by merchants/admins is stored as Localized JSON {en, ar, fr}.

export const LOCALES = ["en", "ar", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "evnt_lang";
export const LOCALE_HEADER = "x-evnt-locale";
export const isLocale = (v: unknown): v is Locale => v === "en" || v === "ar" || v === "fr";
export const dirOf = (l: Locale) => (l === "ar" ? "rtl" : "ltr");
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", fr: "Français" };
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", ar: "ar-LB", fr: "fr-FR" };

export type Vars = Record<string, string | number | null | undefined>;
export type Dict = Record<string, string>;
/** Translate an English text; `{name}` placeholders are filled from `vars`. */
export type T = (text: string, vars?: Vars) => string;

export function format(dict: Dict | null, text: string, vars?: Vars) {
  let s = (dict && dict[text]) || text;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
  return s;
}

/** Plural helper: t(plural(n, "{n} ticket", "{n} tickets"), { n }). */
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export type Localized = Partial<Record<Locale, string>>;

/** Reads a Localized JSON value in the visitor's language, falling back to English, then any language. */
export function loc(value: unknown, locale: Locale | string): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  const v = value as Localized;
  return (v[locale as Locale] || v.en || v.fr || v.ar || "").trim();
}

/** Builds a Localized value from form fields named `<prefix>_en`, `<prefix>_ar`, `<prefix>_fr`. */
export function localizedFromForm(fd: FormData, prefix: string): Localized {
  const out: Localized = {};
  for (const l of LOCALES) {
    const v = String(fd.get(`${prefix}_${l}`) ?? "").trim();
    if (v) out[l] = v;
  }
  return out;
}
