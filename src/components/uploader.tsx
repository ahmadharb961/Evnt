"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X, Film } from "lucide-react";
import { useT } from "@/i18n/client";

async function upload(file: File, kind: "image" | "video") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Upload failed");
  return json.id as string;
}

/** Single image/video picker that stores the media id in a hidden input named `name`. */
export function MediaInput({ name, initial, kind = "image", aspect = "aspect-[4/3]", label }: { name: string; initial?: string | null; kind?: "image" | "video"; aspect?: string; label?: string }) {
  const t = useT();
  const [id, setId] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const src = id ? (id.startsWith("/") || id.startsWith("http") ? id : `/media/${id}`) : "";
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <input type="hidden" name={name} value={id} />
      <div className={`relative ${aspect} overflow-hidden rounded-3xl border border-dashed border-ink/20 bg-canvas`}>
        {src ? (
          kind === "video" ? (
            <video src={src} className="h-full w-full object-cover" muted playsInline controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <button type="button" onClick={() => ref.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-ink-muted">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : kind === "video" ? <Film className="h-6 w-6" /> : <ImagePlus className="h-6 w-6" />}
            {kind === "video" ? t("Upload a video (MP4, max 35 MB)") : t("Upload a photo")}
          </button>
        )}
        {src && (
          <div className="absolute end-2 top-2 flex gap-1.5">
            <button type="button" onClick={() => ref.current?.click()} className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold shadow">
              {t("Replace")}
            </button>
            <button type="button" onClick={() => setId("")} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow" aria-label={t("Remove")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept={kind === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp"}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          setErr("");
          try {
            setId(await upload(f, kind));
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

/** Several images; ids stored as a comma-separated hidden input. */
export function GalleryInput({ name, initial = [], max = 10 }: { name: string; initial?: string[]; max?: number }) {
  const t = useT();
  const [ids, setIds] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const src = (id: string) => (id.startsWith("/") || id.startsWith("http") ? id : `/media/${id}`);
  return (
    <div>
      <input type="hidden" name={name} value={ids.join(",")} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {ids.map((id) => (
          <div key={id} className="relative aspect-square overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(id)} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => setIds(ids.filter((x) => x !== id))} className="absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90" aria-label={t("Remove")}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {ids.length < max && (
          <button type="button" onClick={() => ref.current?.click()} className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-ink/20 bg-canvas text-ink-muted">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []).slice(0, max - ids.length);
          e.target.value = "";
          setBusy(true);
          setErr("");
          try {
            const out: string[] = [];
            for (const f of files) out.push(await upload(f, "image"));
            setIds((x) => [...x, ...out]);
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
