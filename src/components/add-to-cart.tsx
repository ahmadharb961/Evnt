"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Loader2, Check } from "lucide-react";
import { addToCartAction } from "@/actions/shop";
import { useLocale, useT } from "@/i18n/client";
import { formatMoney } from "@/lib/money";

type Variant = { id: string; name: string; stock: number; priceCents: number };

export function AddToCart({ variants, comparePriceCents }: { variants: Variant[]; comparePriceCents?: number | null }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const first = variants.find((v) => v.stock > 0) ?? variants[0];
  const [vid, setVid] = useState(first?.id ?? "");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<{ ok?: boolean; err?: string }>({});
  const [pending, start] = useTransition();
  const v = variants.find((x) => x.id === vid);
  if (!v) return null;
  const go = (buyNow: boolean) =>
    start(async () => {
      setMsg({});
      const r = await addToCartAction(v.id, qty, buyNow);
      if (r?.error) setMsg({ err: r.error });
      else {
        setMsg({ ok: true });
        router.refresh();
      }
    });
  return (
    <div className="space-y-5">
      <p className="flex items-baseline gap-3">
        <span className="text-3xl font-bold">{formatMoney(v.priceCents, locale)}</span>
        {comparePriceCents != null && comparePriceCents > v.priceCents && <span className="text-lg text-ink-muted line-through">{formatMoney(comparePriceCents, locale)}</span>}
      </p>
      {variants.length > 1 && (
        <div>
          <p className="label">{t("Option")}</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((x) => (
              <button key={x.id} type="button" disabled={x.stock <= 0} onClick={() => (setVid(x.id), setQty(1))} className={`chip ${x.id === vid ? "chip-on" : ""} disabled:opacity-40 disabled:line-through`}>
                {x.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className={`text-sm font-medium ${v.stock > 0 ? (v.stock <= 3 ? "text-peach-deep" : "text-mint-deep") : "text-ink-muted"}`}>
        {v.stock <= 0 ? t("Out of stock") : v.stock <= 3 ? t("Only {n} left", { n: v.stock }) : t("In stock")}
      </p>
      {v.stock > 0 && (
        <>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/15" aria-label={t("Remove one")}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center font-semibold">{qty}</span>
            <button type="button" onClick={() => setQty(Math.min(v.stock, qty + 1, 20))} className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/15" aria-label={t("Add one")}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => go(false)} disabled={pending} className="btn-outline h-12 flex-1">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : msg.ok ? <Check className="h-4 w-4" /> : null}
              {msg.ok ? t("Added to cart") : t("Add to cart")}
            </button>
            <button type="button" onClick={() => go(true)} disabled={pending} className="btn-primary h-12 flex-1">
              {t("Buy now")}
            </button>
          </div>
        </>
      )}
      {msg.err && <p className="text-sm text-red-600">{msg.err}</p>}
    </div>
  );
}
