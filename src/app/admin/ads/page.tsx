import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { reviewCampaignAction } from "@/actions/admin";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

export const metadata = { title: "Advertising" };

export default async function AdsAdmin() {
  await requireAdmin("ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const [pending, live, all] = await Promise.all([
    prisma.adCampaign.findMany({ where: { status: "PENDING_APPROVAL" }, include: { merchant: true, placement: true, category: true }, orderBy: { createdAt: "asc" } }),
    prisma.adCampaign.findMany({ where: { status: "APPROVED", endsAt: { gt: new Date() } }, include: { merchant: true, placement: true }, orderBy: { startsAt: "asc" } }),
    prisma.adCampaign.findMany({ where: { status: { in: ["ENDED", "REJECTED", "PENDING_PAYMENT", "CANCELED"] } }, include: { merchant: true, placement: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const d = (x: Date) => fmtDate(x, locale, { day: "numeric", month: "short" });
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("Advertising")} subtitle={t("Nothing sponsored is shown until approved here. Sponsored placements never affect ratings, reviews or Farah Approved.")} />
      <Panel title={t("Waiting for approval")}>
        {!pending.length ? (
          <p className="text-sm text-ink-muted">{t("Nothing to review.")}</p>
        ) : (
          <ul className="space-y-4">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-4 rounded-2xl border border-ink/[.06] p-4">
                {c.creativeId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaSrc(c.creativeId)} alt="" className="h-24 w-40 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">
                    {loc(c.placement.name, locale)} · <Link href={`/admin/merchants/${c.merchantId}`} className="underline">{c.merchant.name}</Link>
                  </p>
                  <p className="text-ink-muted">
                    {d(c.startsAt)} → {d(c.endsAt)} · {c.priceCents ? formatMoney(c.priceCents, locale) : t("% of sales")} {c.category ? `· ${loc(c.category.name, locale)}` : ""}
                    {c.whatsappAudienceSize != null && ` · ${t("{n} opted-in parents", { n: c.whatsappAudienceSize })}`}
                  </p>
                  <p className="mt-2 whitespace-pre-line">{c.headline}</p>
                  <div className="mt-3 flex gap-2">
                    <ActionButton action={reviewCampaignAction.bind(null, c.id, true)} className="btn-primary btn-sm">
                      {t("Approve")}
                    </ActionButton>
                    <ActionButton action={reviewCampaignAction.bind(null, c.id, false)} className="btn-outline btn-sm" prompt={t("What needs to change?")}>
                      {t("Reject")}
                    </ActionButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={t("Live & upcoming")}>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {live.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>
                {loc(c.placement.name, locale)} · {c.merchant.name}
              </span>
              <span className="text-ink-muted">
                {d(c.startsAt)} → {d(c.endsAt)} · {c.impressions} {t("impr.")} · {c.clicks} {t("clicks")}
              </span>
            </li>
          ))}
          {!live.length && <li className="py-2 text-ink-muted">—</li>}
        </ul>
      </Panel>
      <Panel title={t("History")}>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {all.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>
                {loc(c.placement.name, locale)} · {c.merchant.name}
              </span>
              <span className="text-ink-muted">{c.status}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
