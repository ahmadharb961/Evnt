"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Armchair, Circle, Square, Hexagon, Eraser, Ban, Accessibility, Plus, Trash2, Wand2, Loader2 } from "lucide-react";
import { saveSeatingMapAction } from "@/actions/seating";
import { useT } from "@/i18n/client";

type Kind = "SEAT" | "TABLE" | "SPOT" | "STATION";
type Cell = { kind: Kind; zone: string; accessible: boolean; blocked: boolean; label?: string };
type Zone = { key: string; name: string; color: string };
type Label = { text: string; x: number; y: number; w: number };
type Tool = Kind | "ERASE" | "BLOCK" | "ACCESSIBLE" | "ZONE";

const PALETTE = ["#FDCDAC", "#CBD5E8", "#B3E2CD", "#F4CAE4", "#E9D8A6", "#D7C7F2", "#BFE3F2", "#F2C6C2"];
const CELL = 30;
const ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Automatic labels: seats A1, A2… per row (top to bottom, left to right); tables T1…, spots P1…, stations S1…. */
function computeLabels(cells: Map<string, Cell>) {
  const out = new Map<string, { label: string; row: string | null }>();
  const entries = [...cells.entries()].map(([k, c]) => ({ k, c, x: +k.split(",")[0], y: +k.split(",")[1] }));
  const seatRows = [...new Set(entries.filter((e) => e.c.kind === "SEAT").map((e) => e.y))].sort((a, b) => a - b);
  for (const [i, y] of seatRows.entries()) {
    const row = ROW_LETTERS[i % 26] + (i >= 26 ? String(Math.floor(i / 26)) : "");
    entries
      .filter((e) => e.c.kind === "SEAT" && e.y === y)
      .sort((a, b) => a.x - b.x)
      .forEach((e, n) => out.set(e.k, { label: `${row}${n + 1}`, row }));
  }
  const prefix: Record<Kind, string> = { SEAT: "", TABLE: "T", SPOT: "P", STATION: "S" };
  for (const kind of ["TABLE", "SPOT", "STATION"] as Kind[]) {
    entries
      .filter((e) => e.c.kind === kind)
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .forEach((e, n) => out.set(e.k, { label: `${prefix[kind]}${n + 1}`, row: null }));
  }
  return out;
}

export function SeatingEditor({
  initial,
}: {
  initial?: { id: string; name: string; width: number; height: number; zones: Zone[]; labels: Label[]; seats: { x: number; y: number; kind: Kind; zone: string; accessible: boolean; blocked: boolean }[] };
}) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? t("Main hall"));
  const [width, setWidth] = useState(initial?.width ?? 16);
  const [height, setHeight] = useState(initial?.height ?? 10);
  const [zones, setZones] = useState<Zone[]>(initial?.zones ?? [{ key: "standard", name: t("Standard"), color: PALETTE[1] }]);
  const [labels, setLabels] = useState<Label[]>(initial?.labels ?? [{ text: t("STAGE"), x: 1, y: 0, w: 14 }]);
  const [cells, setCells] = useState<Map<string, Cell>>(() => new Map((initial?.seats ?? []).map((s) => [`${s.x},${s.y}`, { kind: s.kind, zone: s.zone, accessible: s.accessible, blocked: s.blocked }])));
  const [tool, setTool] = useState<Tool>("SEAT");
  const [zone, setZone] = useState(zones[0]?.key ?? "standard");
  const [painting, setPainting] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const [gen, setGen] = useState({ rows: 6, perRow: 12, aisle: 6, startY: 2 });

  const auto = useMemo(() => computeLabels(cells), [cells]);
  const labelCells = useMemo(() => {
    const s = new Set<string>();
    for (const l of labels) for (let i = 0; i < l.w; i++) s.add(`${l.x + i},${l.y}`);
    return s;
  }, [labels]);

  function apply(x: number, y: number) {
    const k = `${x},${y}`;
    if (labelCells.has(k)) return;
    setCells((prev) => {
      const next = new Map(prev);
      const cur = next.get(k);
      if (tool === "ERASE") next.delete(k);
      else if (tool === "BLOCK") cur && next.set(k, { ...cur, blocked: !cur.blocked });
      else if (tool === "ACCESSIBLE") cur && next.set(k, { ...cur, accessible: !cur.accessible });
      else if (tool === "ZONE") cur && next.set(k, { ...cur, zone });
      else next.set(k, { kind: tool, zone, accessible: cur?.accessible ?? false, blocked: false });
      return next;
    });
  }

  function generate() {
    const next = new Map(cells);
    const total = gen.perRow + (gen.aisle > 0 && gen.aisle < gen.perRow ? 1 : 0);
    const startX = Math.max(0, Math.floor((width - total) / 2));
    if (gen.startY + gen.rows > height) setHeight(gen.startY + gen.rows + 1);
    if (total + startX > width) setWidth(total + 2);
    for (let r = 0; r < gen.rows; r++) {
      let x = startX;
      for (let c = 0; c < gen.perRow; c++) {
        if (gen.aisle > 0 && c === gen.aisle) x++;
        next.set(`${x},${gen.startY + r}`, { kind: "SEAT", zone, accessible: false, blocked: false });
        x++;
      }
    }
    setCells(next);
  }

  function save() {
    setMsg({});
    const seats = [...cells.entries()]
      .map(([k, c]) => {
        const [x, y] = k.split(",").map(Number);
        const a = auto.get(k)!;
        return { label: a.label, row: a.row, x, y, kind: c.kind, zone: c.zone, accessible: c.accessible, blocked: c.blocked };
      })
      .filter((s) => s.x < width && s.y < height);
    start(async () => {
      const r = await saveSeatingMapAction({ id: initial?.id, name, width, height, zones, labels: labels.filter((l) => l.text.trim()), seats });
      if (r.error) setMsg({ err: r.error });
      else {
        setMsg({ ok: t("Saved") });
        if (!initial?.id && r.id) router.replace(`/merchant/seating/${r.id}`);
        else router.refresh();
      }
    });
  }

  const tools: { k: Tool; icon: React.ElementType; label: string }[] = [
    { k: "SEAT", icon: Armchair, label: t("Seat") },
    { k: "TABLE", icon: Circle, label: t("Table") },
    { k: "SPOT", icon: Square, label: t("Spot") },
    { k: "STATION", icon: Hexagon, label: t("Station") },
    { k: "ZONE", icon: Wand2, label: t("Paint zone") },
    { k: "BLOCK", icon: Ban, label: t("Block") },
    { k: "ACCESSIBLE", icon: Accessibility, label: t("Accessible") },
    { k: "ERASE", icon: Eraser, label: t("Erase") },
  ];
  const zoneColor = (k: string) => zones.find((z) => z.key === k)?.color ?? "#ddd";
  const counts = [...cells.values()].reduce((a, c) => ((a[c.zone] = (a[c.zone] ?? 0) + (c.blocked ? 0 : 1)), a), {} as Record<string, number>);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {tools.map((x) => (
            <button key={x.k} type="button" onClick={() => setTool(x.k)} className={`chip ${tool === x.k ? "chip-on" : ""}`}>
              <x.icon className="h-4 w-4" />
              {x.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-muted">{t("Zone for new places:")}</span>
          {zones.map((z) => (
            <button key={z.key} type="button" onClick={() => setZone(z.key)} className={`chip ${zone === z.key ? "ring-2 ring-ink" : ""}`}>
              <span className="h-3 w-3 rounded" style={{ background: z.color }} />
              {z.name}
            </button>
          ))}
        </div>
        <div className="overflow-auto rounded-3xl border border-ink/10 bg-canvas p-3" dir="ltr" onMouseLeave={() => setPainting(false)} onMouseUp={() => setPainting(false)}>
          <svg width={width * CELL} height={height * CELL} className="select-none touch-none">
            {Array.from({ length: height }).map((_, y) =>
              Array.from({ length: width }).map((_, x) => {
                const k = `${x},${y}`;
                const c = cells.get(k);
                return (
                  <g
                    key={k}
                    onMouseDown={() => {
                      setPainting(true);
                      apply(x, y);
                    }}
                    onMouseEnter={() => painting && apply(x, y)}
                    onClick={(e) => e.detail === 0 && apply(x, y)}
                    onTouchStart={() => apply(x, y)}
                  >
                    <rect x={x * CELL + 1} y={y * CELL + 1} width={CELL - 2} height={CELL - 2} rx={6} fill={c ? (c.blocked ? "#d9d9d9" : zoneColor(c.zone)) : "#ffffff"} stroke={c ? "none" : "#ececec"} />
                    {c && (
                      <text x={x * CELL + CELL / 2} y={y * CELL + CELL / 2 + 3} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="#252525" pointerEvents="none">
                        {c.accessible ? "♿" : c.blocked ? "×" : auto.get(k)?.label}
                      </text>
                    )}
                  </g>
                );
              }),
            )}
            {labels.map((l, i) => (
              <g key={i} pointerEvents="none">
                <rect x={l.x * CELL + 1} y={l.y * CELL + 2} width={l.w * CELL - 2} height={CELL - 4} rx={8} fill="#252525" opacity={0.12} />
                <text x={(l.x + l.w / 2) * CELL} y={l.y * CELL + CELL / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing={3} fill="#4a4a4a">
                  {l.text}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <p className="text-xs text-ink-muted">{t("Click or drag on the grid. Labels are numbered automatically (rows A, B, C… left to right).")}</p>
      </div>

      <div className="space-y-5">
        <div className="rounded-3xl border border-ink/[.06] bg-white p-5">
          <label className="block">
            <span className="label">{t("Map name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" maxLength={80} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">{t("Columns")}</span>
              <input type="number" min={2} max={60} value={width} onChange={(e) => setWidth(Math.max(2, Math.min(60, +e.target.value || 2)))} className="input" />
            </label>
            <label className="block">
              <span className="label">{t("Rows")}</span>
              <input type="number" min={2} max={60} value={height} onChange={(e) => setHeight(Math.max(2, Math.min(60, +e.target.value || 2)))} className="input" />
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-ink/[.06] bg-white p-5">
          <p className="mb-3 text-sm font-semibold">{t("Quick rows")}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ["rows", t("Rows of seats")],
                ["perRow", t("Seats per row")],
                ["aisle", t("Aisle after seat")],
                ["startY", t("Start at grid row")],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="block">
                <span className="label text-xs">{l}</span>
                <input type="number" min={0} max={40} value={gen[k]} onChange={(e) => setGen({ ...gen, [k]: Math.max(0, +e.target.value || 0) })} className="input" />
              </label>
            ))}
          </div>
          <button type="button" onClick={generate} className="btn-soft btn-sm mt-3 w-full">
            <Wand2 className="h-4 w-4" />
            {t("Add rows")}
          </button>
        </div>

        <div className="rounded-3xl border border-ink/[.06] bg-white p-5">
          <p className="mb-3 text-sm font-semibold">{t("Zones & prices")}</p>
          <p className="mb-3 text-xs text-ink-muted">{t("Each zone gets its own ticket price in the listing's Tickets tab.")}</p>
          <div className="space-y-2">
            {zones.map((z, i) => (
              <div key={z.key} className="flex items-center gap-2">
                <input type="color" value={z.color} onChange={(e) => setZones(zones.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border-0" aria-label={t("Color")} />
                <input value={z.name} onChange={(e) => setZones(zones.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="input !py-2" maxLength={40} />
                <span className="w-8 text-center text-xs text-ink-muted">{counts[z.key] ?? 0}</span>
                {zones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if ([...cells.values()].some((c) => c.zone === z.key)) return setMsg({ err: t("Move or erase this zone's places first.") });
                      setZones(zones.filter((_, j) => j !== i));
                    }}
                    aria-label={t("Remove")}
                  >
                    <Trash2 className="h-4 w-4 text-ink-muted" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {zones.length < 8 && (
            <button
              type="button"
              onClick={() => {
                const key = `zone-${Date.now().toString(36).slice(-5)}`;
                setZones([...zones, { key, name: t("New zone"), color: PALETTE[zones.length % PALETTE.length] }]);
              }}
              className="btn-ghost btn-sm mt-2"
            >
              <Plus className="h-4 w-4" />
              {t("Add zone")}
            </button>
          )}
        </div>

        <div className="rounded-3xl border border-ink/[.06] bg-white p-5">
          <p className="mb-3 text-sm font-semibold">{t("Labels (stage, entrance…)")}</p>
          {labels.map((l, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_52px_52px_52px_24px] items-center gap-1.5">
              <input value={l.text} onChange={(e) => setLabels(labels.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className="input !px-2 !py-2 text-xs" maxLength={30} />
              {(["x", "y", "w"] as const).map((k) => (
                <input key={k} type="number" min={k === "w" ? 1 : 0} value={l[k]} onChange={(e) => setLabels(labels.map((x, j) => (j === i ? { ...x, [k]: Math.max(k === "w" ? 1 : 0, +e.target.value || 0) } : x)))} className="input !px-2 !py-2 text-xs" aria-label={k} />
              ))}
              <button type="button" onClick={() => setLabels(labels.filter((_, j) => j !== i))} aria-label={t("Remove")}>
                <Trash2 className="h-4 w-4 text-ink-muted" />
              </button>
            </div>
          ))}
          {labels.length < 10 && (
            <button type="button" onClick={() => setLabels([...labels, { text: t("ENTRANCE"), x: 0, y: height - 1, w: 4 }])} className="btn-ghost btn-sm">
              <Plus className="h-4 w-4" />
              {t("Add label")}
            </button>
          )}
        </div>

        {msg.err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{msg.err}</p>}
        {msg.ok && <p className="rounded-2xl bg-mint-soft px-4 py-3 text-sm text-mint-deep">{msg.ok}</p>}
        <button type="button" onClick={save} disabled={pending} className="btn-primary h-12 w-full">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Save map")} · {t("{n} places", { n: cells.size })}
        </button>
      </div>
    </div>
  );
}
