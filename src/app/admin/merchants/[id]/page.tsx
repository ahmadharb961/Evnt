import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { activeSubscription } from "@/server/billing";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel, Stat } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { ActionForm } from "@/components/portal/action-form";
import { setMerchantStatusAction, overridePlanAction, manageAsMerchantAction, invoiceCommissionsAction, payoutAction, issueInvoiceAction, recordExternalBookingAction } from "@/actions/admin";
import { mediaSrc } from "@/server/media";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { areaName } from "@/lib/areas";

export const metadata = { title: "Merchant" };

export default async function AdminMerchant({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin("ADMIN", "FINANCE");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const m = await prisma.merchant.findUnique({ where: { id }, include: { locations: true, staff: { include: { user: true } } } });
  if (!m) notFound();
  const [sub, balance, invoices, clicks, events, commissions] = await Promise.all([
    activeSubscription(id),
    prisma.ledgerEntry.aggregate({ where: { merchantId: id, settlementId: null }, _sum: { amountCents: true } }),
    prisma.invoice.findMany({ where: { merchantId: id }, orderBy: { issuedAt: "desc" }, take: 10 }),
    prisma.contactClick.findMany({ where: { merchantId: id, createdAt: { gt: new Date(Date.now() - 7 * 86400_000) } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.event.findMany({ where: { merchantId: id }, select: { id: true, title: true, status: true, slug: true }, take: 20 }),
    prisma.commission.aggregate({ where: { merchantId: id, status: { in: ["EARNED", "INVOICED", "SETTLED"] } }, _sum: { amountCents: true } }),
  ]);
  const bal = balance._sum.amountCents ?? 0;
  const money = (c: number) => formatMoney(c, locale);
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={m.name}
        subtitle={`${m.type} · ${m.status} · ${m.plan}`}
        actions={
          <>
            {m.status === "APPROVED" && (
              <Link href={`/m/${m.slug}`} target="_blank" className="btn-outline btn-sm">
                {t("Public page")}
              </Link>
            )}
            <ActionButton action={manageAsMerchantAction.bind(null, m.id)} className="btn-outline btn-sm">
              {t("Manage as merchant")}
            </ActionButton>
            {m.status !== "APPROVED" && (
              <ActionButton action={setMerchantStatusAction.bind(null, m.id, "APPROVED")} className="btn-primary btn-sm" confirm={t("Verify and approve this business?")}>
                {t("Approve")}
              </ActionButton>
            )}
            {["PENDING", "ONBOARDING"].includes(m.status) && (
              <ActionButton action={setMerchantStatusAction.bind(null, m.id, "REJECTED")} className="btn-outline btn-sm" prompt={t("What should they change?")}>
                {t("Request changes")}
              </ActionButton>
            )}
            {m.status === "APPROVED" && (
              <ActionButton action={setMerchantStatusAction.bind(null, m.id, "SUSPENDED")} className="btn-danger btn-sm" prompt={t("Reason for suspension:")}>
                {t("Suspend")}
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={bal >= 0 ? t("EVNT owes merchant") : t("Merchant owes EVNT")} value={money(Math.abs(bal))} />
        <Stat label={t("Commissions earned (all time)")} value={money(commissions._sum.amountCents ?? 0)} />
        <Stat label={t("Subscription")} value={<span className="text-base">{sub ? `${sub.plan} · ${sub.status}` : "—"}</span>} hint={sub ? t("until {date}", { date: fmtDate(sub.currentPeriodEnd, locale, { day: "numeric", month: "short", year: "numeric" }) }) : undefined} />
        <Stat label={t("Farah Approved")} value={<span className="text-base">{m.farahUntil && m.farahUntil > new Date() ? t("until {date}", { date: fmtDate(m.farahUntil, locale, { month: "short", year: "numeric" }) }) : "—"}</span>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("Details")}>
          <div className="flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaSrc(m.logoId ?? m.coverId)} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            <dl className="space-y-1 text-sm">
              <div>{m.email}</div>
              <div dir="ltr">{m.phone ? `+${m.phone}` : "—"} · WA {m.whatsapp ? `+${m.whatsapp}` : "—"}</div>
              <div>{m.website ?? ""}</div>
              <div className="text-ink-muted">{t("Payout")}: {m.payoutMethod ?? "—"} {m.payoutName} {m.payoutAccount}</div>
              <div className="text-ink-muted">{t("Attribution code")}: {m.attributionCode}</div>
              {m.rejectionReason && <div className="text-red-600">{m.rejectionReason}</div>}
            </dl>
          </div>
          <p className="mt-3 text-sm text-ink-soft">{loc(m.about, locale)}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {m.locations.map((l) => (
              <li key={l.id}>
                📍 {l.name}: {l.address}, {areaName(l.area, locale)}
              </li>
            ))}
          </ul>
          <ul className="mt-3 space-y-1 text-xs text-ink-muted">
            {m.staff.map((s) => (
              <li key={s.userId}>
                {s.role}: {s.user.name} ({s.user.email})
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("Plan & money")}>
          <div className="flex flex-wrap gap-2">
            {(["BASIC", "PRO", "FEATURED"] as const).map((p) => (
              <ActionButton key={p} action={overridePlanAction.bind(null, m.id, p)} prompt={t("Give {plan} free for how many months? (admin override)", { plan: p })}>
                {t("Override → {plan}", { plan: p })}
              </ActionButton>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton action={invoiceCommissionsAction.bind(null, m.id)} className="btn-soft btn-sm" confirm={t("Issue an invoice for what this merchant owes?")}>
              {t("Invoice commissions owed")}
            </ActionButton>
            <ActionButton action={payoutAction.bind(null, m.id)} className="btn-soft btn-sm" prompt={t("Payout transfer reference:")}>
              {t("Record payout of balance")}
            </ActionButton>
          </div>
          <div className="mt-5 border-t border-ink/[.06] pt-4">
            <p className="mb-2 text-sm font-semibold">{t("Issue a manual invoice")}</p>
            <ActionForm action={issueInvoiceAction.bind(null, m.id)} submit={t("Issue invoice")} submitClass="btn-outline btn-sm" className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_100px_140px]">
                <input name="description" placeholder={t("Description (e.g. market report)")} className="input !py-2" />
                <input name="amount" inputMode="decimal" placeholder="USD" className="input !py-2" />
                <select name="kind" className="input !py-2">
                  <option value="REPORT">{t("Market report")}</option>
                  <option value="ADVERTISING">{t("Advertising")}</option>
                  <option value="ADJUSTMENT">{t("Other")}</option>
                </select>
              </div>
            </ActionForm>
          </div>
          <ul className="mt-4 divide-y divide-ink/[.06] text-sm">
            {invoices.map((i) => (
              <li key={i.id} className="flex justify-between py-1.5">
                <span>{i.number}</span>
                <span>
                  {money(i.totalCents)} · {i.status}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title={t("Contact clicks (last 7 days) — record an EVNT-generated booking completed directly")}>
        {!clicks.length ? (
          <p className="text-sm text-ink-muted">—</p>
        ) : (
          <ul className="space-y-3">
            {clicks.map((c) => (
              <li key={c.id} className="rounded-2xl border border-ink/[.06] p-3 text-sm">
                <p>
                  {c.channel} · {fmtDateTime(c.createdAt, locale)} · {c.targetType ?? ""} {c.userId ? t("(signed-in parent)") : ""}
                </p>
                <ActionForm action={recordExternalBookingAction.bind(null, c.id)} submit={t("Record verified booking (50%)")} submitClass="btn-outline btn-sm" className="mt-2 flex flex-wrap items-end gap-2">
                  <input name="amount" inputMode="decimal" placeholder={t("Amount USD")} className="input !w-28 !py-2" />
                  <input name="bookedAt" type="datetime-local" className="input !w-52 !py-2" />
                  <select name="category" className="input !w-44 !py-2">
                    {["WORKSHOPS", "CAMPS", "SHOWS", "BIRTHDAYS", "FAMILY_EXPERIENCES", "RETAIL"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  <input name="note" placeholder={t("Evidence / note")} className="input !w-56 !py-2" />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={t("Listings")}>
        <ul className="space-y-1 text-sm">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.slug}`} target="_blank" className="hover:underline">
                {loc(e.title, locale)}
              </Link>{" "}
              <span className="text-xs text-ink-muted">{e.status}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
