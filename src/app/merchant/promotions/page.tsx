import Link from "next/link";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { merchantFeatures } from "@/server/features";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { createFlashPromoAction } from "@/actions/merchant-growth";
import { fmtDateTime, ymdString } from "@/lib/dates";

export const metadata = { title: "Flash promotions" };

export default async function PromotionsPage() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const f = await merchantFeatures(ctx.merchant);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [promos, events, products] = await Promise.all([
    prisma.flashPromotion.findMany({ where: { merchantId: ctx.merchant.id }, include: { event: { select: { title: true } }, product: { select: { title: true } } }, orderBy: { startsAt: "desc" }, take: 50 }),
    prisma.event.findMany({ where: { merchantId: ctx.merchant.id, status: "PUBLISHED" }, select: { id: true, title: true } }),
    prisma.product.findMany({ where: { merchantId: ctx.merchant.id, status: "PUBLISHED" }, select: { id: true, title: true } }),
  ]);
  const used = promos.filter((p) => p.createdAt >= monthStart).length;
  const now = new Date();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t("Flash promotions")} subtitle={t("Time-limited discounts that appear on your listing with a badge.")} />
      {f.flashPromos === 0 ? (
        <Panel>
          <p className="text-sm">{t("Flash promotions are included in the Pro (3/month) and Featured (10/month) plans.")}</p>
          <Link href="/merchant/subscription" className="btn-primary btn-sm mt-3">
            {t("See plans")}
          </Link>
        </Panel>
      ) : (
        <Panel title={t("{used} of {n} used this month", { used, n: f.flashPromos })}>
          <ActionForm action={createFlashPromoAction} submit={t("Schedule promotion")}>
            <label className="block">
              <span className="label">{t("Listing")}</span>
              <select name="target" required className="input">
                {events.map((e) => (
                  <option key={e.id} value={`event:${e.id}`}>
                    {loc(e.title, locale)}
                  </option>
                ))}
                {products.map((p) => (
                  <option key={p.id} value={`product:${p.id}`}>
                    {loc(p.title, locale)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="block">
                <span className="label">{t("Discount %")}</span>
                <input name="percent" type="number" min={5} max={70} defaultValue={20} className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Starts")}</span>
                <input name="start" type="date" min={ymdString(new Date())} defaultValue={ymdString(new Date())} className="input" />
              </label>
              <label className="block">
                <span className="label">{t("at")}</span>
                <input name="startTime" type="time" defaultValue="09:00" className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Hours")}</span>
                <input name="hours" type="number" min={1} max={336} defaultValue={48} className="input" />
              </label>
            </div>
          </ActionForm>
        </Panel>
      )}
      <Panel title={t("History")}>
        {!promos.length ? (
          <p className="text-sm text-ink-muted">{t("No promotions yet.")}</p>
        ) : (
          <ul className="divide-y divide-ink/[.06] text-sm">
            {promos.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2.5">
                <span>
                  <b>-{p.percentOff}%</b> · {loc(p.event?.title ?? p.product?.title, locale)}
                  <span className="block text-xs text-ink-muted">
                    {fmtDateTime(p.startsAt, locale)} → {fmtDateTime(p.endsAt, locale)}
                  </span>
                </span>
                <span className="text-xs font-semibold">{p.endsAt < now ? t("Ended") : p.startsAt > now ? t("Scheduled") : t("Live")}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
