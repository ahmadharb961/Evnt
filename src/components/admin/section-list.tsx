"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical, Eye, EyeOff, Trash2, Pencil, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { reorderSectionsAction, toggleSectionAction, deleteSectionAction } from "@/actions/admin";
import { useT } from "@/i18n/client";

type Row = { id: string; title: string; source: string; visible: boolean; scheduled: string | null; sponsored: boolean };

/** Drag-and-drop (or arrow buttons on touch) ordering of homepage sections. Saves immediately. */
export function SectionList({ rows: initial }: { rows: Row[] }) {
  const t = useT();
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [drag, setDrag] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const save = (next: Row[]) => {
    setRows(next);
    start(async () => {
      await reorderSectionsAction(next.map((r) => r.id));
      router.refresh();
    });
  };
  const move = (i: number, j: number) => {
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    const [x] = next.splice(i, 1);
    next.splice(j, 0, x);
    save(next);
  };
  return (
    <div className="relative">
      {pending && <Loader2 className="absolute -top-8 end-0 h-4 w-4 animate-spin" />}
      <ul className="divide-y divide-ink/[.06] rounded-3xl border border-ink/[.06] bg-white">
        {rows.map((r, i) => (
          <li
            key={r.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null && drag !== i) move(drag, i);
              setDrag(null);
            }}
            className={`flex items-center gap-3 p-3 ${drag === i ? "opacity-40" : ""} ${r.visible ? "" : "bg-canvas"}`}
          >
            <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-ink-muted" aria-hidden />
            <div className="flex flex-col">
              <button type="button" onClick={() => move(i, i - 1)} aria-label={t("Move up")} className="text-ink-muted hover:text-ink">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, i + 1)} aria-label={t("Move down")} className="text-ink-muted hover:text-ink">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate font-medium ${r.visible ? "" : "text-ink-muted line-through"}`}>{r.title}</p>
              <p className="text-xs text-ink-muted">
                {r.source}
                {r.sponsored ? ` · ${t("Sponsored")}` : ""}
                {r.scheduled ? ` · ${r.scheduled}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => start(async () => (await toggleSectionAction(r.id), router.refresh()))} className="btn-ghost btn-sm" aria-label={r.visible ? t("Hide") : t("Show")}>
              {r.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <Link href={`/admin/cms/sections/${r.id}`} className="btn-ghost btn-sm" aria-label={t("Edit")}>
              <Pencil className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                if (!confirm(t("Delete this section?"))) return;
                setRows(rows.filter((x) => x.id !== r.id));
                start(async () => (await deleteSectionAction(r.id), router.refresh()));
              }}
              className="btn-ghost btn-sm"
              aria-label={t("Delete")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
