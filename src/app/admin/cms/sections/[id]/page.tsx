import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc, type Localized } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { LocalizedField } from "@/components/localized-field";
import { MediaInput } from "@/components/uploader";
import { saveSectionAction } from "@/actions/admin";
import { AREAS } from "@/lib/areas";

export const metadata = { title: "Section" };

type F = { categorySlug?: string; ageMin?: number; ageMax?: number; area?: string; maxPriceCents?: number; free?: boolean; weekend?: boolean; setting?: string; sort?: string };
const dt = (d: Date | null | undefined) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export default async function SectionEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin("CONTENT", "ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const s = id === "new" ? null : await prisma.homeSection.findUnique({ where: { id } });
  if (id !== "new" && !s) notFound();
  const cats = await prisma.category.findMany({ where: { active: true }, orderBy: [{ parentId: "asc" }, { sort: "asc" }] });
  const f = (s?.filters ?? {}) as F;
  return (
    <div className="max-w-3xl">
      <PageHeader title={s ? loc(s.title, locale) : t("New section")} />
      <ActionForm action={saveSectionAction} hidden={s ? { id: s.id } : undefined} submit={t("Save section")} className="space-y-6">
        <Panel title={t("Title & call to action")}>
          <div className="space-y-4">
            <LocalizedField name="title" label={t("Title")} initial={(s?.title ?? {}) as Localized} required />
            <LocalizedField name="subtitle" label={t("Subtitle (optional)")} initial={(s?.subtitle ?? {}) as Localized} />
            <div className="grid gap-4 sm:grid-cols-2">
              <LocalizedField name="cta" label={t("'See all' text (optional)")} initial={(s?.ctaText ?? {}) as Localized} />
              <label className="block">
                <span className="label">{t("'See all' link")}</span>
                <input name="ctaHref" defaultValue={s?.ctaHref ?? ""} placeholder="/discover?when=weekend" className="input" />
              </label>
            </div>
            <MediaInput name="bannerId" initial={s?.bannerId ?? s?.bannerUrl} aspect="aspect-[5/1]" label={t("Banner image (optional)")} />
          </div>
        </Panel>
        <Panel title={t("Content")}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="label">{t("Shows")}</span>
                <select name="source" defaultValue={s?.source ?? "EVENTS"} className="input">
                  <option value="EVENTS">{t("Activities & events")}</option>
                  <option value="RESTAURANTS">{t("Restaurants")}</option>
                  <option value="PRODUCTS">{t("Products")}</option>
                  <option value="FARAH">{t("Farah Approved")}</option>
                  <option value="SPONSORED">{t("Paid featured placements")}</option>
                </select>
              </label>
              <label className="block">
                <span className="label">{t("Selection")}</span>
                <select name="mode" defaultValue={s?.mode ?? "AUTO"} className="input">
                  <option value="AUTO">{t("Automatic (filters)")}</option>
                  <option value="MANUAL">{t("Hand-picked (IDs below)")}</option>
                </select>
              </label>
              <label className="block">
                <span className="label">{t("Layout")}</span>
                <select name="layout" defaultValue={s?.layout ?? "CAROUSEL"} className="input">
                  <option value="CAROUSEL">{t("Carousel")}</option>
                  <option value="GRID">{t("Grid")}</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="label">{t("Hand-picked listing IDs (comma separated, in order)")}</span>
              <textarea name="itemIds" rows={2} defaultValue={s?.itemIds.join(", ") ?? ""} className="input font-mono text-xs" />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="label">{t("Category")}</span>
                <select name="categorySlug" defaultValue={f.categorySlug ?? ""} className="input">
                  <option value="">{t("Any")}</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.parentId ? "— " : ""}
                      {loc(c.name, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">{t("Area")}</span>
                <select name="area" defaultValue={f.area ?? ""} className="input">
                  <option value="">{t("Any")}</option>
                  {AREAS.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a[locale]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">{t("Sort")}</span>
                <select name="sort" defaultValue={f.sort ?? ""} className="input">
                  <option value="">{t("Recommended")}</option>
                  <option value="soonest">{t("Soonest")}</option>
                  <option value="popular">{t("Most popular")}</option>
                  <option value="newest">{t("Newest")}</option>
                  <option value="rating">{t("Top rated")}</option>
                  <option value="price">{t("Lowest price")}</option>
                </select>
              </label>
              <label className="block">
                <span className="label">{t("Min age")}</span>
                <input name="ageMin" type="number" min={0} max={16} defaultValue={f.ageMin ?? ""} className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Max age")}</span>
                <input name="ageMax" type="number" min={0} max={16} defaultValue={f.ageMax ?? ""} className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Max price (USD)")}</span>
                <input name="maxPrice" inputMode="decimal" defaultValue={f.maxPriceCents != null ? f.maxPriceCents / 100 : ""} className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Indoor / outdoor")}</span>
                <select name="setting" defaultValue={f.setting ?? ""} className="input">
                  <option value="">{t("Any")}</option>
                  <option value="INDOOR">{t("Indoor")}</option>
                  <option value="OUTDOOR">{t("Outdoor")}</option>
                </select>
              </label>
              <label className="block">
                <span className="label">{t("How many")}</span>
                <input name="limit" type="number" min={1} max={40} defaultValue={s?.limit ?? 12} className="input" />
              </label>
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="free" defaultChecked={f.free} className="accent-ink" />
                {t("Free only")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="weekend" defaultChecked={f.weekend} className="accent-ink" />
                {t("This weekend only")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="sponsored" defaultChecked={s?.sponsored} className="accent-ink" />
                {t("Label as sponsored")}
              </label>
            </div>
          </div>
        </Panel>
        <Panel title={t("Visibility & schedule")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="visible" defaultChecked={s ? s.visible : true} className="accent-ink" />
              {t("Visible")}
            </label>
            <label className="block">
              <span className="label">{t("Start (optional)")}</span>
              <input name="startsAt" type="datetime-local" defaultValue={dt(s?.startsAt)} className="input" />
            </label>
            <label className="block">
              <span className="label">{t("End (optional)")}</span>
              <input name="endsAt" type="datetime-local" defaultValue={dt(s?.endsAt)} className="input" />
            </label>
          </div>
        </Panel>
      </ActionForm>
    </div>
  );
}
