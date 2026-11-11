import KEYS from "../src/i18n/keys.json";
import { AR } from "../src/i18n/ar";
import { FR } from "../src/i18n/fr";

/** Identifiers, CSS classes, enum values and setting keys are not interface prose. */
export function isProse(k: string) {
  if (/^[A-Z0-9_]+$/.test(k)) return false; // ENUM_VALUES
  if (/^[a-z]+([A-Z.][A-Za-z.]*)+$/.test(k)) return false; // camelCase / setting.keys
  if (/^[a-z0-9_-]+$/.test(k) && !["at", "or", "demo", "disabled", "expired", "granted", "guests", "member", "restricted", "system", "uses", "clicks"].includes(k)) return false;
  if (k.startsWith("/") || /^[a-z]+\/[a-z]/.test(k) || /\bpx-|\btext-/.test(k)) return false;
  return true;
}
export const missing = (KEYS as string[]).filter((k) => isProse(k) && (!AR[k] || !FR[k]));
if (process.argv[1]?.includes("i18n-missing")) {
  console.log(missing.length + " missing");
  console.log(missing.map((m) => JSON.stringify(m)).join("\n"));
}
