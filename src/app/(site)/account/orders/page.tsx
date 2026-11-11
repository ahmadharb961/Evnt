import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { getLocale, getT } from "@/i18n/server";
import { EmptyState } from "@/components/empty";
import { StatusPill } from "@/components/status-pill";
import { ORDER_STATUS } from "@/lib/status";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "My orders", robots: { index: false } };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const groups = await prisma.orderGroup.findMany({ where: { userId: user.id }, include: { orders: { include: { merchant: true, items: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  if (!groups.length) return <EmptyState icon={ShoppingBag} title={t("No orders yet")} cta={{ href: "/shop", label: t("Visit the shop") }} />;
  return (
    <div className="space-y-3">
      <h1 className="h-section mb-4">{t("Orders")}</h1>
      {groups.map((g) => (
        <Link key={g.id} href={`/account/orders/${g.number}`} className="card block p-4 hover:shadow-lift">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{g.number}</p>
            <span className="text-sm font-semibold">{formatMoney(g.totalCents, locale)}</span>
          </div>
          <p className="text-xs text-ink-muted">{fmtDate(g.createdAt, locale, { day: "numeric", month: "short", year: "numeric" })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {g.orders.map((o) => (
              <span key={o.id} className="inline-flex items-center gap-2 text-xs">
                {o.merchant.name} <StatusPill map={ORDER_STATUS} status={o.status} t={t} />
              </span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}
