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
  const superAdmin = hasRole(user, "SUPER_ADMIN");
  const G = { start: t("Start"), market: t("Marketplace"), people: t("People"), activity: t("Bookings & orders"), money: t("Money"), content: t("Content"), system: t("System") };
  const nav: NavItem[] = [
    { href: "/admin", label: t("Overview"), icon: "LayoutDashboard", group: G.start, tone: "violet" },
    ...(content || ops ? [{ href: "/admin/create", label: t("Create new"), icon: "Sparkles" as const, group: G.start, tone: "peach" as const }] : []),
    ...(ops ? [{ href: "/admin/merchants", label: t("Businesses"), icon: "Store" as const, badge: pendingMerchants, group: G.market, tone: "sky" as const }] : []),
    ...(content || ops ? [{ href: "/admin/listings", label: t("Listings"), icon: "CalendarDays" as const, group: G.market, tone: "peach" as const }] : []),
    ...(content || ops ? [{ href: "/admin/ranking", label: t("Ordering & priority"), icon: "ListOrdered" as const, group: G.market, tone: "amber" as const }] : []),
    ...(ops ? [{ href: "/admin/users", label: t("Users"), icon: "Users" as const, group: G.people, tone: "powder" as const }] : []),
    ...(ops ? [{ href: "/admin/team", label: t("Admin team"), icon: "Shield" as const, group: G.people, tone: "violet" as const }] : []),
    ...(ops ? [{ href: "/admin/bookings", label: t("Bookings"), icon: "Ticket" as const, group: G.activity, tone: "mint" as const }] : []),
    ...(ops ? [{ href: "/admin/orders", label: t("Shop orders"), icon: "ShoppingBag" as const, group: G.activity, tone: "blush" as const }] : []),
    ...(ops ? [{ href: "/admin/reservations", label: t("Restaurant tables"), icon: "UtensilsCrossed" as const, group: G.activity, tone: "emerald" as const }] : []),
    ...(ops ? [{ href: "/admin/birthdays", label: t("Birthdays"), icon: "Cake" as const, group: G.activity, tone: "rose" as const }] : []),
    ...(fin ? [{ href: "/admin/finance", label: t("Payments & finance"), icon: "Wallet" as const, badge: refunds, group: G.money, tone: "emerald" as const }] : []),
    ...(fin ? [{ href: "/admin/commissions", label: t("Commissions"), icon: "Scale" as const, group: G.money, tone: "sky" as const }] : []),
    ...(fin || ops ? [{ href: "/admin/plans", label: t("Plans & pricing"), icon: "Crown" as const, group: G.money, tone: "amber" as const }] : []),
    ...(ops ? [{ href: "/admin/plus", label: "EVNT+", icon: "Crown" as const, group: G.money, tone: "violet" as const }] : []),
    ...(ops ? [{ href: "/admin/ads", label: t("Advertising"), icon: "Megaphone" as const, badge: pendingAds, group: G.money, tone: "peach" as const }] : []),
    ...(ops || fin ? [{ href: "/admin/analytics", label: t("Analytics"), icon: "BarChart3" as const, group: G.money, tone: "powder" as const }] : []),
    ...(ops || fin ? [{ href: "/admin/simulator", label: t("Revenue simulator"), icon: "Calculator" as const, group: G.money, tone: "slate" as const }] : []),
    ...(content || ops ? [{ href: "/admin/cms", label: t("Homepage & content"), icon: "Home" as const, group: G.content, tone: "peach" as const }] : []),
    ...(content || ops ? [{ href: "/admin/reviews", label: t("Reviews & moderation"), icon: "Star" as const, badge: reports, group: G.content, tone: "amber" as const }] : []),
    ...(content || ops ? [{ href: "/admin/marketing", label: t("Marketing"), icon: "Mail" as const, group: G.content, tone: "blush" as const }] : []),
    ...(ops || evaluator ? [{ href: "/admin/farah", label: t("Farah Approved"), icon: "ShieldCheck" as const, badge: farah, group: G.content, tone: "mint" as const }] : []),
    ...(content || ops ? [{ href: "/admin/localization", label: t("Languages"), icon: "Languages" as const, group: G.content, tone: "sky" as const }] : []),
    ...(superAdmin ? [{ href: "/admin/settings", label: t("Platform settings"), icon: "Settings" as const, group: G.system, tone: "slate" as const }] : []),
    ...(ops ? [{ href: "/admin/audit", label: t("Activity log"), icon: "FileText" as const, group: G.system, tone: "slate" as const }] : []),
  ];
  return (
    <PortalShell title="EVNT Admin" subtitle={user.email} nav={nav}>
      {children}
    </PortalShell>
  );
}
