import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getSetting } from "@/server/settings";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { SectionList } from "@/components/admin/section-list";
import { ActionForm } from "@/components/portal/action-form";
import { LocalizedField } from "@/components/localized-field";
import { MediaInput } from "@/components/uploader";
import { saveHeroAction } from "@/actions/admin";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Homepage & content" };

export default async function CmsPage() {
  await requireAdmin("CONTENT", "ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const [sections, hero] = await Promise.all([prisma.homeSection.findMany({ orderBy: { sort: "asc" } }), getSetting("hero")]);
  const now = new Date();
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={t("Homepage & content")}
        actions={
          <>
            <Link href="/admin/cms/categories" className="btn-outline btn-sm">
              {t("Categories")}
            </Link>
            <Link href="/" target="_blank" className="btn-outline btn-sm">
              {t("View homepage")}
            </Link>
          </>
        }
      />
      <Panel
        title={t("Homepage sections")}
        actions={
          <Link href="/admin/cms/sections/new" className="btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            {t("New section")}
          </Link>
        }
      >
        <p className="mb-4 text-sm text-ink-muted">{t("Drag to reorder. Changes are live immediately. Sections with no matching listings are hidden automatically.")}</p>
        <SectionList
          rows={sections.map((s) => ({
            id: s.id,
            title: loc(s.title, locale),
            source: s.source,
            visible: s.visible,
            sponsored: s.sponsored,
            scheduled:
              s.startsAt && s.startsAt > now
                ? t("starts {date}", { date: fmtDate(s.startsAt, locale, { day: "numeric", month: "short" }) })
                : s.endsAt
                  ? s.endsAt < now
                    ? t("expired")
                    : t("until {date}", { date: fmtDate(s.endsAt, locale, { day: "numeric", month: "short" }) })
                  : null,
          }))}
        />
      </Panel>
      <Panel title={t("Hero banner")}>
        <ActionForm action={saveHeroAction} submit={t("Save hero")}>
          <fieldset>
            <legend className="label">{t("Banner type")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["VIDEO", t("Video banner"), t("A muted, looping video. The photo shows while it loads, and for visitors who prefer reduced motion or save data.")],
                  ["IMAGE", t("Photo banner"), t("A still photo only. Lighter and faster on slow connections.")],
                ] as const
              ).map(([v, label, help]) => (
                <label key={v} className="flex cursor-pointer gap-3 rounded-2xl border border-ink/10 p-4 has-[:checked]:border-ink has-[:checked]:bg-canvas">
                  <input type="radio" name="mode" value={v} defaultChecked={(hero.mode ?? "VIDEO") === v} className="mt-1 accent-ink" />
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <MediaInput name="photoId" initial={hero.photoUrl} aspect="aspect-video" label={t("Banner photo (Photo banner)")} />
            <MediaInput name="videoId" kind="video" initial={hero.videoId} aspect="aspect-video" label={t("Upload a video (MP4, under 35 MB, 10–20s loop)")} />
            <MediaInput name="posterId" initial={hero.posterUrl} aspect="aspect-video" label={t("Video loading image")} />
          </div>
          <label className="block">
            <span className="label">{t("…or a video link")}</span>
            <input name="videoUrl" defaultValue={hero.videoUrl} placeholder="/brand/hero.mp4 · https://…mp4" className="input" />
            <span className="mt-1 block text-xs text-ink-muted">{t("An uploaded video takes priority over the link. Clear both to fall back to the photo.")}</span>
          </label>
          <LocalizedField name="headline" label={t("Headline")} initial={hero.headline} />
          <LocalizedField name="subline" label={t("Supporting text")} initial={hero.subline} multiline rows={2} />
          <div className="grid gap-4 sm:grid-cols-2">
            <LocalizedField name="cta" label={t("Button text")} initial={hero.ctaText} />
            <label className="block">
              <span className="label">{t("Button link")}</span>
              <input name="ctaHref" defaultValue={hero.ctaHref} className="input" />
            </label>
          </div>
        </ActionForm>
      </Panel>
    </div>
  );
}
