import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { sendQuoteAction } from "@/actions/birthdays";
import { areaName } from "@/lib/areas";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { SERVICE_LABEL } from "@/lib/birthday";

export const metadata = { title: "Birthday requests" };


export default async function LeadsPage() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const quotes = await prisma.birthdayQuote.findMany({ where: { merchantId: ctx.merchant.id }, include: { inquiry: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 });
  const svc = (s: string[]) => s.map((x) => t(SERVICE_LABEL[x] ?? x)).join(" · ");
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t("Birthday requests")} subtitle={t("Parents planning parties who asked you for a quote.")} />
      <Panel title={t("Quote requests")}>
        {!quotes.length ? (
          <p className="text-sm text-ink-muted">{t("No requests yet. Parents find you through the birthday planner.")}</p>
        ) : (
          <ul className="space-y-4">
            {quotes.map((q) => {
              const i = q.inquiry;
              return (
                <li key={q.id} className="rounded-2xl border border-ink/[.06] p-4">
                  <p className="font-medium">
                    {t("Party for a {n}-year-old · {guests} guests", { n: i.childAge, guests: i.guests })} · {fmtDate(i.date, locale, { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {areaName(i.area, locale)} · {t("Budget {amount}", { amount: formatMoney(i.budgetCents, locale) })} · {svc(i.services)}
                  </p>
                  {i.notes && <p className="mt-1 text-sm">“{i.notes}”</p>}
                  <p className="mt-1 text-sm">
                    {i.user.name.split(" ")[0]} · <span dir="ltr">+{i.contactPhone}</span>
                  </p>
                  {q.status === "SENT" ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <ActionForm action={sendQuoteAction.bind(null, q.id)} submit={t("Send quote")} className="space-y-2 sm:col-span-2" submitClass="btn-primary btn-sm">
                        <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                          <input name="price" inputMode="decimal" placeholder={t("Price (USD)")} className="input !py-2" />
                          <input name="message" placeholder={t("What's included, availability…")} className="input !py-2" maxLength={1000} />
                        </div>
                      </ActionForm>
                      <ActionForm action={sendQuoteAction.bind(null, q.id)} submit={t("Not available")} hidden={{ decline: "1", message: "" }} className="" submitClass="btn-ghost btn-sm">
                        <span />
                      </ActionForm>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-semibold text-ink-muted">
                      {q.status === "QUOTED" ? t("You quoted {price}", { price: formatMoney(q.priceCents ?? 0, locale) }) : q.status === "DECLINED" ? t("Declined") : q.status}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

    </div>
  );
}
