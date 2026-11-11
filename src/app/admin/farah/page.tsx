import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Farah Approved" };

export default async function FarahAdmin() {
  const u = await requireAdmin("ADMIN", "EVALUATOR");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const isEvaluatorOnly = !u.roles.includes("ADMIN") && !u.roles.includes("SUPER_ADMIN");
  const certs = await prisma.certification.findMany({ where: isEvaluatorOnly ? { evaluatorId: u.id } : {}, include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  const expiring = await prisma.certification.count({ where: { status: "APPROVED", validUntil: { lt: new Date(Date.now() + 30 * 86400_000), gt: new Date() } } });
  return (
    <div className="max-w-5xl">
      <PageHeader title={t("Farah Approved")} subtitle={t("{n} certifications expire in the next 30 days", { n: expiring })} />
      <Panel>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {certs.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/farah/${c.id}`} className="flex flex-wrap justify-between gap-2 py-2.5 hover:underline">
                <span>
                  {c.merchant.name} · {c.kind}
                </span>
                <span className="text-ink-muted">
                  {c.status} · {formatMoney(c.feeCents, locale)}
                  {c.score != null ? ` · ${c.score}%` : ""}
                  {c.validUntil ? ` · ${t("until {date}", { date: fmtDate(c.validUntil, locale, { month: "short", year: "numeric" }) })}` : ""}
                </span>
              </Link>
            </li>
          ))}
          {!certs.length && <li className="py-2 text-ink-muted">{t("No applications yet.")}</li>}
        </ul>
      </Panel>
    </div>
  );
}
