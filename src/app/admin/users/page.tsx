import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Users" };

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<{ q?: string; staff?: string }> }) {
  await requireAdmin("ADMIN");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const users = await prisma.user.findMany({
    where: {
      ...(sp.q ? { OR: [{ email: { contains: sp.q, mode: "insensitive" } }, { name: { contains: sp.q, mode: "insensitive" } }, { phone: { contains: sp.q.replace(/\D/g, "") || "~" } }] } : {}),
      ...(sp.staff ? { roles: { some: {} } } : {}),
    },
    include: { roles: true, membership: true, _count: { select: { bookings: true, orderGroups: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title={t("Users")} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={sp.q} placeholder={t("Search email, name or phone")} className="input !h-10 !w-72 !rounded-full !py-0" />
        <Link href="/admin/users?staff=1" className={`chip ${sp.staff ? "chip-on" : ""}`}>
          {t("Admins only")}
        </Link>
      </form>
      <div className="overflow-x-auto rounded-3xl border border-ink/[.06] bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-canvas text-xs text-ink-muted">
            <tr>
              {[t("User"), t("Roles"), "EVNT+", t("Bookings"), t("Orders"), t("Joined"), ""].map((h) => (
                <th key={h} className="p-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-ink/[.06]">
                <td className="p-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                    {u.name}
                  </Link>
                  <span className="block text-xs text-ink-muted">{u.email}</span>
                </td>
                <td className="p-3 text-xs">{u.roles.map((r) => r.role).join(", ") || "—"}</td>
                <td className="p-3 text-xs">{u.membership?.status === "ACTIVE" ? "✓" : ""}</td>
                <td className="p-3">{u._count.bookings}</td>
                <td className="p-3">{u._count.orderGroups}</td>
                <td className="p-3">{fmtDate(u.createdAt, locale, { day: "numeric", month: "short", year: "2-digit" })}</td>
                <td className="p-3 text-xs text-red-600">{u.disabled ? t("disabled") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
