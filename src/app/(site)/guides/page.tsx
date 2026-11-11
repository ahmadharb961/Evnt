import Link from "next/link";
import { BookOpen } from "lucide-react";
import { prisma } from "@/server/db";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { EmptyState } from "@/components/empty";
import { fmtDate } from "@/lib/dates";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Family guides"), description: t("Ideas and guides for things to do with kids in Lebanon."), alternates: alternates("/guides") };
}

export default async function GuidesPage() {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const articles = await prisma.article.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } });
  return (
    <div className="container-x py-8 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Family guides")}</h1>
      <p className="mt-2 text-ink-muted">{t("Ideas, tips and roundups for Lebanese families.")}</p>
      {!articles.length ? (
        <div className="mt-8">
          <EmptyState icon={BookOpen} title={t("Guides are coming soon")} cta={{ href: "/discover", label: t("Explore activities") }} />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <Link key={a.id} href={`/guides/${a.slug}`} className="group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaSrc(a.coverId, a.coverUrl)} alt="" className="aspect-[16/10] w-full rounded-3xl object-cover" loading="lazy" />
              <p className="mt-3 text-xs text-ink-muted">{a.publishedAt ? fmtDate(a.publishedAt, locale, { day: "numeric", month: "long", year: "numeric" }) : ""}</p>
              <h2 className="mt-1 text-lg font-bold group-hover:underline">{loc(a.title, locale)}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{loc(a.excerpt, locale)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
