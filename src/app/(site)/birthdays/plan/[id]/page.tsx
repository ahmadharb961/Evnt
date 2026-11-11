import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, MessageCircle } from "lucide-react";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { matchingMerchants } from "@/server/birthdays";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { requestQuotesAction, closeInquiryAction } from "@/actions/birthdays";
import { SERVICE_LABEL } from "@/lib/birthday";
import { areaName } from "@/lib/areas";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Birthday plan", robots: { index: false } };

export default async function BirthdayPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/birthdays/plan/${id}`);
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const i = await prisma.birthdayInquiry.findUnique({ where: { id }, include: { quotes: { include: { merchant: true } } } });
  if (!i || i.userId !== user.id) notFound();
  const matches = await matchingMerchants(id);
  const asked = new Set(i.quotes.map((q) => q.merchantId));
  const statusLabel: Record<string, string> = { SENT: t("Waiting for reply"), QUOTED: t("Quote received"), DECLINED: t("Not available"), ACCEPTED: t("Accepted") };
  return (
    <div className="container-x py-6 sm:py-10">
      <Link href="/birthdays" className="text-sm text-ink-muted">
        ← {t("Birthdays")}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("Party for a {n}-year-old", { n: i.childAge })}</h1>
      <p className="mt-2 text-ink-muted">
        {fmtDate(i.date, locale, { weekday: "long", day: "numeric", month: "long" })} · {areaName(i.area, locale)} · {t("{n} guests", { n: i.guests })} · {t("Budget {amount}", { amount: formatMoney(i.budgetCents, locale) })}
      </p>
      <p className="mt-1 text-sm text-ink-muted">{i.services.map((s) => t(SERVICE_LABEL[s] ?? s)).join(" · ")}</p>

      {i.quotes.length > 0 && (
        <section className="mt-8">
          <h2 className="h-section mb-4">{t("Your quotes")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {i.quotes.map((q) => (
              <div key={q.id} className="card p-5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/m/${q.merchant.slug}`} className="font-semibold">
                    {q.merchant.name}
                  </Link>
                  <span className="text-xs font-semibold text-ink-muted">{statusLabel[q.status]}</span>
                </div>
                {q.priceCents != null && <p className="mt-2 text-2xl font-bold">{formatMoney(q.priceCents, locale)}</p>}
                {q.message && <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{q.message}</p>}
                {q.status === "QUOTED" && q.merchant.whatsapp && (
                  <a href={`/go/whatsapp/${q.merchant.slug}?t=birthday&id=${i.id}&text=${encodeURIComponent("Hello! About your birthday quote on EVNT")}`} rel="nofollow" className="btn-soft btn-sm mt-3">
                    <MessageCircle className="h-4 w-4" />
                    {t("Reply on WhatsApp")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {i.status === "OPEN" && (
        <section className="mt-10">
          <h2 className="h-section">{t("Matching businesses")}</h2>
          <p className="mb-4 mt-1 text-sm text-ink-muted">{t("Tick the ones you'd like a quote from. It's free and there's no commitment.")}</p>
          <ActionForm action={requestQuotesAction.bind(null, i.id)} submit={t("Request quotes")} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((m) => (
                <label key={m.id} className={`card flex cursor-pointer gap-3 p-4 has-[:checked]:ring-2 has-[:checked]:ring-ink ${asked.has(m.id) ? "opacity-60" : ""}`}>
                  <input type="checkbox" name="merchant" value={m.id} disabled={asked.has(m.id)} defaultChecked={asked.has(m.id)} className="mt-1 accent-ink" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaSrc(m.logoId ?? m.coverId)} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-semibold">
                      {m.name}
                      {m.farahUntil && m.farahUntil > new Date() && <BadgeCheck className="h-4 w-4 text-mint-deep" />}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {m.locations.map((l) => areaName(l.area, locale)).join(", ")}
                      {m.events[0] && ` · ${t("From {price}", { price: formatMoney(m.events[0].fromPriceCents, locale) })}`}
                    </span>
                    {m.events[0] && <span className="block truncate text-xs">{loc(m.events[0].title, locale)}</span>}
                  </span>
                </label>
              ))}
            </div>
            {!matches.length && <p className="text-sm text-ink-muted">{t("No matching businesses yet. We're adding more every week.")}</p>}
          </ActionForm>
          <div className="mt-6">
            <ActionButton action={closeInquiryAction.bind(null, i.id)} className="btn-ghost btn-sm" confirm={t("Close this plan? Businesses won't be able to send new quotes.")}>
              {t("I've found what I need — close this plan")}
            </ActionButton>
          </div>
        </section>
      )}
    </div>
  );
}
