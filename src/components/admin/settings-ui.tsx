"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Minus, Plus, Check, Loader2 } from "lucide-react";
import { useT } from "@/i18n/client";

type State = { error?: string; message?: string } | undefined;

/** Settings form with a save bar that stays on screen and lights up when something changed. */
export function SettingsForm({ action, children }: { action: (s: State, f: FormData) => Promise<State>; children: React.ReactNode }) {
  const t = useT();
  const [dirty, setDirty] = useState(false);
  const [state, formAction] = useActionState(async (s: State, f: FormData) => {
    const r = await action(s, f);
    if (!r?.error) setDirty(false);
    return r;
  }, undefined);
  return (
    <form action={formAction} onChange={() => setDirty(true)} className="space-y-8 pb-28">
      {children}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 lg:ms-64 lg:px-8" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className={`mx-auto flex max-w-5xl items-center gap-3 rounded-3xl p-3 ps-5 shadow-lift ring-1 transition ${dirty ? "bg-ink text-white ring-ink" : "bg-white ring-ink/[.06]"}`}>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {state?.error ? <span className="text-rose-500">{t(state.error)}</span> : dirty ? t("You have unsaved changes") : state?.message ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600">
                <Check className="h-4 w-4" /> {t("All changes saved")}
              </span>
            ) : (
              <span className="text-ink-muted">{t("Change any number, then save")}</span>
            )}
          </p>
          <Save dirty={dirty} />
        </div>
      </div>
    </form>
  );
}

function Save({ dirty }: { dirty: boolean }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-bold transition ${dirty ? "bg-white text-ink hover:bg-white/90" : "bg-ink text-white hover:bg-ink-soft"}`}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {t("Save settings")}
    </button>
  );
}

/** One setting as a card with a big number and − / + buttons. */
export function NumberTile({ name, label, help, unit, money, defaultValue, accent }: { name: string; label: string; help: string; unit?: string; money?: boolean; defaultValue: number; accent: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const step = money ? (defaultValue >= 50 ? 5 : defaultValue >= 10 ? 1 : 0.5) : defaultValue >= 100 ? 10 : 1;
  const bump = (d: number) => {
    const el = ref.current;
    if (!el) return;
    const v = Math.max(0, Math.round((Number(el.value || 0) + d * step) * 100) / 100);
    el.value = String(v);
    el.form?.dispatchEvent(new Event("change", { bubbles: true }));
  };
  return (
    <div className="flex flex-col rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-ink/[.04]">
      <p className="text-sm font-bold">{label}</p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => bump(-1)} aria-label="−" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-canvas text-ink-soft transition hover:bg-ink hover:text-white">
          <Minus className="h-4 w-4" />
        </button>
        <label className="flex min-w-0 flex-1 items-baseline justify-center gap-1" dir="ltr">
          {money && <span className="text-2xl font-bold" style={{ color: accent }}>$</span>}
          <input ref={ref} name={name} defaultValue={defaultValue} inputMode="decimal" aria-label={label} className="w-full min-w-0 bg-transparent text-center text-5xl font-extrabold tracking-tight outline-none" style={{ color: accent, maxWidth: `${Math.max(2, String(defaultValue).length + 1)}ch` }} />
        </label>
        <button type="button" onClick={() => bump(1)} aria-label="+" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-canvas text-ink-soft transition hover:bg-ink hover:text-white">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {unit && <p className="mt-1 text-center text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">{unit}</p>}
      <p className="mt-3 border-t border-ink/[.06] pt-3 text-xs leading-relaxed text-ink-muted">{help}</p>
    </div>
  );
}

/** On/off setting as a big switch card. */
export function ToggleTile({ name, label, help, defaultChecked }: { name: string; label: string; help: string; defaultChecked: boolean }) {
  const t = useT();
  const [on, setOn] = useState(defaultChecked);
  return (
    <label className={`flex cursor-pointer flex-col rounded-[1.75rem] p-5 shadow-card ring-1 transition ${on ? "bg-emerald-500 text-white ring-emerald-500" : "bg-white ring-ink/[.04]"}`}>
      <input type="checkbox" name={name} checked={on} onChange={(e) => setOn(e.target.checked)} className="sr-only" />
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold">{label}</span>
        <span className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? "bg-white/30" : "bg-ink/15"}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "start-7" : "start-1"}`} />
        </span>
      </span>
      <span className="mt-3 text-4xl font-extrabold tracking-tight">{on ? t("On") : t("Off")}</span>
      <span className={`mt-3 border-t pt-3 text-xs leading-relaxed ${on ? "border-white/25 text-white/85" : "border-ink/[.06] text-ink-muted"}`}>{help}</span>
    </label>
  );
}

/** Free-text setting (phone, email). */
export function TextTile({ name, label, help, defaultValue }: { name: string; label: string; help: string; defaultValue: string }) {
  return (
    <label className="flex flex-col rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-ink/[.04]">
      <span className="text-sm font-bold">{label}</span>
      <input name={name} defaultValue={defaultValue} dir="ltr" className="mt-3 w-full rounded-2xl bg-canvas px-4 py-3 text-xl font-bold outline-none focus:ring-2 focus:ring-ink/20" />
      <span className="mt-3 border-t border-ink/[.06] pt-3 text-xs leading-relaxed text-ink-muted">{help}</span>
    </label>
  );
}
