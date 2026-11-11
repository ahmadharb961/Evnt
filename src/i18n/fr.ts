// French interface texts, keyed by the English text used in the code (see src/i18n/tr/*).
import { ALL } from "./tr";
export const FR: Record<string, string> = Object.fromEntries(ALL.map(([en, , fr]) => [en, fr]));
