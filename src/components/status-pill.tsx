import { TONE_CLASS, type Tone } from "@/lib/status";
import type { T } from "@/i18n/core";

export function StatusPill({ map, status, t }: { map: Record<string, { label: string; tone: Tone }>; status: string; t: T }) {
  const s = map[status] ?? { label: status, tone: "gray" as Tone };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[s.tone]}`}>{t(s.label)}</span>;
}
