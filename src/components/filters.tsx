"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X, MapPin, List, Map as MapIcon, LocateFixed } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import { AGE_BANDS, AREAS } from "@/lib/areas";

type Opt = { value: string; label: string };

function useParamNav() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const set = (changes: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    q.delete("page");
    q.delete("lang");
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    router.push(path + (s ? `?${s}` : ""), { scroll: false });
  };
  return { params, set };
}

/** Quick chips (date, age, price) + a full filter sheet. Every change updates the URL (shareable, back-button friendly). */
export function EventFilterBar({ showType = false, showView = true }: { showType?: boolean; showView?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const { params, set } = useParamNav();
  const [open, setOpen] = useState(false);
  const get = (k: string) => params.get(k) ?? "";

  const when: Opt[] = [
    { value: "today", label: t("Today") },
    { value: "tomorrow", label: t("Tomorrow") },
    { value: "weekend", label: t("This weekend") },
    { value: "week", label: t("Next 7 days") },
  ];
  const ages: Opt[] = AGE_BANDS.map((b) => ({ value: b.key, label: t("{a}–{b} yrs", { a: b.min, b: b.max }) }));
  const activeCount = ["area", "setting", "rating", "farah", "accessible", "maxPrice", "near", "soldout"].filter((k) => get(k)).length;

  const Chip = ({ k, o }: { k: string; o: Opt }) => {
    const on = get(k) === o.value;
    return (
      <button type="button" onClick={() => set({ [k]: on ? null : o.value })} className={`chip ${on ? "chip-on" : ""}`} aria-pressed={on}>
        {o.label}
      </button>
    );
  };

  return (
    <div>
      {showType && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {[
            { value: "", label: t("All") },
            { value: "activities", label: t("Activities") },
            { value: "restaurants", label: t("Restaurants") },
            { value: "shop", label: t("Shop") },
          ].map((o) => {
            const on = get("type") === o.value;
            return (
              <button key={o.value} type="button" onClick={() => set({ type: o.value || null })} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${on ? "bg-ink text-white" : "bg-ink/[.05] text-ink-soft hover:bg-ink/10"}`}>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <button type="button" onClick={() => setOpen(true)} className={`chip shrink-0 ${activeCount ? "chip-on" : ""}`}>
          <SlidersHorizontal className="h-4 w-4" />
          {t("Filters")}
          {activeCount > 0 && <span className="rounded-full bg-white px-1.5 text-[11px] font-bold text-ink">{activeCount}</span>}
        </button>
        {when.map((o) => (
          <Chip key={o.value} k="when" o={o} />
        ))}
        <span className="mx-1 h-6 w-px shrink-0 bg-ink/10" />
        {ages.map((o) => (
          <Chip key={o.value} k="age" o={o} />
        ))}
        <span className="mx-1 h-6 w-px shrink-0 bg-ink/10" />
        <Chip k="price" o={{ value: "free", label: t("Free") }} />
        {showView && (
          <div className="ms-auto flex shrink-0 rounded-full border border-ink/10 p-0.5">
            <button type="button" onClick={() => set({ view: null })} aria-label={t("List view")} className={`flex h-8 w-9 items-center justify-center rounded-full ${get("view") !== "map" ? "bg-ink text-white" : ""}`}>
              <List className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => set({ view: "map" })} aria-label={t("Map view")} className={`flex h-8 w-9 items-center justify-center rounded-full ${get("view") === "map" ? "bg-ink text-white" : ""}`}>
              <MapIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={() => setOpen(false)}>
          <div className="max-h-[88dvh] w-full animate-sheet-up overflow-y-auto rounded-t-4xl bg-white p-6 sm:max-w-lg sm:rounded-4xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("Filters")}</h2>
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink/5" aria-label={t("Close")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <p className="label">{t("Location")}</p>
                <select value={get("area")} onChange={(e) => set({ area: e.target.value || null })} className="input">
                  <option value="">{t("All of Lebanon")}</option>
                  {AREAS.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a[locale]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft"
                  onClick={() =>
                    navigator.geolocation?.getCurrentPosition(
                      (p) => set({ near: `${p.coords.latitude.toFixed(4)},${p.coords.longitude.toFixed(4)}`, sort: "distance", area: null }),
                      () => alert(t("We couldn't get your location. Please choose an area instead.")),
                      { timeout: 8000 },
                    )
                  }
                >
                  <LocateFixed className="h-4 w-4" />
                  {get("near") ? t("Sorted by distance from you") : t("Use my location")}
                </button>
                {get("near") && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["5", "10", "25"].map((km) => (
                      <button key={km} type="button" onClick={() => set({ km: get("km") === km ? null : km })} className={`chip ${get("km") === km ? "chip-on" : ""}`}>
                        <MapPin className="h-3.5 w-3.5" />
                        {t("Within {n} km", { n: km })}
                      </button>
                    ))}
                    <button type="button" onClick={() => set({ near: null, km: null, sort: null })} className="chip">
                      {t("Clear location")}
                    </button>
                  </div>
                )}
              </div>
              <div>
                <p className="label">{t("Date")}</p>
                <input type="date" value={/^\d{4}-/.test(get("when")) ? get("when") : ""} onChange={(e) => set({ when: e.target.value || null })} className="input" />
              </div>
              <div>
                <p className="label">{t("Maximum price")}</p>
                <div className="flex flex-wrap gap-2">
                  {["10", "20", "50", "100"].map((v) => (
                    <button key={v} type="button" onClick={() => set({ maxPrice: get("maxPrice") === v ? null : v })} className={`chip ${get("maxPrice") === v ? "chip-on" : ""}`}>
                      {t("Under ${n}", { n: v })}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="label">{t("Indoor or outdoor")}</p>
                <div className="flex gap-2">
                  {[
                    { value: "indoor", label: t("Indoor") },
                    { value: "outdoor", label: t("Outdoor") },
                  ].map((o) => (
                    <button key={o.value} type="button" onClick={() => set({ setting: get("setting") === o.value ? null : o.value })} className={`chip ${get("setting") === o.value ? "chip-on" : ""}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="label">{t("Rating")}</p>
                <div className="flex gap-2">
                  {["4", "4.5"].map((v) => (
                    <button key={v} type="button" onClick={() => set({ rating: get("rating") === v ? null : v })} className={`chip ${get("rating") === v ? "chip-on" : ""}`}>
                      ★ {v}+
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { k: "farah", label: t("Farah Approved only") },
                  { k: "accessible", label: t("Wheelchair accessible") },
                  { k: "soldout", label: t("Show sold-out listings") },
                ].map((o) => (
                  <label key={o.k} className="flex items-center justify-between gap-3 text-sm">
                    {o.label}
                    <input type="checkbox" checked={get(o.k) === "1"} onChange={(e) => set({ [o.k]: e.target.checked ? "1" : null })} className="h-5 w-5 accent-ink" />
                  </label>
                ))}
              </div>
              <div>
                <p className="label">{t("Sort by")}</p>
                <select value={get("sort")} onChange={(e) => set({ sort: e.target.value || null })} className="input">
                  <option value="">{t("Recommended")}</option>
                  <option value="soonest">{t("Soonest")}</option>
                  <option value="popular">{t("Most popular")}</option>
                  <option value="rating">{t("Top rated")}</option>
                  <option value="price">{t("Lowest price")}</option>
                  <option value="newest">{t("Newest")}</option>
                  {get("near") && <option value="distance">{t("Nearest")}</option>}
                </select>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                className="btn-outline flex-1"
                onClick={() => {
                  set({ area: null, setting: null, rating: null, farah: null, accessible: null, maxPrice: null, near: null, km: null, soldout: null, sort: null, when: null, age: null, price: null });
                  setOpen(false);
                }}
              >
                {t("Clear all")}
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => setOpen(false)}>
                {t("Show results")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
