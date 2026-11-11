import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/server/db";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { fmtDate } from "@/lib/dates";
import { alternates, appUrl } from "@/server/urls";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [a, locale] = await Promise.all([prisma.article.findUnique({ where: { slug } }), getLocale()]);
  if (!a || a.status !== "PUBLISHED") return {};
  return { title: loc(a.title, locale), description: loc(a.excerpt, locale), alternates: alternates(`/guides/${slug}`), openGraph: { images: [mediaSrc(a.coverId, a.coverUrl)] } };
}

/** Very small, safe text format: blank line = paragraph, "## " = heading, "- " = list item. No HTML. */
function Body({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="prose-evnt">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i}>{b.slice(3)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- ")))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const a = await prisma.article.findUnique({ where: { slug } });
  if (!a || a.status !== "PUBLISHED") notFound();
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: loc(a.title, locale), datePublished: a.publishedAt, image: appUrl() + mediaSrc(a.coverId, a.coverUrl), publisher: { "@type": "Organization", name: "EVNT" } };
  return (
    <article className="container-x max-w-3xl py-8 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href="/guides" className="text-sm text-ink-muted">
        ← {t("Family guides")}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{loc(a.title, locale)}</h1>
      {a.publishedAt && <p className="mt-2 text-sm text-ink-muted">{fmtDate(a.publishedAt, locale, { day: "numeric", month: "long", year: "numeric" })}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaSrc(a.coverId, a.coverUrl)} alt="" className="mt-6 aspect-[16/9] w-full rounded-4xl object-cover" />
      <div className="mt-8 text-[17px]">
        <Body text={loc(a.body, locale)} />
      </div>
    </article>
  );
}
