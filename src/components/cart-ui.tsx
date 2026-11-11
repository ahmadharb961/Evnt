"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, Loader2, Banknote, Wallet } from "lucide-react";
import { applyDiscountAction, placeOrderAction, setCartQuantityAction } from "@/actions/shop";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useLocale, useT } from "@/i18n/client";
import { AREAS } from "@/lib/areas";

export function QtyControl({ itemId, quantity, stock }: { itemId: string; quantity: number; stock: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const set = (q: number) =>
    start(async () => {
      const r = await setCartQuantityAction(itemId, q);
      setErr(r?.error ?? "");
      router.refresh();
    });
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={pending} onClick={() => set(quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15" aria-label={t("Remove one")}>
          {quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        </button>
        <span className="w-5 text-center text-sm font-semibold">{pending ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : quantity}</span>
        <button type="button" disabled={pending || quantity >= stock} onClick={() => set(quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 disabled:opacity-30" aria-label={t("Add one")}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

export function DiscountForm({ current, invalid }: { current: string | null; invalid: boolean }) {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState(current ?? "");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await applyDiscountAction(code);
          router.refresh();
        });
      }}
      className="flex gap-2"
    >
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("Discount code")} className="input !py-2.5 uppercase" />
      <button className="btn-outline" disabled={pending}>
        {t("Apply")}
      </button>
      {invalid && <span className="sr-only">{t("This code isn't valid for your cart")}</span>}
    </form>
  );
}

export function CheckoutForm({ name, phone, codAvailable, whishAvailable, total }: { name: string; phone: string; codAvailable: boolean; whishAvailable: boolean; total: string }) {
  const t = useT();
  const locale = useLocale();
  const [state, action] = useActionState(placeOrderAction, undefined);
  const [method, setMethod] = useState<"COD" | "WHISH">(codAvailable ? "COD" : "WHISH");
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="method" value={method} />
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Full name")} name="customerName" defaultValue={name} required error={fe.customerName} autoComplete="name" />
        <Field label={t("Mobile number")} name="phone" type="tel" defaultValue={phone ? `+${phone}` : ""} required error={fe.phone} autoComplete="tel" />
      </div>
      <Field label={t("Area")} name="area" error={fe.area}>
        <select name="area" required className="input" defaultValue="">
          <option value="" disabled>
            {t("Choose…")}
          </option>
          {AREAS.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a[locale]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("Street / neighbourhood")} name="address" required error={fe.address} autoComplete="street-address" />
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("Building")} name="building" required error={fe.building} />
        <Field label={t("Floor")} name="floor" />
      </div>
      <Field label={t("Delivery instructions (optional)")} name="instructions" maxLength={300} placeholder={t("Near the pharmacy, call when outside…")} />
      <div className="space-y-3">
        <p className="label">{t("Payment")}</p>
        {codAvailable && (
          <button type="button" onClick={() => setMethod("COD")} className={`flex w-full items-start gap-3 rounded-3xl border p-4 text-start ${method === "COD" ? "border-ink ring-2 ring-ink" : "border-ink/10"}`}>
            <Banknote className="mt-0.5 h-5 w-5" />
            <span>
              <span className="block font-semibold">{t("Cash on delivery")}</span>
              <span className="text-sm text-ink-muted">{t("Pay in cash when your order arrives.")}</span>
            </span>
          </button>
        )}
        {whishAvailable && (
          <button type="button" onClick={() => setMethod("WHISH")} className={`flex w-full items-start gap-3 rounded-3xl border p-4 text-start ${method === "WHISH" ? "border-ink ring-2 ring-ink" : "border-ink/10"}`}>
            <Wallet className="mt-0.5 h-5 w-5" />
            <span>
              <span className="block font-semibold">{t("Pay with Whish Money")}</span>
              <span className="text-sm text-ink-muted">{t("Your order is confirmed once Whish confirms the payment.")}</span>
            </span>
          </button>
        )}
        {!codAvailable && !whishAvailable && <p className="rounded-2xl bg-peach-soft p-3 text-sm text-peach-deep">{t("No payment method is available for these shops right now.")}</p>}
      </div>
      {(codAvailable || whishAvailable) && <SubmitButton className="btn-primary h-12 w-full text-base">{method === "WHISH" ? t("Continue to Whish · {total}", { total }) : t("Place order · {total}", { total })}</SubmitButton>}
    </form>
  );
}
