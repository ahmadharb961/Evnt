import type { LegalPage } from "@/content/legal";
import type { Locale } from "@/i18n/core";

export function LegalView({ page, locale, updatedLabel }: { page: LegalPage; locale: Locale; updatedLabel: string }) {
  return (
    <article className="container-x max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.title[locale]}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {updatedLabel}: {page.updated}
      </p>
      <div className="prose-evnt mt-8">
        {page.sections.map((s, i) => (
          <section key={i} id={s.id}>
            <h2>{s.h[locale]}</h2>
            {s.p.map((p, j) => (
              <p key={j}>{p[locale]}</p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
