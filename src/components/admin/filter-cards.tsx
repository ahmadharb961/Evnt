import Link from "next/link";
import { TONES, type Tone } from "@/lib/tones";

/** Big-number cards that double as filters (tap one to show only those). */
export function FilterCards({ items }: { items: { href: string; label: string; value: number | string; tone: Tone; on?: boolean }[] }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((i) => {
        const c = TONES[i.tone];
        return (
          <Link key={i.href} href={i.href} className={`relative overflow-hidden rounded-3xl p-4 transition hover:-translate-y-0.5 hover:shadow-card ${c.soft} ${i.on ? "ring-2 ring-ink" : "ring-1 ring-ink/[.04]"}`}>
            <div aria-hidden className={`absolute -end-5 -top-5 h-14 w-14 rounded-full opacity-60 ${c.tile}`} />
            <p className="relative text-3xl font-extrabold tracking-tight" style={{ color: c.deep }}>
              {i.value}
            </p>
            <p className="relative mt-1 text-xs font-semibold text-ink-soft">{i.label}</p>
          </Link>
        );
      })}
    </div>
  );
}
