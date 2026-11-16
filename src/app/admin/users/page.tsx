import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { TONES } from "@/lib/tones";
import { ActionForm } from "@/components/portal/action-form";
import { createUserAction } from "@/actions/admin";
import { ROLE_INFO } from "@/lib/roles";
import { UserPlus, Search } from "lucide-react";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Users" };

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<{ q?: string; staff?: string }> }) {
  await requireAdmin("ADMIN");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const [total, members, staffCount] = await Promise.all([
    prisma.user.count(),
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { roles: { some: {} } } }),
  ]);
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
      <PageHeader
        title={t("Users")}
        subtitle={t("{n} accounts · {m} EVNT+ members · {s} admin team", { n: total, m: members, s: staffCount })}
        actions={
          <Link href="/admin/team" className="btn-outline btn-sm">
            {t("Admin team")}
          </Link>
        }
      />
      <details className="group mb-5 rounded-3xl border border-ink/[.06] bg-white open:shadow-card">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 font-semibold">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-peach-soft text-peach-deep">
            <UserPlus className="h-5 w-5" />
          </span>
          {t("Add a user")}
          <span className="ms-auto text-xs font-normal text-ink-muted group-open:hidden">{t("Create an account for a family or a business owner")}</span>
        </summary>
        <div className="border-t border-ink/[.06] p-4">
          <ActionForm action={createUserAction} submit={t("Create account")} className="grid gap-3 sm:grid-cols-2">
            <input name="name" required placeholder={t("Full name")} className="input" />
            <input name="email" type="email" required placeholder={t("Email")} className="input" dir="ltr" />
            <input name="phone" placeholder={t("Phone (optional)")} className="input" dir="ltr" />
            <input name="password" type="text" required minLength={8} placeholder={t("Password (at least 8 characters)")} className="input" dir="ltr" autoComplete="new-password" />
            <p className="text-xs text-ink-muted sm:col-span-2">{t("To give someone admin access, use the Admin team page instead.")}</p>
          </ActionForm>
        </div>
      </details>
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <span className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input name="q" defaultValue={sp.q} placeholder={t("Search email, name or phone")} className="input !h-10 !w-72 !rounded-full !py-0 !ps-10" />
        </span>
        <Link href="/admin/users" className={`chip ${!sp.staff ? "chip-on" : ""}`}>
          {t("Everyone")}
        </Link>
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
              <tr key={u.id} className="border-t border-ink/[.06] hover:bg-canvas/60">
                <td className="p-3">
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 hover:underline">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${["bg-peach-soft text-peach-deep", "bg-mint-soft text-mint-deep", "bg-powder-soft text-powder-deep", "bg-blush-soft text-blush-deep"][u.name.charCodeAt(0) % 4]}`}>
                      {u.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <span className="block font-medium">{u.name}</span>
                      <span className="block text-xs text-ink-muted">{u.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="p-3">
                  <span className="flex flex-wrap gap-1">
                    {u.roles.length
                      ? u.roles.map((r) => {
                          const info = ROLE_INFO.find((x) => x.role === r.role)!;
                          return (
                            <span key={r.role} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONES[info.tone].tile} ${TONES[info.tone].text}`}>
                              {t(info.label)}
                            </span>
                          );
                        })
                      : <span className="text-xs text-ink-muted">{t("Customer")}</span>}
                  </span>
                </td>
                <td className="p-3 text-xs">{u.membership?.status === "ACTIVE" ? <span className="rounded-full bg-violet-100 px-2 py-0.5 font-bold text-violet-700">EVNT+</span> : ""}</td>
                <td className="p-3">{u._count.bookings}</td>
                <td className="p-3">{u._count.orderGroups}</td>
                <td className="p-3">{fmtDate(u.createdAt, locale, { day: "numeric", month: "short", year: "2-digit" })}</td>
                <td className="p-3 text-xs">{u.disabled ? <span className="rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-700">{t("disabled")}</span> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
