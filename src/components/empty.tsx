import Link from "next/link";
import { SearchX } from "lucide-react";

export function EmptyState({ title, body, cta, icon: Icon = SearchX }: { title: string; body?: string; cta?: { href: string; label: string }; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center rounded-4xl bg-canvas px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-powder-soft">
        <Icon className="h-6 w-6 text-powder-deep" />
      </span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>}
      {cta && (
        <Link href={cta.href} className="btn-primary mt-6">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function Pager({ page, total, perPage, hrefFor, t }: { page: number; total: number; perPage: number; hrefFor: (p: number) => string; t: (s: string, v?: Record<string, string | number>) => string }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <nav className="mt-10 flex items-center justify-center gap-3" aria-label={t("Pages")}>
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className="btn-outline">
          {t("Previous")}
        </Link>
      )}
      <span className="text-sm text-ink-muted">{t("Page {p} of {n}", { p: page, n: pages })}</span>
      {page < pages && (
        <Link href={hrefFor(page + 1)} className="btn-outline">
          {t("Next")}
        </Link>
      )}
    </nav>
  );
}
