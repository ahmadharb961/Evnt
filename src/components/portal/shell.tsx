"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  LayoutDashboard, Store, CalendarDays, Armchair, Ticket, ScanLine, UtensilsCrossed, ShoppingBag, Package, Cake, Megaphone, BarChart3,
  CreditCard, Receipt, Star, Users, Settings, BadgeCheck, Zap, Home, Wallet, Scale, Crown, Languages, Calculator, FileText, Bell, Mail, Circle, Radar, ShieldCheck, ListOrdered, UserPlus, Shield, Sparkles,
} from "lucide-react";

import { TONES, type Tone } from "@/lib/tones";
export type { Tone };

const Icons = {
  LayoutDashboard, Store, CalendarDays, Armchair, Ticket, ScanLine, UtensilsCrossed, ShoppingBag, Package, Cake, Megaphone, BarChart3,
  CreditCard, Receipt, Star, Users, Settings, BadgeCheck, Zap, Home, Wallet, Scale, Crown, Languages, Calculator, FileText, Bell, Mail, Circle, Radar, ShieldCheck, ListOrdered, UserPlus, Shield, Sparkles,
};

export type NavItem = { href: string; label: string; icon: keyof typeof Icons; badge?: number; group?: string; tone?: Tone };


/** Shared shell for the merchant portal and the admin: sidebar on desktop, drawer on mobile. */
export function PortalShell({ title, subtitle, nav, children, topRight, banner }: { title: string; subtitle?: string; nav: NavItem[]; children: React.ReactNode; topRight?: React.ReactNode; banner?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const root = nav[0]?.href;
  const Nav = () => (
    <nav className="space-y-0.5">
      {nav.map((n, i) => {
        const Icon = (Icons[n.icon] ?? Icons.Circle) as React.ElementType;
        const on = n.href === root ? path === n.href : path === n.href || path.startsWith(n.href + "/");
        const tone = n.tone ? TONES[n.tone] : null;
        const heading = n.group && n.group !== nav[i - 1]?.group ? n.group : null;
        return (
          <div key={n.href}>
            {heading && <p className="px-3 pb-1.5 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted first:pt-1">{heading}</p>}
            <Link href={n.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-2xl px-2 py-1.5 text-sm font-medium transition ${on ? "bg-ink text-white shadow-card" : "text-ink-soft hover:bg-ink/5"}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${on ? "bg-white/15 text-white" : tone ? `${tone.soft} ${tone.text}` : "bg-canvas"}`}>
                <Icon className="h-[17px] w-[17px]" />
              </span>
              <span className="flex-1 truncate">{n.label}</span>
              {!!n.badge && <span className={`rounded-full px-1.5 text-[11px] font-bold ${on ? "bg-white text-ink" : "bg-rose-500 text-white"}`}>{n.badge}</span>}
            </Link>
          </div>
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

export function Stat({ label, value, hint, tone, icon, trend }: { label: string; value: React.ReactNode; hint?: string; tone?: Tone; icon?: keyof typeof Icons; trend?: number | null }) {
  const c = tone ? TONES[tone] : null;
  const Icon = icon ? (Icons[icon] as React.ElementType) : null;
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-ink/[.06] p-5 ${c ? c.soft : "bg-white"}`}>
      {c && <div aria-hidden className={`absolute -end-6 -top-6 h-20 w-20 rounded-full opacity-60 ${c.tile}`} />}
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-ink-soft">{label}</p>
        {Icon && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 shadow-sm ${c?.text ?? ""}`}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <p className="relative mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <div className="relative mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        {trend != null && <span className={`rounded-full px-1.5 py-0.5 font-bold ${trend >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%</span>}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

export function Panel({ title, subtitle, children, actions, className = "", icon, tone }: { title?: string; subtitle?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string; icon?: keyof typeof Icons; tone?: Tone }) {
  const Icon = icon ? (Icons[icon] as React.ElementType) : null;
  const c = tone ? TONES[tone] : null;
  return (
    <section className={`rounded-3xl border border-ink/[.06] bg-white p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${c ? `${c.soft} ${c.text}` : "bg-canvas"}`}>
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="font-semibold">{title}</h2>}
              {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
