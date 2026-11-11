import type { Locale } from "@/i18n/core";

// Lebanese areas used for locations, filters, delivery and location landing pages.
export type Area = { slug: string; en: string; ar: string; fr: string; lat: number; lng: number };

export const AREAS: Area[] = [
  { slug: "beirut", en: "Beirut", ar: "بيروت", fr: "Beyrouth", lat: 33.8938, lng: 35.5018 },
  { slug: "achrafieh", en: "Achrafieh", ar: "الأشرفية", fr: "Achrafieh", lat: 33.8886, lng: 35.5204 },
  { slug: "hamra", en: "Hamra", ar: "الحمرا", fr: "Hamra", lat: 33.8958, lng: 35.4826 },
  { slug: "verdun", en: "Verdun", ar: "فردان", fr: "Verdun", lat: 33.8869, lng: 35.4848 },
  { slug: "downtown", en: "Downtown Beirut", ar: "وسط بيروت", fr: "Centre-ville", lat: 33.8966, lng: 35.5056 },
  { slug: "badaro", en: "Badaro", ar: "بدارو", fr: "Badaro", lat: 33.8738, lng: 35.5147 },
  { slug: "hazmieh", en: "Hazmieh", ar: "الحازمية", fr: "Hazmieh", lat: 33.8552, lng: 35.5402 },
  { slug: "baabda", en: "Baabda", ar: "بعبدا", fr: "Baabda", lat: 33.8339, lng: 35.5442 },
  { slug: "metn", en: "Metn", ar: "المتن", fr: "Metn", lat: 33.8925, lng: 35.5737 },
  { slug: "jal-el-dib", en: "Jal El Dib", ar: "جل الديب", fr: "Jal el Dib", lat: 33.9087, lng: 35.5787 },
  { slug: "dbayeh", en: "Dbayeh", ar: "ضبية", fr: "Dbayeh", lat: 33.9367, lng: 35.5891 },
  { slug: "broummana", en: "Broummana", ar: "برمانا", fr: "Broummana", lat: 33.8814, lng: 35.6261 },
  { slug: "jounieh", en: "Jounieh", ar: "جونيه", fr: "Jounieh", lat: 33.9808, lng: 35.6178 },
  { slug: "kaslik", en: "Kaslik", ar: "الكسليك", fr: "Kaslik", lat: 33.9737, lng: 35.6082 },
  { slug: "jbeil", en: "Byblos (Jbeil)", ar: "جبيل", fr: "Byblos", lat: 34.1236, lng: 35.6511 },
  { slug: "batroun", en: "Batroun", ar: "البترون", fr: "Batroun", lat: 34.2553, lng: 35.6581 },
  { slug: "faraya", en: "Faraya", ar: "فاريا", fr: "Faraya", lat: 34.0128, lng: 35.8247 },
  { slug: "aley", en: "Aley", ar: "عاليه", fr: "Aley", lat: 33.8106, lng: 35.5972 },
  { slug: "chouf", en: "Chouf", ar: "الشوف", fr: "Chouf", lat: 33.6939, lng: 35.5797 },
  { slug: "saida", en: "Saida", ar: "صيدا", fr: "Saïda", lat: 33.5571, lng: 35.3729 },
  { slug: "tyre", en: "Tyre", ar: "صور", fr: "Tyr", lat: 33.2705, lng: 35.2038 },
  { slug: "tripoli", en: "Tripoli", ar: "طرابلس", fr: "Tripoli", lat: 34.4367, lng: 35.8497 },
  { slug: "zahle", en: "Zahle", ar: "زحلة", fr: "Zahlé", lat: 33.8463, lng: 35.9019 },
];

export const areaBySlug = (slug: string | null | undefined) => AREAS.find((a) => a.slug === slug) ?? null;
export const areaName = (slug: string | null | undefined, locale: Locale | string) => {
  const a = areaBySlug(slug);
  if (!a) return slug ?? "";
  return a[(locale as Locale) in a ? (locale as Locale) : "en"];
};

/** Distance in km between two points (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const AGE_BANDS = [
  { key: "0-2", min: 0, max: 2, en: "Babies & toddlers (0–2)" },
  { key: "3-5", min: 3, max: 5, en: "Preschool (3–5)" },
  { key: "6-8", min: 6, max: 8, en: "Kids (6–8)" },
  { key: "9-12", min: 9, max: 12, en: "Big kids (9–12)" },
] as const;
