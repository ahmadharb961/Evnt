import { TONES } from "@/lib/tones";
import { ROLE_INFO } from "@/lib/roles";
import type { T } from "@/i18n/core";

/** Colourful checkboxes for admin roles. */
export function RolePicker({ t, defaultRoles = [] }: { t: T; defaultRoles?: string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ROLE_INFO.map((r) => (
        <label key={r.role} className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 ring-ink/[.06] transition has-[:checked]:ring-2 has-[:checked]:ring-ink ${TONES[r.tone].soft}`}>
          <input type="checkbox" name="roles" value={r.role} defaultChecked={defaultRoles.includes(r.role)} className="mt-1 h-4 w-4 accent-ink" />
          <span>
            <span className={`block text-sm font-bold ${TONES[r.tone].text}`}>{t(r.label)}</span>
            <span className="block text-xs text-ink-soft">{t(r.desc)}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
