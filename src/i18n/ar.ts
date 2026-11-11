// Arabic interface texts, keyed by the English text used in the code (see src/i18n/tr/*).
import { ALL } from "./tr";
export const AR: Record<string, string> = Object.fromEntries(ALL.map(([en, ar]) => [en, ar]));
