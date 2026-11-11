"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";

const LANGS = [
  { key: "en", label: "EN" },
  { key: "ar", label: "عربي" },
  { key: "fr", label: "FR" },
] as const;

/**
 * A text in three languages (fields `<name>_en`, `<name>_ar`, `<name>_fr`). Only one language is required:
 * missing ones fall back to English on the site, and admins can add translations later.
 */
export function LocalizedField({
  name,
  label,
  initial,
  multiline = false,
  rows = 4,
  required = false,
  maxLength = 4000,
  hint,
}: {
  name: string;
  label: string;
  initial?: Partial<Record<"en" | "ar" | "fr", string>> | null;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  const t = useT();
  const [lang, setLang] = useState<"en" | "ar" | "fr">("en");
  const [vals, setVals] = useState<Record<string, string>>({ en: initial?.en ?? "", ar: initial?.ar ?? "", fr: initial?.fr ?? "" });
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="label !mb-0">
          {label}
          {required && " *"}
        </span>
        <div className="flex rounded-full bg-ink/[.05] p-0.5 text-xs">
          {LANGS.map((l) => (
            <button key={l.key} type="button" onClick={() => setLang(l.key)} className={`rounded-full px-2.5 py-1 font-semibold ${lang === l.key ? "bg-white shadow-sm" : "text-ink-muted"}`}>
              {l.label}
              {vals[l.key] ? "" : " ·"}
            </button>
          ))}
        </div>
      </div>
      {LANGS.map((l) =>
        multiline ? (
          <textarea
            key={l.key}
            name={`${name}_${l.key}`}
            value={vals[l.key]}
            onChange={(e) => setVals({ ...vals, [l.key]: e.target.value })}
            rows={rows}
            maxLength={maxLength}
            dir={l.key === "ar" ? "rtl" : "ltr"}
            className={`input ${lang === l.key ? "" : "hidden"}`}
          />
        ) : (
          <input
            key={l.key}
            name={`${name}_${l.key}`}
            value={vals[l.key]}
            onChange={(e) => setVals({ ...vals, [l.key]: e.target.value })}
            maxLength={maxLength}
            dir={l.key === "ar" ? "rtl" : "ltr"}
            className={`input ${lang === l.key ? "" : "hidden"}`}
          />
        ),
      )}
      <span className="mt-1 block text-xs text-ink-muted">{hint ?? t("Write in at least one language. Others are optional.")}</span>
    </div>
  );
}
