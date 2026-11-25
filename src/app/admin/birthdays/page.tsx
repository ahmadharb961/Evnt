import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { SERVICE_LABEL } from "@/lib/birthday";
import { areaName } from "@/lib/areas";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Birthdays" };

export default async function BirthdaysAdmin() {
  await requireAdmin("ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const list = await prisma.birthdayInquiry.findMany({ include: { _count: { select: { quotes: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div className="max-w-6xl">
      <PageHeader title={t("Birthday requests")} subtitle={t("Parents planning parties and the businesses they asked for quotes.")} />
      <Panel>
        {list.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-4xl">🎂</p>
            <p className="mt-2 text-sm font-semibold text-ink-muted">{t("Nothing here yet.")}</p>
          </div>
        )}
        <ul className="divide-y divide-ink/[.06] text-sm">
          {list.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                {t("Age {n}", { n: i.childAge })} · {t("{n} guests", { n: i.guests })} · {formatMoney(i.budgetCents, locale)} · {areaName(i.area, locale)} · {fmtDate(i.date, locale, { day: "numeric", month: "short" })}
                <span className="block text-xs text-ink-muted">
                  {i.services.map((x) => t(SERVICE_LABEL[x] ?? x)).join(" · ")} · {t("{n} quote requests", { n: i._count.quotes })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
