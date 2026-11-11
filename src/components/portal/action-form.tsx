"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";

type State = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string } | undefined;

/**
 * Generic form bound to a server action returning { error | fieldErrors | message }.
 * Fields are passed as children (they can be server-rendered). Field errors are listed under the message.
 */
export function ActionForm({
  action,
  children,
  submit,
  className = "space-y-5",
  hidden,
  submitClass = "btn-primary",
}: {
  action: (s: State, f: FormData) => Promise<State>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  hidden?: Record<string, string>;
  submitClass?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const fe = state?.fieldErrors ? Object.values(state.fieldErrors) : [];
  return (
    <form action={formAction} className={className}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <FormMessage state={state} />
      {fe.length > 0 && (
        <ul className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {fe.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {children}
      <SubmitButton className={submitClass}>{submit}</SubmitButton>
    </form>
  );
}
