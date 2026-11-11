import Link from "next/link";
import type { MerchantStatus, Prisma } from "@prisma/client";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Merchants" };
const STATUSES: MerchantStatus[] = ["PENDING", "APPROVED", "ONBOARDING", "REJECTED", "SUSPENDED"];

export default async function AdminMerchants({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; plan?: string }> }) {
  await requireAdmin("ADMIN", "FINANCE");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const where: Prisma.MerchantWhereInput = {
    ...(STATUSES.includes(sp.status as MerchantStatus) ? { status: sp.status as MerchantStatus } : {}),
    ...(sp.plan ? { plan: sp.plan as "BASIC" } : {}),
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }, { slug: { contains: sp.q.toLowerCase() } }] } : {}),
  };
  const merchants = await prisma.merchant.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300, include: { _count: { select: { events: true, products: true, bookings: true } } } });
  return (
    <>
      <PageHeader title={t("Merchants")} subtitle={t("{n} shown", { n: merchants.length })} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/merchants" className={`chip ${!sp.status ? "chip-on" : ""}`}>
          {t("All")}
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/merchants?status=${s}`} className={`chip ${sp.status === s ? "chip-on" : ""}`}>
            {s}
          </Link>
        ))}
        <input name="q" defaultValue={sp.q} placeholder={t("Search name or email")} className="input !h-9 !w-56 !rounded-full !py-0 text-sm" />
      </form>
      <div className="overflow-x-auto rounded-3xl border border-ink/[.06] bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-canvas text-xs text-ink-muted">
            <tr>
              {[t("Business"), t("Type"), t("Plan"), t("Status"), t("Listings"), t("Bookings"), t("Joined"), t("Demo")].map((h) => (
                <th key={h} className="p-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.id} className="border-t border-ink/[.06] hover:bg-canvas">
                <td className="p-3">
                  <Link href={`/admin/merchants/${m.id}`} className="font-medium hover:underline">
                    {m.name}
                  </Link>
                  <span className="block text-xs text-ink-muted">{m.email}</span>
                </td>
                <td className="p-3 text-xs">{m.type}</td>
                <td className="p-3">{m.plan}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.status === "PENDING" ? "bg-peach-soft text-peach-deep" : m.status === "APPROVED" ? "bg-mint-soft text-mint-deep" : "bg-ink/[.06]"}`}>{m.status}</span>
                  {m.restrictedAt && <span className="ms-1 text-xs text-red-600">{t("restricted")}</span>}
                </td>
                <td className="p-3">{m._count.events + m._count.products}</td>
                <td className="p-3">{m._count.bookings}</td>
                <td className="p-3">{fmtDate(m.createdAt, locale, { day: "numeric", month: "short", year: "2-digit" })}</td>
                <td className="p-3 text-xs">{m.email?.endsWith("@demo.evnt.local") ? t("demo") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
