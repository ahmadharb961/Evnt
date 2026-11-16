export type Tone = "peach" | "mint" | "powder" | "blush" | "amber" | "violet" | "sky" | "emerald" | "rose" | "slate";

/** Soft colour tiles used across the portals (icon backgrounds, stat cards, badges). */
export const TONES: Record<Tone, { tile: string; text: string; soft: string; ring: string; bar: string }> = {
  peach: { tile: "bg-peach", text: "text-peach-deep", soft: "bg-peach-soft", ring: "ring-peach", bar: "#f4a46b" },
  mint: { tile: "bg-mint", text: "text-mint-deep", soft: "bg-mint-soft", ring: "ring-mint", bar: "#5fbf93" },
  powder: { tile: "bg-powder", text: "text-powder-deep", soft: "bg-powder-soft", ring: "ring-powder", bar: "#7d93c4" },
  blush: { tile: "bg-blush", text: "text-blush-deep", soft: "bg-blush-soft", ring: "ring-blush", bar: "#d77fb3" },
  amber: { tile: "bg-amber-200", text: "text-amber-800", soft: "bg-amber-50", ring: "ring-amber-200", bar: "#f2b632" },
  violet: { tile: "bg-violet-200", text: "text-violet-800", soft: "bg-violet-50", ring: "ring-violet-200", bar: "#9b7be0" },
  sky: { tile: "bg-sky-200", text: "text-sky-800", soft: "bg-sky-50", ring: "ring-sky-200", bar: "#4fb0e0" },
  emerald: { tile: "bg-emerald-200", text: "text-emerald-800", soft: "bg-emerald-50", ring: "ring-emerald-200", bar: "#34b37e" },
  rose: { tile: "bg-rose-200", text: "text-rose-800", soft: "bg-rose-50", ring: "ring-rose-200", bar: "#ee6f86" },
  slate: { tile: "bg-slate-200", text: "text-slate-700", soft: "bg-slate-50", ring: "ring-slate-200", bar: "#94a3b8" },
};
