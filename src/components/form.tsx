"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function SubmitButton({ children, className = "btn-primary w-full", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  children,
  ...props
}: { label: string; name: string; error?: string; hint?: string; children?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children ?? <input name={name} className="input" aria-invalid={!!error} {...props} />}
      {hint && !error && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export function FormMessage({ state }: { state?: { error?: string; message?: string; ok?: boolean } }) {
  if (!state) return null;
  if (state.error) return <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{state.error}</p>;
  if (state.message) return <p className="rounded-2xl bg-mint-soft px-4 py-3 text-sm text-mint-deep" role="status">{state.message}</p>;
  return null;
}
