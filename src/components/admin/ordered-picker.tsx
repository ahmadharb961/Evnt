"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GripVertical, ChevronUp, ChevronDown, X, Plus, Search, Loader2 } from "lucide-react";
import { pickerSearchAction } from "@/actions/admin";
import { useT } from "@/i18n/client";
import type { PickItem, PickKind } from "@/lib/picker";

/**
 * An ordered list the admin builds by searching and adding items, then dragging (or using the arrows on touch)
 * to set who shows first. The order is submitted as a comma-separated hidden input.
 */
export function OrderedPicker({ name, kinds, initial, max = 40, emptyText }: { name: string; kinds: PickKind[]; initial: PickItem[]; max?: number; emptyText?: string }) {
  const t = useT();
  const [items, setItems] = useState(initial);
  const [drag, setDrag] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickItem[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const kindKey = kinds.join(",");

  useEffect(() => setItems(initial), [initial]);
  useEffect(() => {
    if (!open) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => start(async () => setResults(await pickerSearchAction(kindKey.split(",") as PickKind[], q))), 220);
    return () => clearTimeout(timer.current);
  }, [q, open, kindKey]);

  const kindLabel: Record<PickKind, string> = { merchant: t("Business"), event: t("Activity"), restaurant: t("Restaurant"), product: t("Product") };
  const move = (i: number, j: number) => {
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(j, 0, x);
    setItems(next);
  };
  const chosen = new Set(items.map((i) => i.id));

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={items.map((i) => i.id).join(",")} />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 p-4 text-center text-sm text-ink-muted">{emptyText ?? t("Nothing pinned yet. Search below to add.")}</p>
      ) : (
        <ol className="divide-y divide-ink/[.06] rounded-2xl border border-ink/[.06] bg-white">
          {items.map((it, i) => (
            <li
              key={it.id}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag !== null && drag !== i) move(drag, i);
                setDrag(null);
              }}
              className={`flex items-center gap-3 p-2.5 ${drag === i ? "opacity-40" : ""}`}
            >
              <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-ink-muted" aria-hidden />
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-ink-muted">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.image} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{it.label}</p>
                <p className="truncate text-xs text-ink-muted">
                  {kinds.length > 1 ? `${kindLabel[it.kind]} · ` : ""}
                  {it.sub}
                </p>
              </div>
              <div className="flex shrink-0 flex-col">
                <button type="button" onClick={() => move(i, i - 1)} aria-label={t("Move up")} className="text-ink-muted hover:text-ink">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(i, i + 1)} aria-label={t("Move down")} className="text-ink-muted hover:text-ink">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <button type="button" onClick={() => setItems(items.filter((x) => x.id !== it.id))} aria-label={t("Remove")} className="btn-ghost btn-sm shrink-0">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={t("Search to add…")}
          className="input !ps-9"
          aria-label={t("Search to add…")}
        />
        {pending && <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-muted" />}
      </div>
      {open && (
        <div className="max-h-72 overflow-y-auto rounded-2xl border border-ink/[.06] bg-white">
          {results.filter((r) => !chosen.has(r.id)).length === 0 && !pending ? (
            <p className="p-3 text-sm text-ink-muted">{t("No matches")}</p>
          ) : (
            results
              .filter((r) => !chosen.has(r.id))
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={items.length >= max}
                  onClick={() => setItems([...items, r])}
                  className="flex w-full items-center gap-3 p-2.5 text-start hover:bg-canvas disabled:opacity-40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.label}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {kinds.length > 1 ? `${kindLabel[r.kind]} · ` : ""}
                      {r.sub}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0" />
                </button>
              ))
          )}
        </div>
      )}
    </div>
  );
}
