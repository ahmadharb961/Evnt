import "server-only";
import { prisma } from "./db";

// Admin overrides for interface texts, cached for a minute per server instance.
let cache: { at: number; byLocale: Record<string, Record<string, string>> } | null = null;

export async function getOverrides(locale: string): Promise<Record<string, string>> {
  if (!cache || Date.now() - cache.at > 60_000) {
    try {
      const rows = await prisma.translationOverride.findMany();
      const byLocale: Record<string, Record<string, string>> = {};
      for (const r of rows) (byLocale[r.locale] ??= {})[r.key] = r.value;
      cache = { at: Date.now(), byLocale };
    } catch {
      cache = { at: Date.now(), byLocale: {} };
    }
  }
  return cache.byLocale[locale] ?? {};
}

export function clearTranslationCache() {
  cache = null;
}
