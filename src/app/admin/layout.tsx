import { requireAdmin, hasRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { getT } from "@/i18n/server";
import { PortalShell, type NavItem } from "@/components/portal/shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const t = await getT();
  const [pendingMerchants, pendingAds, farah, reports, refunds] = await Promise.all([
    prisma.merchant.count({ where: { status: "PENDING" } }),
    prisma.adCampaign.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.certification.count({ where: { status: { in: ["PAID", "ASSESSED"] } } }),
    prisma.reviewReport.count({ where: { status: "OPEN" } }),
    prisma.refund.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
  ]);
  const ops = hasRole(user, "ADMIN");
  const fin = hasRole(user, "FINANCE");
  const content = hasRole(user, "CONTENT");
  const evaluator = hasRole(user, "EVALUATOR");
  const nav: NavItem[] = [
    { href: "/admin", label: t("Overview"), icon: "LayoutDashboard" },
    ...(ops ? [{ href: "/admin/merchants", label: t("Merchants"), icon: "Store" as const, badge: pendingMerchants }] : []),
    ...(ops ? [{ href: "/admin/users", label: t("Users"), icon: "Users" as const }] : []),
    ...(content || ops ? [{ href: "/admin/cms", label: t("Homepage & content"), icon: "Home" as const }] : []),
    ...(content || ops ? [{ href: "/admin/listings", label: t("Listings"), icon: "CalendarDays" as const }] : []),
    ...(content || ops ? [{ href: "/admin/ranking", label: t("Ordering & priority"), icon: "ListOrdered" as const }] : []),
    ...(ops ? [{ href: "/admin/bookings", label: t("Bookings"), icon: "Ticket" as const }] : []),
    ...(ops ? [{ href: "/admin/orders", label: t("Shop orders"), icon: "ShoppingBag" as const }] : []),
    ...(ops ? [{ href: "/admin/reservations", label: t("Restaurants"), icon: "UtensilsCrossed" as const }] : []),
    ...(ops ? [{ href: "/admin/birthdays", label: t("Birthdays"), icon: "Cake" as const }] : []),
    ...(ops ? [{ href: "/admin/ads", label: t("Advertising"), icon: "Megaphone" as const, badge: pendingAds }] : []),
    ...(fin ? [{ href: "/admin/finance", label: t("Payments & finance"), icon: "Wallet" as const, badge: refunds }] : []),
    ...(fin ? [{ href: "/admin/commissions", label: t("Commissions"), icon: "Scale" as const }] : []),
    ...(fin || ops ? [{ href: "/admin/plans", label: t("Plans & pricing"), icon: "Crown" as const }] : []),
    ...(ops ? [{ href: "/admin/plus", label: "EVNT+", icon: "Crown" as const }] : []),
    ...(ops || evaluator ? [{ href: "/admin/farah", label: t("Farah Approved"), icon: "ShieldCheck" as const, badge: farah }] : []),
    ...(content || ops ? [{ href: "/admin/reviews", label: t("Reviews & moderation"), icon: "Star" as const, badge: reports }] : []),
    ...(content || ops ? [{ href: "/admin/marketing", label: t("Marketing"), icon: "Mail" as const }] : []),
    ...(ops || fin ? [{ href: "/admin/analytics", label: t("Analytics"), icon: "BarChart3" as const }] : []),
    ...(ops || fin ? [{ href: "/admin/simulator", label: t("Revenue simulator"), icon: "Calculator" as const }] : []),
    ...(content || ops ? [{ href: "/admin/localization", label: t("Localization"), icon: "Languages" as const }] : []),
    ...(hasRole(user, "SUPER_ADMIN") ? [{ href: "/admin/settings", label: t("Platform settings"), icon: "Settings" as const }] : []),
    ...(ops ? [{ href: "/admin/audit", label: t("Audit log"), icon: "FileText" as const }] : []),
  ];
  return (
    <PortalShell title="EVNT Admin" subtitle={user.email} nav={nav}>
      {children}
    </PortalShell>
  );
}
