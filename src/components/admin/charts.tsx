/** Small, dependency-free charts for the admin (server-rendered SVG / CSS). */

export type Series = { label: string; color: string; values: number[] };

/** Stacked columns over time, with hover titles. */
export function StackedBars({ labels, series, format, empty }: { labels: string[]; series: Series[]; format: (n: number) => string; empty: string }) {
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const max = Math.max(...totals, 0);
  if (!max) return <div className="flex h-48 items-center justify-center rounded-2xl bg-canvas text-sm text-ink-muted">{empty}</div>;
  const step = Math.max(1, Math.ceil(labels.length / 8));
  return (
    <div>
      <div className="flex h-48 items-end gap-[3px] sm:gap-1">
        {labels.map((l, i) => (
          <div key={l + i} className="group relative flex h-full flex-1 flex-col justify-end" title={`${l}: ${format(totals[i])}`}>
            <div className="flex flex-col-reverse overflow-hidden rounded-t-md transition group-hover:opacity-80" style={{ height: `${(totals[i] / max) * 100}%`, minHeight: totals[i] ? 3 : 0 }}>
              {series.map((s) => (
                <div key={s.label} style={{ flexGrow: s.values[i] ?? 0, background: s.color }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex h-4 gap-[3px] text-[10px] text-ink-muted sm:gap-1">
        {labels.map((l, i) => (
          <span key={l + i} className="relative flex-1">
            {i % step === 0 && <span className="absolute start-0 whitespace-nowrap">{l}</span>}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}: <b>{format(s.values.reduce((a, b) => a + b, 0))}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Donut with a legend. */
export function Donut({ parts, format, center, empty }: { parts: { label: string; value: number; color: string }[]; format: (n: number) => string; center: string; empty: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  let acc = 0;
  const stops = total
    ? parts
        .filter((p) => p.value > 0)
        .map((p) => {
          const from = (acc / total) * 360;
          acc += p.value;
          return `${p.color} ${from}deg ${(acc / total) * 360}deg`;
        })
        .join(", ")
    : "#eceae6 0deg 360deg";
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
          <span className="text-lg font-bold leading-tight">{format(total)}</span>
          <span className="text-[10px] text-ink-muted">{center}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {total === 0 && <li className="text-ink-muted">{empty}</li>}
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="flex-1 truncate text-ink-soft">{p.label}</span>
            <b className="tabular-nums">{format(p.value)}</b>
            <span className="w-10 text-end text-xs text-ink-muted">{total ? Math.round((p.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal ranking bars. */
export function BarList({ rows, format, color, empty }: { rows: { label: string; value: number; href?: string }[]; format: (n: number) => string; color: string; empty: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="relative overflow-hidden rounded-xl bg-canvas px-3 py-2 text-sm">
          <div className="absolute inset-y-0 start-0 rounded-xl opacity-30" style={{ width: `${max ? (r.value / max) * 100 : 0}%`, background: color }} />
          <div className="relative flex justify-between gap-3">
            {r.href ? (
              <a href={r.href} className="truncate font-medium hover:underline">
                {r.label}
              </a>
            ) : (
              <span className="truncate font-medium">{r.label}</span>
            )}
            <b className="tabular-nums">{format(r.value)}</b>
          </div>
        </li>
      ))}
    </ul>
  );
}
