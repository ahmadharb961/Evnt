"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  LayoutDashboard, Store, CalendarDays, Armchair, Ticket, ScanLine, UtensilsCrossed, ShoppingBag, Package, Cake, Megaphone, BarChart3,
  CreditCard, Receipt, Star, Users, Settings, BadgeCheck, Zap, Home, Wallet, Scale, Crown, Languages, Calculator, FileText, Bell, Mail, Circle, Radar, ShieldCheck,
} from "lucide-react";

const Icons = {
  LayoutDashboard, Store, CalendarDays, Armchair, Ticket, ScanLine, UtensilsCrossed, ShoppingBag, Package, Cake, Megaphone, BarChart3,
  CreditCard, Receipt, Star, Users, Settings, BadgeCheck, Zap, Home, Wallet, Scale, Crown, Languages, Calculator, FileText, Bell, Mail, Circle, Radar, ShieldCheck,
};

export type NavItem = { href: string; label: string; icon: keyof typeof Icons; badge?: number };

/** Shared shell for the merchant portal and the admin: sidebar on desktop, drawer on mobile. */
export function PortalShell({ title, subtitle, nav, children, topRight, banner }: { title: string; subtitle?: string; nav: NavItem[]; children: React.ReactNode; topRight?: React.ReactNode; banner?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const root = nav[0]?.href;
  const Nav = () => (
    <nav className="space-y-0.5">
      {nav.map((n) => {
        const Icon = (Icons[n.icon] ?? Icons.Circle) as React.ElementType;
        const on = n.href === root ? path === n.href : path === n.href || path.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? "bg-ink text-white" : "text-ink-soft hover:bg-ink/5"}`}>
            <Icon className="h-[18px] w-[18px]" />
            <span className="flex-1">{n.label}</span>
            {!!n.badge && <span className={`rounded-full px-1.5 text-[11px] font-bold ${on ? "bg-white text-ink" : "bg-peach text-peach-deep"}`}>{n.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 start-0 hidden w-64 flex-col border-e border-ink/[.06] bg-white p-4 lg:flex">
        <Link href="/" className="mb-1 px-2 pt-1">
          <Logo />
        </Link>
        <div className="mb-5 px-2">
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <Nav />
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink/[.06] bg-white/90 px-4 backdrop-blur lg:ms-64 lg:px-8">
        <button type="button" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <p className="truncate text-sm font-semibold lg:hidden">{title}</p>
        <div className="ms-auto flex items-center gap-2">
          {topRight}
          <LanguageSwitcher compact />
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-72 animate-fade-in overflow-y-auto bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 px-2 text-sm font-semibold">{title}</p>
            <Nav />
          </div>
        </div>
      )}
      <main className="px-4 py-6 lg:ms-64 lg:px-8 lg:py-8">
        {banner}
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-3xl border border-ink/[.06] bg-white p-5">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Panel({ title, children, actions, className = "" }: { title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-ink/[.06] bg-white p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
