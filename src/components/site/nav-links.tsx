"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBox } from "@/components/site/search-box";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {items.map((i) => {
        const on = path === i.href || path.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${on ? "bg-ink/[.06] text-ink" : "text-ink-soft hover:text-ink"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile search under the header, except on pages that have their own big search (home). */
export function MobileSearchRow() {
  const path = usePathname();
  if (path === "/" || path === "/discover") return null;
  return (
    <div className="container-x pb-3 md:hidden">
      <SearchBox compact />
    </div>
  );
}
