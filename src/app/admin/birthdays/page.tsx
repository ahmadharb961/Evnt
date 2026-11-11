import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { qualifyInquiryAction } from "@/actions/admin-ops";
import { areaName } from "@/lib/areas";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Birthdays" };

export default async function BirthdaysAdmin() {
  await requireAdmin("ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const list = await prisma.birthdayInquiry.findMany({ include: { _count: { select: { quotes: true, leads: true } }, leads: { select: { priceCents: true, creditedCents: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div className="max-w-6xl">
      <PageHeader title={t("Birthday requests")} subtitle={t("Qualified requests appear in Birthday Radar for Featured merchants (max 3 buyers each).")} />
      <Panel>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {list.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                {t("Age {n}", { n: i.childAge })} · {t("{n} guests", { n: i.guests })} · {formatMoney(i.budgetCents, locale)} · {areaName(i.area, locale)} · {fmtDate(i.date, locale, { day: "numeric", month: "short" })}
                <span className="block text-xs text-ink-muted">
                  {i.services.join(", ")} · {t("{q} quote requests · {l} leads sold", { q: i._count.quotes, l: i._count.leads })} · {i.status}
                  {i.leads.length ? ` · ${t("lead revenue {amount}", { amount: formatMoney(i.leads.reduce((a, l) => a + l.priceCents, 0), locale) })}` : ""}
                </span>
              </span>
              <ActionButton action={qualifyInquiryAction.bind(null, i.id, !i.qualified)} className={`chip ${i.qualified ? "chip-on" : ""}`}>
                {i.qualified ? t("Qualified") : t("Mark qualified")}
              </ActionButton>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
