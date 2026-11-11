import "server-only";
import { prisma } from "./db";
import type { Localized } from "@/i18n/core";

// Every commercial number lives here (or in SubscriptionPlan / CommissionRate / AdPlacement)
// and is editable by super admin from /admin/settings without a deployment.

export type Hero = {
  videoUrl: string;
  videoId?: string | null;
  posterUrl: string;
  headline: Localized;
  subline: Localized;
  ctaText: Localized;
  ctaHref: string;
};

export const DEFAULTS = {
  "booking.holdMinutes": 10,
  "booking.feeCents": 100, // EVNT convenience fee per paid booking (waived for EVNT+)
  "attribution.externalSharePct": 50,
  "attribution.externalWindowHours": 72,
  "membership.monthlyCents": 999,
  "membership.yearlyCents": 8900,
  "membership.earlyAccessHours": 48,
  "loyalty.pointsPerDollar": 1,
  "loyalty.memberMultiplier": 2,
  "leads.priceCents": 2000,
  "leads.minCents": 1500,
  "leads.maxCents": 2500,
  "cert.assessmentCents": 25000,
  "cert.licenseCents": 39900,
  "cert.renewalCents": 15000,
  "cert.reevaluationCents": 10000,
  "cert.validMonths": 12,
  "trial.enabled": true,
  "trial.days": 60,
  "trial.maxMerchants": 50,
  "billing.graceDays": 7,
  "billing.invoiceDueDays": 14,
  "billing.restrictAfterDaysOverdue": 30,
  "orders.autoCancelUnpaidHours": 24,
  "whish.enabled": false,
  "support.whatsapp": "",
  "support.email": "hello@evnt.co",
  hero: {
    videoUrl: "",
    videoId: null,
    posterUrl: "/brand/hero-poster.svg",
    headline: { en: "Little moments. Big memories.", ar: "لحظات صغيرة. ذكريات كبيرة.", fr: "Petits moments. Grands souvenirs." },
    subline: {
      en: "Discover the best things to do, places to visit, and experiences to enjoy with your kids.",
      ar: "اكتشفوا أجمل النشاطات والأماكن والتجارب لتستمتعوا بها مع أطفالكم.",
      fr: "Découvrez les meilleures activités, sorties et expériences à vivre avec vos enfants.",
    },
    ctaText: { en: "Explore this weekend", ar: "اكتشفوا نهاية هذا الأسبوع", fr: "Explorer ce week-end" },
    ctaHref: "/discover?when=weekend",
  } as Hero,
} as const;

export type SettingKey = keyof typeof DEFAULTS;
type Widen<T> = T extends number ? number : T extends boolean ? boolean : T extends string ? string : T;
export type SettingValue<K extends SettingKey> = Widen<(typeof DEFAULTS)[K]>;

let cache: { at: number; values: Record<string, unknown> } | null = null;

async function load() {
  if (cache && Date.now() - cache.at < 30_000) return cache.values;
  const rows = await prisma.setting.findMany();
  const values: Record<string, unknown> = {};
  for (const r of rows) values[r.key] = r.value;
  cache = { at: Date.now(), values };
  return values;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const values = await load();
  const v = values[key];
  if (v === undefined || v === null) return DEFAULTS[key] as SettingValue<K>;
  if (key === "hero") return { ...(DEFAULTS.hero as Hero), ...(v as object) } as SettingValue<K>;
  return v as SettingValue<K>;
}

export async function getSettings<K extends SettingKey>(keys: K[]): Promise<{ [P in K]: SettingValue<P> }> {
  const out = {} as { [P in K]: SettingValue<P> };
  for (const k of keys) out[k] = await getSetting(k);
  return out;
}

export async function setSetting(key: SettingKey, value: unknown, by?: string) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as object, updatedBy: by },
    update: { value: value as object, updatedBy: by },
  });
  cache = null;
}

export function clearSettingsCache() {
  cache = null;
}
