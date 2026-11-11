import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
      {items.map((i, k) => (
        <span key={k} className="inline-flex items-center gap-1">
          {k > 0 && <ChevronRight className="h-3 w-3 rtl:rotate-180" />}
          {i.href ? (
            <Link href={i.href} className="hover:text-ink">
              {i.label}
            </Link>
          ) : (
            <span className="text-ink-soft">{i.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function SubcategoryChips({ items, active }: { items: { slug: string; name: string; href: string }[]; active?: string }) {
  if (!items.length) return null;
  return (
    <div className="mt-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {items.map((c) => (
        <Link key={c.slug} href={c.href} className={`chip shrink-0 ${active === c.slug ? "chip-on" : ""}`}>
          {c.name}
        </Link>
      ))}
    </div>
  );
}
