import { INTL_LOCALE, type Locale } from "@/i18n/core";

// Everything date-related is in Lebanon time, wherever the server runs.
export const TZ = "Asia/Beirut";

/** Offset (minutes) of Beirut time from UTC at a given instant. */
export function tzOffsetMinutes(at: Date, tz = TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(at);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? "0", 10));
}

/** Y-M-D of an instant in Beirut. */
export function beirutYmd(at: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { y: +get("year"), m: +get("month"), d: +get("day"), weekday: wd };
}

/** The UTC instant of a Beirut wall-clock time. */
export function beirutTime(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off = tzOffsetMinutes(guess);
  const first = new Date(guess.getTime() - off * 60_000);
  const off2 = tzOffsetMinutes(first);
  return off2 === off ? first : new Date(guess.getTime() - off2 * 60_000);
}

export function startOfBeirutDay(at: Date): Date {
  const { y, m, d } = beirutYmd(at);
  return beirutTime(y, m, d);
}

export function addDays(at: Date, n: number): Date {
  const { y, m, d } = beirutYmd(at);
  const base = new Date(Date.UTC(y, m - 1, d + n));
  return beirutTime(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

export type When = "today" | "tomorrow" | "weekend" | "week" | "month";

/** Time window for a quick date filter. "weekend" = the coming (or current) Saturday–Sunday. */
export function windowFor(when: When | string | undefined, now = new Date()): { from: Date; to: Date } | null {
  if (!when) return null;
  const today = startOfBeirutDay(now);
  if (when === "today") return { from: now, to: addDays(today, 1) };
  if (when === "tomorrow") return { from: addDays(today, 1), to: addDays(today, 2) };
  if (when === "week") return { from: now, to: addDays(today, 7) };
  if (when === "month") return { from: now, to: addDays(today, 31) };
  if (when === "weekend") {
    const wd = beirutYmd(now).weekday; // 0 Sun … 6 Sat
    if (wd === 0) return { from: now, to: addDays(today, 1) };
    if (wd === 6) return { from: now, to: addDays(today, 2) };
    const sat = addDays(today, 6 - wd);
    return { from: sat, to: addDays(sat, 2) };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
    const [y, m, d] = when.split("-").map(Number);
    const from = beirutTime(y, m, d);
    return { from: from < now ? now : from, to: addDays(from, 1) };
  }
  return null;
}

export function fmtDate(at: Date, locale: Locale | string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale as Locale] ?? "en-GB", { timeZone: TZ, ...opts }).format(at);
}

export function fmtTime(at: Date, locale: Locale | string) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale as Locale] ?? "en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(at);
}

export function fmtDateTime(at: Date, locale: Locale | string) {
  return `${fmtDate(at, locale)} · ${fmtTime(at, locale)}`;
}

/** "2026-11-14" in Beirut for <input type=date>. */
export function ymdString(at: Date) {
  const { y, m, d } = beirutYmd(at);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parses <input type=date> + <input type=time> as Beirut time. */
export function parseBeirutLocal(date: string, time: string): Date | null {
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) return null;
  return beirutTime(+dm[1], +dm[2], +dm[3], +tm[1], +tm[2]);
}
