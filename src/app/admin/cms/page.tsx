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
      <Panel title={t("Hero video & headline")}>
        <ActionForm action={saveHeroAction} submit={t("Save hero")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <MediaInput name="videoId" kind="video" initial={hero.videoId} aspect="aspect-video" label={t("Hero video (MP4, compressed, ~10s loop)")} />
            <MediaInput name="posterId" initial={hero.posterUrl} aspect="aspect-video" label={t("Fallback image")} />
          </div>
          <label className="block">
            <span className="label">{t("…or a video URL (CDN)")}</span>
            <input name="videoUrl" defaultValue={hero.videoUrl} placeholder="https://…mp4" className="input" />
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
