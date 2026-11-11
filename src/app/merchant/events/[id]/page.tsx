import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc, type Localized } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { EventForm } from "@/components/portal/event-form";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { LocalizedField } from "@/components/localized-field";
import { addSessionsAction, cancelSessionAction, saveTicketTypeAction, setEventStatusAction, toggleTicketTypeAction } from "@/actions/merchant-events";
import { formatMoney } from "@/lib/money";
import { fmtDateTime, ymdString } from "@/lib/dates";

export const metadata = { title: "Edit listing" };

export default async function EditEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const e = await prisma.event.findUnique({
    where: { id },
    include: {
      media: { orderBy: { sort: "asc" } },
      ticketTypes: { orderBy: { sort: "asc" } },
      sessions: { where: { startsAt: { gt: new Date(Date.now() - 7 * 86400_000) } }, orderBy: { startsAt: "asc" }, include: { _count: { select: { bookings: { where: { status: { in: ["CONFIRMED", "RESERVED_PAY_AT_VENUE", "COMPLETED"] } } } } } } },
      seatingMap: { include: { seats: { select: { zone: true } } } },
    },
  });
  if (!e || e.merchantId !== ctx.merchant.id) notFound();
  const tab = sp.tab ?? "details";
  const zones = e.seatingMap ? ((e.seatingMap.zones as { key: string; name: string }[]) ?? []) : [];
  const seatsTaken = e.seatingMode === "ASSIGNED" ? new Map((await prisma.seatClaim.groupBy({ by: ["sessionId"], where: { sessionId: { in: e.sessions.map((s) => s.id) }, status: { in: ["CONFIRMED", "RESERVED"] } }, _count: { _all: true } })).map((r) => [r.sessionId, r._count._all])) : new Map<string, number>();
  const tabs = [
    ["details", t("Details")],
    ["tickets", t("Tickets")],
    ["sessions", t("Dates & capacity")],
  ];
  const statusLabel: Record<string, string> = { PUBLISHED: t("Live"), DRAFT: t("Draft"), ARCHIVED: t("Archived"), PENDING_REVIEW: t("In review"), REJECTED: t("Rejected") };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={loc(e.title, locale) || t("Untitled")}
        subtitle={`${statusLabel[e.status]}${e.rejectionReason ? ` — ${e.rejectionReason}` : ""}`}
        actions={
          <>
            <Link href={`/events/${e.slug}`} target="_blank" className="btn-outline btn-sm">
              <ExternalLink className="h-3.5 w-3.5" />
              {t("Preview")}
            </Link>
            {e.status !== "PUBLISHED" ? (
              <ActionButton action={setEventStatusAction.bind(null, e.id, "PUBLISHED")} className="btn-primary btn-sm">
                {t("Publish")}
              </ActionButton>
            ) : (
              <ActionButton action={setEventStatusAction.bind(null, e.id, "DRAFT")} className="btn-outline btn-sm" confirm={t("Unpublish? Parents won't be able to book it.")}>
                {t("Unpublish")}
              </ActionButton>
            )}
            {e.status !== "ARCHIVED" && (
              <ActionButton action={setEventStatusAction.bind(null, e.id, "ARCHIVED")} className="btn-ghost btn-sm" confirm={t("Archive this listing?")}>
                {t("Archive")}
              </ActionButton>
            )}
          </>
        }
      />
      <div className="mb-6 flex gap-1 border-b border-ink/[.06]">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/merchant/events/${e.id}?tab=${k}`} className={`border-b-2 px-3 pb-3 text-sm font-medium ${tab === k ? "border-ink" : "border-transparent text-ink-muted"}`}>
            {l}
          </Link>
        ))}
      </div>

      {tab === "details" && <EventForm merchantId={ctx.merchant.id} event={e} />}

      {tab === "tickets" && (
        <div className="space-y-6">
          <Panel title={t("Ticket types")}>
            {e.ticketTypes.length ? (
              <ul className="divide-y divide-ink/[.06]">
                {e.ticketTypes.map((tt) => (
                  <li key={tt.id} className={`flex items-center justify-between gap-3 py-3 ${tt.active ? "" : "opacity-50"}`}>
                    <div>
                      <p className="font-medium">{loc(tt.name, locale)}</p>
                      <p className="text-xs text-ink-muted">
                        {tt.priceCents ? formatMoney(tt.priceCents, locale) : t("Free")} · {t("{a}–{b} per booking", { a: tt.minQty, b: tt.maxQty })}
                        {tt.zone ? ` · ${t("Zone")}: ${tt.zone}` : ""}
                      </p>
                    </div>
                    <ActionButton action={toggleTicketTypeAction.bind(null, tt.id)}>{tt.active ? t("Hide") : t("Show")}</ActionButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">{t("No tickets yet.")}</p>
            )}
          </Panel>
          <Panel title={t("Add a ticket type")}>
            <ActionForm action={saveTicketTypeAction} hidden={{ eventId: e.id }} submit={t("Add ticket")}>
              <LocalizedField name="name" label={t("Ticket name")} initial={{} as Localized} maxLength={60} hint={t("e.g. Child, Adult, Family pack")} />
              <div className="grid gap-4 sm:grid-cols-4">
                <label className="block">
                  <span className="label">{t("Price (USD)")}</span>
                  <input name="price" inputMode="decimal" defaultValue="0" className="input" />
                </label>
                <label className="block">
                  <span className="label">{t("Min per booking")}</span>
                  <input name="minQty" type="number" min={1} defaultValue={1} className="input" />
                </label>
                <label className="block">
                  <span className="label">{t("Max per booking")}</span>
                  <input name="maxQty" type="number" min={1} max={50} defaultValue={10} className="input" />
                </label>
                {zones.length > 0 && (
                  <label className="block">
                    <span className="label">{t("Seating zone")}</span>
                    <select name="zone" className="input">
                      <option value="">{t("All zones")}</option>
                      {zones.map((z) => (
                        <option key={z.key} value={z.key}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </ActionForm>
          </Panel>
        </div>
      )}

      {tab === "sessions" && (
        <div className="space-y-6">
          <Panel title={t("Upcoming dates")}>
            {e.sessions.length ? (
              <ul className="divide-y divide-ink/[.06]">
                {e.sessions.map((s) => {
                  const total = e.seatingMode === "ASSIGNED" ? e.seatingMap?.seats.length ?? 0 : s.capacity;
                  const sold = e.seatingMode === "ASSIGNED" ? seatsTaken.get(s.id) ?? 0 : s.reserved;
                  return (
                    <li key={s.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${s.status === "CANCELED" ? "opacity-50" : ""}`}>
                      <div>
                        <p className="font-medium">{fmtDateTime(s.startsAt, locale)}</p>
                        <p className="text-xs text-ink-muted">
                          {t("{sold} of {total} taken", { sold, total })} · {t("{n} bookings", { n: s._count.bookings })}
                          {s.salesStartAt ? ` · ${t("Sales open {date}", { date: fmtDateTime(s.salesStartAt, locale) })}` : ""}
                          {s.status === "CANCELED" ? ` · ${t("Cancelled")}` : ""}
                        </p>
                      </div>
                      {s.status === "SCHEDULED" && s.startsAt > new Date() && (
                        <ActionButton action={cancelSessionAction.bind(null, s.id)} className="btn-danger btn-sm" confirm={t("Cancel this date? All its bookings will be cancelled and parents notified.")}>
                          {t("Cancel date")}
                        </ActionButton>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">{t("No dates yet.")}</p>
            )}
          </Panel>
          <Panel title={t("Add dates")}>
            <ActionForm action={addSessionsAction} hidden={{ eventId: e.id }} submit={t("Add")}>
              <div className="grid gap-4 sm:grid-cols-4">
                <label className="block">
                  <span className="label">{t("Date")}</span>
                  <input name="date" type="date" min={ymdString(new Date())} required className="input" />
                </label>
                <label className="block">
                  <span className="label">{t("Start time")}</span>
                  <input name="time" type="time" required defaultValue="10:00" className="input" />
                </label>
                <label className="block">
                  <span className="label">{t("Duration (minutes)")}</span>
                  <input name="duration" type="number" min={15} defaultValue={120} className="input" />
                </label>
                {e.seatingMode === "GENERAL" ? (
                  <label className="block">
                    <span className="label">{t("Spots")}</span>
                    <input name="capacity" type="number" min={1} defaultValue={20} required className="input" />
                  </label>
                ) : (
                  <p className="self-end pb-3 text-xs text-ink-muted">{t("Capacity comes from your seating map.")}</p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="label">{t("Repeat weekly for")}</span>
                  <select name="repeatWeeks" className="input" defaultValue="1">
                    {[1, 2, 4, 6, 8, 12].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? t("Just once") : t("{n} weeks", { n })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">{t("Sales open on (optional)")}</span>
                  <input name="salesDate" type="date" className="input" />
                </label>
                <label className="block">
                  <span className="label">{t("at")}</span>
                  <input name="salesTime" type="time" className="input" />
                </label>
              </div>
            </ActionForm>
          </Panel>
        </div>
      )}
    </div>
  );
}
