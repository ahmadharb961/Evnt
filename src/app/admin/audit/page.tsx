import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin("ADMIN");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const rows = await prisma.auditLog.findMany({ where: sp.q ? { OR: [{ action: { contains: sp.q } }, { entityId: sp.q }, { entityType: sp.q }] } : {}, orderBy: { createdAt: "desc" }, take: 300 });
  const actors = new Map((await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.actorId).filter(Boolean) as string[] } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]));
  return (
    <div className="max-w-6xl">
      <PageHeader title={t("Audit log")} subtitle={t("Financial and operational actions, including seat allocations, payments, refunds and settings changes.")} />
      <form className="mb-4">
        <input name="q" defaultValue={sp.q} placeholder={t("Filter by action, type or ID")} className="input !h-10 !w-80 !rounded-full !py-0" />
      </form>
      <div className="overflow-x-auto rounded-3xl border border-ink/[.06] bg-white">
        <table className="w-full min-w-[800px] text-xs">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-ink/[.06] align-top">
                <td className="whitespace-nowrap p-2.5 text-ink-muted">{fmtDateTime(r.createdAt, locale)}</td>
                <td className="p-2.5 font-semibold">{r.action}</td>
                <td className="p-2.5">
                  {r.entityType} <span className="font-mono text-ink-muted">{r.entityId}</span>
                </td>
                <td className="p-2.5">{r.actorId ? actors.get(r.actorId) ?? r.actorId : t("system")}</td>
                <td className="max-w-[320px] truncate p-2.5 font-mono text-ink-muted">{r.data ? JSON.stringify(r.data) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
