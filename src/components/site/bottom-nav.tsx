"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Sparkles, Ticket, Heart, User } from "lucide-react";
import { useT } from "@/i18n/client";

export function BottomNav() {
  const t = useT();
  const path = usePathname();
  const items = [
    { href: "/", label: t("Explore"), icon: Compass, on: path === "/" || path.startsWith("/discover") },
    { href: "/activities", label: t("Activities"), icon: Sparkles, on: path.startsWith("/activities") || path.startsWith("/events") },
    { href: "/account/bookings", label: t("Bookings"), icon: Ticket, on: path.startsWith("/account/bookings") },
    { href: "/favorites", label: t("Favorites"), icon: Heart, on: path.startsWith("/favorites") },
    { href: "/account", label: t("Profile"), icon: User, on: path === "/account" || (path.startsWith("/account") && !path.startsWith("/account/bookings")) },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/[.08] bg-white/95 backdrop-blur-md lg:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, on }) => (
          <li key={href}>
            <Link href={href} className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${on ? "text-ink" : "text-ink-muted"}`}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${on ? "bg-mint" : ""}`}>
                <Icon className="h-[19px] w-[19px]" strokeWidth={on ? 2.4 : 1.9} />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
