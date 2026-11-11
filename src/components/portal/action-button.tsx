"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** A button that runs a server action (bound with its arguments), optionally after a confirm/prompt. */
export function ActionButton({
  action,
  children,
  className = "btn-outline btn-sm",
  confirm,
  prompt,
}: {
  action: (input?: string) => Promise<{ error?: string } | void | undefined | unknown>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  prompt?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          let input: string | undefined;
          if (prompt) {
            const v = window.prompt(prompt);
            if (v === null) return;
            input = v;
          } else if (confirm && !window.confirm(confirm)) return;
          setError("");
          start(async () => {
            const r = (await action(input)) as { error?: string } | undefined;
            if (r && typeof r === "object" && "error" in r && r.error) setError(r.error);
            router.refresh();
          });
        }}
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </button>
      {error && <span className="mt-1 max-w-xs text-xs text-red-600">{error}</span>}
    </span>
  );
}
