import { INTL_LOCALE, type Locale } from "@/i18n/core";

/** $12 or $12.50 — prices are stored in US cents. */
export function formatMoney(cents: number, locale: Locale | string = "en"): string {
  const whole = cents % 100 === 0;
  const l = INTL_LOCALE[locale as Locale] ?? "en-GB";
  // Western digits in Arabic too: Lebanese prices are written that way.
  const s = new Intl.NumberFormat(l.startsWith("ar") ? "en-GB" : l, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(cents) / 100);
  return `${cents < 0 ? "-" : ""}$${s}`;
}

/** Parses "12", "12.5", "$12.50" into cents; null when invalid. */
export function parseMoney(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/** cents × basis points, rounded half-up to the cent. */
export function applyBps(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}

export const pctToBps = (pct: number) => Math.round(pct * 100);
export const bpsToPct = (bps: number) => bps / 100;
