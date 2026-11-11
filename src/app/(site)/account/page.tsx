import Link from "next/link";
import { Ticket, ShoppingBag, Heart, Crown, Gift, Sparkles, LogOut, Store, Shield } from "lucide-react";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { isMember, pointsBalance } from "@/server/membership";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { fmtDateTime } from "@/lib/dates";
import { logoutAction } from "@/actions/auth";

export const metadata = { title: "My account", robots: { index: false } };

export default async function AccountHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser("/account");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const [next, member, points, orders, favs, staff, family] = await Promise.all([
    prisma.booking.findFirst({ where: { userId: user.id, status: { in: ["CONFIRMED", "RESERVED_PAY_AT_VENUE"] }, session: { startsAt: { gt: new Date() } } }, include: { event: true, session: true }, orderBy: { session: { startsAt: "asc" } } }),
    isMember(user.id),
    pointsBalance(user.id),
    prisma.order.count({ where: { group: { userId: user.id }, status: { in: ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"] } } }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.merchantStaff.count({ where: { userId: user.id } }),
    prisma.familyProfile.findUnique({ where: { userId: user.id } }),
  ]);
  return (
    <div className="space-y-6">
      {sp.welcome && <p className="rounded-3xl bg-mint-soft p-4 text-sm font-medium text-mint-deep">{t("Welcome to EVNT! Tell us your kids' ages to get better suggestions.")}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("Hi {name}", { name: user.name.split(" ")[0] })}</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {staff > 0 && (
            <Link href="/merchant" className="btn-outline btn-sm">
              <Store className="h-4 w-4" />
              {t("Business dashboard")}
            </Link>
          )}
          {user.roles.length > 0 && (
            <Link href="/admin" className="btn-outline btn-sm">
              <Shield className="h-4 w-4" />
              {t("Admin")}
            </Link>
          )}
          <form action={logoutAction}>
            <button className="btn-ghost btn-sm">
              <LogOut className="h-4 w-4" />
              {t("Sign out")}
            </button>
          </form>
        </div>
      </div>

      {next && (
        <Link href={`/account/bookings/${next.code}`} className="card flex items-center gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaSrc(next.event.coverId, next.event.coverUrl)} alt="" className="h-16 w-20 rounded-2xl object-cover" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mint-deep">{t("Next up")}</p>
            <p className="font-semibold">{loc(next.event.title, locale)}</p>
            <p className="text-sm text-ink-muted">{fmtDateTime(next.session.startsAt, locale)}</p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/account/bookings", icon: Ticket, label: t("Bookings & tickets") },
          { href: "/account/orders", icon: ShoppingBag, label: t("Orders"), n: orders },
          { href: "/favorites", icon: Heart, label: t("Favorites"), n: favs },
          { href: "/plus", icon: Crown, label: member ? t("EVNT+ member") : t("Join EVNT+") },
        ].map((x) => (
          <Link key={x.href} href={x.href} className="card p-4 hover:shadow-lift">
            <x.icon className="h-5 w-5" />
            <p className="mt-3 text-sm font-semibold">{x.label}</p>
            {!!x.n && <p className="text-xs text-ink-muted">{x.n}</p>}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-gradient-to-br from-peach-soft to-blush-soft p-5">
          <Gift className="h-5 w-5" />
          <p className="mt-3 text-2xl font-bold">{t("{n} points", { n: points })}</p>
          <p className="text-sm text-ink-soft">{member ? t("You earn double points as an EVNT+ member.") : t("Earn 1 point per dollar on bookings and orders.")}</p>
        </div>
        <Link href="/account/family" className="rounded-3xl bg-gradient-to-br from-mint-soft to-powder-soft p-5">
          <Sparkles className="h-5 w-5" />
          <p className="mt-3 font-bold">{family ? t("Family preferences saved") : t("Personalise your EVNT")}</p>
          <p className="text-sm text-ink-soft">{family ? t("Update ages, interests and areas any time.") : t("Add your kids' age ranges and interests (no names needed).")}</p>
        </Link>
      </div>
    </div>
  );
}
