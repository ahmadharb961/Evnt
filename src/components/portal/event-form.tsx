import type { Event, EventMedia } from "@prisma/client";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc, type Localized } from "@/i18n/core";
import { saveEventAction } from "@/actions/merchant-events";
import { ActionForm } from "@/components/portal/action-form";
import { LocalizedField } from "@/components/localized-field";
import { GalleryInput, MediaInput } from "@/components/uploader";
import { Panel } from "@/components/portal/shell";
import { areaName } from "@/lib/areas";

const L = (v: unknown) => (v ?? {}) as Localized;

export async function EventForm({ merchantId, event }: { merchantId: string; event?: Event & { media: EventMedia[] } }) {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const [cats, locations, maps] = await Promise.all([
    prisma.category.findMany({ where: { kind: "EVENT", active: true }, include: { parent: true }, orderBy: [{ parentId: "asc" }, { sort: "asc" }] }),
    prisma.merchantLocation.findMany({ where: { merchantId } }),
    prisma.seatingMap.findMany({ where: { merchantId }, include: { _count: { select: { seats: true } } } }),
  ]);
  const subs = cats.filter((c) => c.parentId);
  const tops = cats.filter((c) => !c.parentId);
  const e = event;
  return (
    <ActionForm action={saveEventAction} hidden={e ? { id: e.id } : undefined} submit={e ? t("Save changes") : t("Create and continue")} className="space-y-6">
      <Panel title={t("Basics")}>
        <div className="space-y-5">
          <LocalizedField name="title" label={t("Title")} initial={L(e?.title)} required maxLength={120} />
          <LocalizedField name="summary" label={t("Short summary")} initial={L(e?.summary)} maxLength={200} hint={t("One sentence shown under the title.")} />
          <label className="block">
            <span className="label">{t("Category")}</span>
            <select name="categoryId" defaultValue={e?.categoryId ?? ""} required className="input">
              <option value="" disabled>
                {t("Choose…")}
              </option>
              {tops.map((top) => (
                <optgroup key={top.id} label={loc(top.name, locale)}>
                  <option value={top.id}>{loc(top.name, locale)}</option>
                  {subs
                    .filter((s) => s.parentId === top.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {loc(s.name, locale)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="label">{t("Youngest age")}</span>
              <input name="ageMin" type="number" min={0} max={16} defaultValue={e?.ageMin ?? 3} className="input" />
            </label>
            <label className="block">
              <span className="label">{t("Oldest age")}</span>
              <input name="ageMax" type="number" min={0} max={16} defaultValue={e?.ageMax ?? 12} className="input" />
            </label>
            <label className="block">
              <span className="label">{t("Setting")}</span>
              <select name="setting" defaultValue={e?.setting ?? "INDOOR"} className="input">
                <option value="INDOOR">{t("Indoor")}</option>
                <option value="OUTDOOR">{t("Outdoor")}</option>
                <option value="BOTH">{t("Indoor & outdoor")}</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="label">{t("Location")}</span>
            <select name="locationId" defaultValue={e?.locationId ?? locations[0]?.id ?? ""} className="input">
              <option value="">{t("No fixed location")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {areaName(l.area, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      <Panel title={t("Photos & video")}>
        <div className="space-y-4">
          <MediaInput name="coverId" initial={e?.coverId ?? e?.coverUrl} aspect="aspect-[16/9]" label={t("Cover photo")} />
          <div>
            <span className="label">{t("Gallery")}</span>
            <GalleryInput name="gallery" initial={e?.media.map((m) => m.mediaId ?? m.url ?? "").filter(Boolean)} />
          </div>
          <label className="block">
            <span className="label">{t("Video link (optional)")}</span>
            <input name="videoUrl" defaultValue={e?.videoUrl ?? ""} placeholder="https://…mp4" className="input" />
          </label>
        </div>
      </Panel>

      <Panel title={t("Description")}>
        <div className="space-y-5">
          <LocalizedField name="description" label={t("What parents should know")} initial={L(e?.description)} multiline rows={6} />
          <LocalizedField name="included" label={t("What's included (one per line)")} initial={L(e?.included)} multiline rows={3} />
          <LocalizedField name="importantInfo" label={t("Important information")} initial={L(e?.importantInfo)} multiline rows={3} />
          <LocalizedField name="cancellationPolicy" label={t("Cancellation policy")} initial={L(e?.cancellationPolicy)} multiline rows={3} hint={t("Leave empty to use EVNT's standard policy (free cancellation up to 48h before).")} />
        </div>
      </Panel>

      <Panel title={t("Booking options")}>
        <div className="space-y-4">
          <div>
            <span className="label">{t("How do parents choose places?")}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink/10 p-4 has-[:checked]:border-ink has-[:checked]:ring-2 has-[:checked]:ring-ink">
                <input type="radio" name="seatingMode" value="GENERAL" defaultChecked={(e?.seatingMode ?? "GENERAL") === "GENERAL"} className="mt-1 accent-ink" />
                <span>
                  <span className="block text-sm font-semibold">{t("Ticket quantities")}</span>
                  <span className="text-xs text-ink-muted">{t("Fastest checkout. Best for most activities.")}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-ink/10 p-4 has-[:checked]:border-ink has-[:checked]:ring-2 has-[:checked]:ring-ink">
                <input type="radio" name="seatingMode" value="ASSIGNED" defaultChecked={e?.seatingMode === "ASSIGNED"} className="mt-1 accent-ink" disabled={!maps.length} />
                <span>
                  <span className="block text-sm font-semibold">{t("Seat or spot selection")}</span>
                  <span className="text-xs text-ink-muted">{maps.length ? t("Parents pick seats, tables or stations on your map.") : t("Create a seating map first.")}</span>
                </span>
              </label>
            </div>
          </div>
          {maps.length > 0 && (
            <label className="block">
              <span className="label">{t("Seating map")}</span>
              <select name="seatingMapId" defaultValue={e?.seatingMapId ?? ""} className="input">
                <option value="">{t("Choose…")}</option>
                {maps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({t("{n} places", { n: m._count.seats })})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="payAtVenue" defaultChecked={e?.payAtVenue} className="h-4 w-4 accent-ink" />
            {t("Allow reservations paid at the venue")}
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="memberEarlyAccess" defaultChecked={e?.memberEarlyAccess} className="h-4 w-4 accent-ink" />
            {t("Give EVNT+ members 48-hour early access (when a sales date is set)")}
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="accessible" defaultChecked={e?.accessible} className="h-4 w-4 accent-ink" />
            {t("Wheelchair accessible")}
          </label>
        </div>
      </Panel>
    </ActionForm>
  );
}
