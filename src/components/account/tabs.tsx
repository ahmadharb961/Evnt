"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AccountTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-ink/[.06] px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
      {tabs.map((t) => {
        const on = t.href === "/account" ? path === "/account" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`shrink-0 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition ${on ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
