import Link from "next/link";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { MediaInput } from "@/components/uploader";
import { createCampaignAction, cancelCampaignAction } from "@/actions/merchant-growth";
import { formatMoney } from "@/lib/money";
import { fmtDate, ymdString } from "@/lib/dates";

export const metadata = { title: "Advertising" };

const STATUS: Record<string, string> = { PENDING_PAYMENT: "Awaiting payment", PENDING_APPROVAL: "In review", APPROVED: "Approved", REJECTED: "Rejected", ENDED: "Ended", CANCELED: "Cancelled", DRAFT: "Draft" };

export default async function AdsPage() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const m = ctx.merchant;
  const [placements, campaigns, events, products, restaurants, cats] = await Promise.all([
    prisma.adPlacement.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    prisma.adCampaign.findMany({ where: { merchantId: m.id }, include: { placement: true }, orderBy: { createdAt: "desc" } }),
    prisma.event.findMany({ where: { merchantId: m.id, status: "PUBLISHED" }, select: { id: true, title: true } }),
    prisma.product.findMany({ where: { merchantId: m.id, status: "PUBLISHED" }, select: { id: true, title: true } }),
    prisma.restaurant.findMany({ where: { merchantId: m.id, status: "PUBLISHED" }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { parentId: null, active: true }, orderBy: { sort: "asc" } }),
  ]);
  const unitLabel = (u: string) => ({ WEEK: t("/week"), MONTH: t("/month"), CAMPAIGN: t("/campaign"), ITEM: "", PERCENT_SALES: "" })[u] ?? "";
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("Advertising")} subtitle={t("Sponsored placements are always labelled as sponsored and reviewed by EVNT before they run.")} />
      <Panel title={t("Your campaigns")}>
        {!campaigns.length ? (
          <p className="text-sm text-ink-muted">{t("No campaigns yet.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-ink-muted">
                <tr>
                  {[t("Placement"), t("Dates"), t("Price"), t("Status"), t("Impressions"), t("Clicks"), ""].map((h) => (
                    <th key={h} className="pb-2 text-start font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-ink/[.06]">
                    <td className="py-2.5">
                      {loc(c.placement.name, locale)}
                      <span className="block max-w-[220px] truncate text-xs text-ink-muted">{c.headline}</span>
                    </td>
                    <td className="py-2.5">
                      {fmtDate(c.startsAt, locale, { day: "numeric", month: "short" })} – {fmtDate(c.endsAt, locale, { day: "numeric", month: "short" })}
                    </td>
                    <td className="py-2.5">{c.priceCents ? formatMoney(c.priceCents, locale) : "—"}</td>
                    <td className="py-2.5">
                      {t(STATUS[c.status])}
                      {c.rejectionReason && <span className="block text-xs text-red-600">{c.rejectionReason}</span>}
                    </td>
                    <td className="py-2.5">{c.impressions}</td>
                    <td className="py-2.5">{c.clicks}</td>
                    <td className="py-2.5 text-end">
                      {c.status === "PENDING_PAYMENT" && c.invoiceId && (
                        <Link href={`/merchant/billing/${c.invoiceId}`} className="btn-primary btn-sm me-2">
                          {t("Pay")}
                        </Link>
                      )}
                      {["PENDING_PAYMENT", "DRAFT"].includes(c.status) && (
                        <ActionButton action={cancelCampaignAction.bind(null, c.id)} className="btn-ghost btn-sm" confirm={t("Cancel this campaign?")}>
                          {t("Cancel")}
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel title={t("Placements & prices")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {placements.map((p) => (
              <div key={p.code} className="rounded-2xl border border-ink/[.06] p-4">
                <p className="font-semibold">{loc(p.name, locale)}</p>
                <p className="mt-1 text-xs text-ink-muted">{loc(p.description, locale)}</p>
                <p className="mt-2 text-sm font-bold">
                  {p.unit === "PERCENT_SALES" ? t("{n}% of generated sales", { n: p.priceCents / 100 }) : `${formatMoney(p.priceCents, locale)} ${unitLabel(p.unit)}`}
                </p>
                {p.requiresPlan && <p className="mt-1 text-xs font-semibold text-powder-deep">{t("Featured plan")}</p>}
                {p.exclusive && <p className="mt-1 text-xs text-ink-muted">{t("Exclusive: one sponsor at a time")}</p>}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={t("New campaign")}>
          <ActionForm action={createCampaignAction} submit={t("Create campaign")}>
            <label className="block">
              <span className="label">{t("Placement")}</span>
              <select name="placement" required className="input">
                {placements.map((p) => (
                  <option key={p.code} value={p.code} disabled={p.requiresPlan === "FEATURED" && m.plan !== "FEATURED"}>
                    {loc(p.name, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">{t("What to promote")}</span>
              <select name="target" className="input">
                <option value="">{t("My business page")}</option>
                {events.map((e) => (
                  <option key={e.id} value={`event:${e.id}`}>
                    {loc(e.title, locale)}
                  </option>
                ))}
                {restaurants.map((r) => (
                  <option key={r.id} value={`restaurant:${r.id}`}>
                    {r.name}
                  </option>
                ))}
                {products.map((p) => (
                  <option key={p.id} value={`product:${p.id}`}>
                    {loc(p.title, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">{t("Category (for category sponsorship)")}</span>
              <select name="categoryId" className="input">
                <option value="">—</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {loc(c.name, locale)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">{t("Start")}</span>
                <input name="start" type="date" min={ymdString(new Date())} required className="input" />
              </label>
              <label className="block">
                <span className="label">{t("End")}</span>
                <input name="end" type="date" min={ymdString(new Date())} required className="input" />
              </label>
            </div>
            <label className="block">
              <span className="label">{t("Headline / message")}</span>
              <textarea name="headline" rows={3} required maxLength={500} className="input" />
            </label>
            <MediaInput name="creativeId" aspect="aspect-[16/9]" label={t("Creative (image)")} />
            <p className="text-xs text-ink-muted">{t("WhatsApp campaigns go only to parents who opted in, with an opt-out in every message.")}</p>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
