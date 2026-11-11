import Link from "next/link";
import { requireMerchant } from "@/server/auth";
import { merchantFeatures } from "@/server/features";
import { prisma } from "@/server/db";
import { getT } from "@/i18n/server";
import { PortalShell, type NavItem } from "@/components/portal/shell";

export const dynamic = "force-dynamic";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireMerchant();
  const t = await getT();
  const m = ctx.merchant;
  const f = await merchantFeatures(m);
  const [pendingRes, newOrders, unread] = await Promise.all([
    f.restaurant ? prisma.restaurantReservation.count({ where: { restaurant: { merchantId: m.id }, status: "REQUESTED" } }) : 0,
    f.shop ? prisma.order.count({ where: { merchantId: m.id, status: "PENDING" } }) : 0,
    prisma.notification.count({ where: { merchantId: m.id, readAt: null } }),
  ]);
  const nav: NavItem[] = [
    { href: "/merchant", label: t("Dashboard"), icon: "LayoutDashboard" },
    ...(m.status === "ONBOARDING" ? [{ href: "/merchant/onboarding", label: t("Finish setup"), icon: "BadgeCheck" as const }] : []),
    { href: "/merchant/profile", label: t("Business profile"), icon: "Store" },
    ...(f.events ? [{ href: "/merchant/events", label: t("Activities & events"), icon: "CalendarDays" as const }] : []),
    ...(f.seating ? [{ href: "/merchant/seating", label: t("Seating maps"), icon: "Armchair" as const }] : []),
    ...(f.events ? [{ href: "/merchant/bookings", label: t("Bookings"), icon: "Ticket" as const }] : []),
    ...(f.events ? [{ href: "/merchant/scan", label: t("Scan tickets"), icon: "ScanLine" as const }] : []),
    ...(f.restaurant ? [{ href: "/merchant/restaurant", label: t("Restaurant & reservations"), icon: "UtensilsCrossed" as const, badge: pendingRes }] : []),
    ...(f.shop ? [{ href: "/merchant/products", label: t("Products"), icon: "Package" as const }] : []),
    ...(f.shop ? [{ href: "/merchant/orders", label: t("Orders"), icon: "ShoppingBag" as const, badge: newOrders }] : []),
    ...(f.birthdays ? [{ href: "/merchant/leads", label: t("Birthday requests"), icon: "Cake" as const }] : []),
    { href: "/merchant/promotions", label: t("Flash promotions"), icon: "Zap" },
    { href: "/merchant/ads", label: t("Advertising"), icon: "Megaphone" },
    { href: "/merchant/analytics", label: t("Analytics"), icon: "BarChart3" },
    { href: "/merchant/reviews", label: t("Reviews"), icon: "Star" },
    { href: "/merchant/certification", label: t("Farah Approved"), icon: "ShieldCheck" },
    { href: "/merchant/subscription", label: t("Plan"), icon: "Crown" },
    { href: "/merchant/billing", label: t("Billing & payouts"), icon: "Receipt" },
    { href: "/merchant/notifications", label: t("Notifications"), icon: "Bell", badge: unread },
    { href: "/merchant/team", label: t("Team"), icon: "Users" },
  ];
  const banner =
    m.status === "ONBOARDING" ? (
      <Link href="/merchant/onboarding" className="mb-6 block rounded-3xl bg-peach-soft p-4 text-sm font-medium text-peach-deep">
        {t("Finish setting up your business to go live on EVNT →")}
      </Link>
    ) : m.status === "PENDING" ? (
      <div className="mb-6 rounded-3xl bg-powder-soft p-4 text-sm text-powder-deep">{t("Thanks! Our team is verifying your business. You can prepare your listings meanwhile — they go live once you're approved.")}</div>
    ) : m.status === "REJECTED" ? (
      <div className="mb-6 rounded-3xl bg-red-50 p-4 text-sm text-red-700">
        {t("Your application needs changes:")} {m.rejectionReason} <Link href="/merchant/onboarding" className="underline">{t("Update and resubmit")}</Link>
      </div>
    ) : m.status === "SUSPENDED" ? (
      <div className="mb-6 rounded-3xl bg-red-50 p-4 text-sm text-red-700">{t("Your business is suspended and hidden from EVNT. Please contact support.")}</div>
    ) : m.restrictedAt ? (
      <Link href="/merchant/billing" className="mb-6 block rounded-3xl bg-red-50 p-4 text-sm text-red-700">
        {t("Some features are paused because of an overdue invoice. Pay it to restore them →")}
      </Link>
    ) : ctx.asAdmin ? (
      <div className="mb-6 rounded-3xl bg-ink p-4 text-sm text-white">{t("You're managing this business as an EVNT admin.")}</div>
    ) : null;
  return (
    <PortalShell title={m.name} subtitle={`${t(m.plan === "BASIC" ? "Basic plan" : m.plan === "PRO" ? "Pro plan" : "Featured plan")}`} nav={nav} banner={banner}>
      {children}
    </PortalShell>
  );
}
