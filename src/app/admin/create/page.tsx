import Link from "next/link";
import { CalendarPlus, PackagePlus, UtensilsCrossed, UserPlus, ShieldPlus, LayoutTemplate, Megaphone, ArrowRight } from "lucide-react";
import { requireAdmin, hasRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { createListingAsAdminAction } from "@/actions/admin";

export const metadata = { title: "Create new" };

export default async function CreateAdmin() {
  const me = await requireAdmin("CONTENT", "ADMIN");
  const t = await getT();
  const ops = hasRole(me, "ADMIN");
  const merchants = ops ? await prisma.merchant.findMany({ where: { status: { in: ["APPROVED", "PENDING", "ONBOARDING"] } }, select: { id: true, name: true, type: true }, orderBy: { name: "asc" } }) : [];
  const byType = (types: string[]) => [...merchants.filter((m) => types.includes(m.type)), ...merchants.filter((m) => !types.includes(m.type))];
  const listing = [
    { kind: "event", title: t("New activity or event"), desc: t("A workshop, camp, show or party with dates, tickets and seats."), icon: CalendarPlus, cls: "from-peach to-peach-soft", list: byType(["ACTIVITY_PROVIDER", "VENUE", "EVENT_ORGANIZER", "BIRTHDAY_SERVICE"]) },
    { kind: "product", title: t("New shop product"), desc: t("Something families can buy and get delivered."), icon: PackagePlus, cls: "from-blush to-blush-soft", list: byType(["RETAILER"]) },
    { kind: "restaurant", title: t("Restaurant page"), desc: t("Menu, photos, kids facilities and table reservations."), icon: UtensilsCrossed, cls: "from-mint to-mint-soft", list: byType(["RESTAURANT"]) },
  ];
  const links = [
    ...(ops ? [{ href: "/admin/users", title: t("New user"), desc: t("An account for a family or business owner."), icon: UserPlus, cls: "bg-powder-soft text-powder-deep" }] : []),
    ...(hasRole(me, "SUPER_ADMIN") ? [{ href: "/admin/team", title: t("New admin team member"), desc: t("Someone who helps you run EVNT, incl. other super admins."), icon: ShieldPlus, cls: "bg-violet-100 text-violet-800" }] : []),
    { href: "/admin/cms", title: t("Homepage section"), desc: t("A new row of activities on the homepage."), icon: LayoutTemplate, cls: "bg-amber-100 text-amber-800" },
    ...(ops ? [{ href: "/admin/ads", title: t("Advertising"), desc: t("Review and approve paid placements."), icon: Megaphone, cls: "bg-sky-100 text-sky-800" }] : []),
  ];
  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader title={t("Create new")} subtitle={t("Pick what you want to add.")} />
      {ops && (
        <div className="grid gap-4 lg:grid-cols-3">
          {listing.map((l) => (
            <div key={l.kind} className={`flex flex-col rounded-[2rem] bg-gradient-to-br p-5 shadow-card ${l.cls}`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                <l.icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-bold">{l.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{l.desc}</p>
              <ActionForm action={createListingAsAdminAction} submit={t("Continue")} hidden={{ kind: l.kind }} className="mt-auto space-y-3 pt-5" submitClass="btn-primary w-full">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink-soft">{t("For which business?")}</span>
                  <select name="merchantId" required className="input !bg-white" defaultValue="">
                    <option value="" disabled>
                      {t("Choose a business")}
                    </option>
                    {l.list.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              </ActionForm>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="group flex items-center gap-4 rounded-3xl border border-ink/[.06] bg-white p-4 transition hover:shadow-card">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${l.cls}`}>
              <l.icon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{l.title}</span>
              <span className="block text-xs text-ink-muted">{l.desc}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-0.5 rtl:rotate-180" />
          </Link>
        ))}
      </div>
      {ops && <p className="text-xs text-ink-muted">{t("You'll use the business's own editor. A bar at the top shows you're editing on their behalf, and every change is recorded in the activity log.")}</p>}
    </div>
  );
}
