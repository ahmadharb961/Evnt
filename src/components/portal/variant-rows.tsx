"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useT } from "@/i18n/client";

type Row = { id: string; name: string; stock: number; price: string };

/** Product options (size, colour…) with their own stock and optional price. */
export function VariantRows({ initial }: { initial: Row[] }) {
  const t = useT();
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ id: "", name: "Default", stock: 0, price: "" }]);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_90px_100px_32px] gap-2 text-xs text-ink-muted">
        <span>{t("Option")}</span>
        <span>{t("Stock")}</span>
        <span>{t("Price (optional)")}</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_90px_100px_32px] items-center gap-2">
          <input type="hidden" name="vId" value={r.id} />
          <input name="vName" value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="input !py-2" maxLength={40} />
          <input name="vStock" type="number" min={0} value={r.stock} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, stock: +e.target.value } : x)))} className="input !py-2" />
          <input name="vPrice" inputMode="decimal" value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className="input !py-2" placeholder="—" />
          {rows.length > 1 ? (
            <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={t("Remove")}>
              <Trash2 className="h-4 w-4 text-ink-muted" />
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, { id: "", name: "", stock: 0, price: "" }])} className="btn-ghost btn-sm">
        <Plus className="h-4 w-4" />
        {t("Add option")}
      </button>
    </div>
  );
}
