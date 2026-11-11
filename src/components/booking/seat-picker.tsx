"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Accessibility } from "lucide-react";
import { seatStatesAction } from "@/actions/booking";
import { useT } from "@/i18n/client";

export type Seat = { id: string; label: string; row: string | null; x: number; y: number; zone: string; kind: string; accessible: boolean; state: "available" | "held" | "sold" | "blocked" | "mine" };
type Zone = { key: string; name: string; color: string };

const CELL = 34;

/** Cinema-style seat/spot map: tap to select, zoom with the buttons, pan by scrolling. Refreshes every few seconds. */
export function SeatPicker({
  sessionId,
  width,
  height,
  zones,
  labels,
  priceByZone,
  selected,
  onChange,
  max = 12,
}: {
  sessionId: string;
  width: number;
  height: number;
  zones: Zone[];
  labels: { text: string; x: number; y: number; w: number }[];
  priceByZone: Record<string, string>;
  selected: string[];
  onChange: (ids: string[], seats: Seat[]) => void;
  max?: number;
}) {
  const t = useT();
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [zoom, setZoom] = useState(1);
  const [msg, setMsg] = useState("");
  const selRef = useRef(selected);
  selRef.current = selected;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const s = (await seatStatesAction(sessionId)) as Seat[];
      if (!alive) return;
      setSeats(s);
      // Drop selections someone else just took.
      const lost = selRef.current.filter((id) => s.find((x) => x.id === id && (x.state === "held" || x.state === "sold")));
      if (lost.length) {
        const keep = selRef.current.filter((id) => !lost.includes(id));
        onChange(keep, s);
        setMsg(t("Some seats you picked were just taken."));
      }
    };
    load();
    const iv = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!seats) return <div className="h-64 animate-pulse rounded-3xl bg-canvas" />;
  const zoneColor = (k: string) => zones.find((z) => z.key === k)?.color ?? "#CBD5E8";
  const toggle = (s: Seat) => {
    if (s.state !== "available" && s.state !== "mine") return;
    setMsg("");
    if (selected.includes(s.id)) onChange(selected.filter((x) => x !== s.id), seats);
    else if (selected.length >= max) setMsg(t("You can choose up to {n} seats", { n: max }));
    else onChange([...selected, s.id], seats);
  };
  const w = (width + 1) * CELL;
  const h = (height + 1) * CELL;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {zones.map((z) => (
          <span key={z.key} className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-md" style={{ background: z.color }} />
            {z.name} {priceByZone[z.key] && <b>{priceByZone[z.key]}</b>}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-md bg-ink" />
          {t("Selected")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-md bg-ink/15" />
          {t("Unavailable")}
        </span>
      </div>
      <div className="relative overflow-auto rounded-3xl border border-ink/10 bg-canvas p-3" style={{ maxHeight: 420, touchAction: "pan-x pan-y" }} dir="ltr">
        <svg width={w * zoom} height={h * zoom} viewBox={`0 0 ${w} ${h}`} role="group" aria-label={t("Seat map")}>
          {labels.map((l, i) => (
            <g key={i}>
              <rect x={l.x * CELL} y={l.y * CELL + 4} width={l.w * CELL} height={CELL - 10} rx={10} fill="#252525" opacity={0.08} />
              <text x={(l.x + l.w / 2) * CELL} y={l.y * CELL + CELL / 2 + 3} textAnchor="middle" fontSize={11} fontWeight={700} fill="#767676" letterSpacing={3}>
                {l.text}
              </text>
            </g>
          ))}
          {seats.map((s) => {
            const on = selected.includes(s.id);
            const off = !on && (s.state === "sold" || s.state === "held" || s.state === "blocked");
            const isTable = s.kind === "TABLE";
            return (
              <g key={s.id} onClick={() => toggle(s)} style={{ cursor: off ? "not-allowed" : "pointer" }} role="button" aria-pressed={on} aria-disabled={off} aria-label={`${s.label}${off ? ` (${t("Unavailable")})` : ""}`}>
                {isTable ? (
                  <circle cx={s.x * CELL + CELL / 2} cy={s.y * CELL + CELL / 2} r={CELL / 2 - 2} fill={on ? "#252525" : off ? "#e4e4e4" : zoneColor(s.zone)} />
                ) : (
                  <rect x={s.x * CELL + 3} y={s.y * CELL + 3} width={CELL - 6} height={CELL - 6} rx={8} fill={on ? "#252525" : off ? "#e4e4e4" : zoneColor(s.zone)} />
                )}
                <text x={s.x * CELL + CELL / 2} y={s.y * CELL + CELL / 2 + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={on ? "#fff" : off ? "#b5b5b5" : "#252525"} pointerEvents="none">
                  {s.accessible ? "♿" : s.label}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="sticky bottom-0 mt-2 flex justify-end gap-1.5" style={{ insetInlineEnd: 0 }}>
          <button type="button" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card" aria-label={t("Zoom out")}>
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card" aria-label={t("Zoom in")}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      {msg && <p className="mt-2 text-sm font-medium text-peach-deep">{msg}</p>}
      {seats.some((s) => s.accessible) && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted">
          <Accessibility className="h-3.5 w-3.5" />
          {t("Wheelchair-accessible spaces are marked ♿")}
        </p>
      )}
    </div>
  );
}
