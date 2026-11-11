import Link from "next/link";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import type { Localized } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { LocalizedField } from "@/components/localized-field";
import { GalleryInput, MediaInput } from "@/components/uploader";
import { StatusPill } from "@/components/status-pill";
import { facilityLabel } from "@/components/cards";
import { completeReservationAction, respondReservationAction, saveRestaurantAction } from "@/actions/restaurants";
import { RESTAURANT_FACILITIES } from "@/server/listings";
import { RESERVATION_STATUS } from "@/lib/status";
import { fmtDateTime } from "@/lib/dates";
import { areaName } from "@/lib/areas";

export const metadata = { title: "Restaurant" };
type Hours = Record<string, [string, string][]>;

export default async function MerchantRestaurant({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireMerchant();
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const tab = sp.tab === "profile" ? "profile" : "reservations";
  const r = await prisma.restaurant.findFirst({ where: { merchantId: ctx.merchant.id } });
  const locations = await prisma.merchantLocation.findMany({ where: { merchantId: ctx.merchant.id } });
  const reservations = r
    ? await prisma.restaurantReservation.findMany({ where: { restaurantId: r.id, startsAt: { gte: new Date(Date.now() - 3 * 86400_000) } }, include: { user: { select: { name: true } } }, orderBy: { startsAt: "asc" }, take: 200 })
    : [];
  const hours = (r?.hours ?? {}) as Hours;
  const days = [
    ["mon", t("Monday")],
    ["tue", t("Tuesday")],
    ["wed", t("Wednesday")],
    ["thu", t("Thursday")],
    ["fri", t("Friday")],
    ["sat", t("Saturday")],
    ["sun", t("Sunday")],
  ] as const;
  const now = new Date();
  return (
    <div className="max-w-4xl">
      <PageHeader title={t("Restaurant & reservations")} actions={r?.status === "PUBLISHED" ? <Link href={`/restaurants/${r.slug}`} target="_blank" className="btn-outline btn-sm">{t("View page")}</Link> : undefined} />
      <div className="mb-6 flex gap-1 border-b border-ink/[.06]">
        {[
          ["reservations", t("Reservations")],
          ["profile", t("Restaurant page")],
        ].map(([k, l]) => (
          <Link key={k} href={`/merchant/restaurant?tab=${k}`} className={`border-b-2 px-3 pb-3 text-sm font-medium ${tab === k ? "border-ink" : "border-transparent text-ink-muted"}`}>
            {l}
          </Link>
        ))}
      </div>

      {tab === "reservations" &&
        (!r ? (
          <Panel>
            <p className="text-sm">{t("Set up your restaurant page first.")}</p>
            <Link href="/merchant/restaurant?tab=profile" className="btn-primary btn-sm mt-3">
              {t("Set up now")}
            </Link>
          </Panel>
        ) : (
          <Panel>
            {!reservations.length ? (
              <p className="text-sm text-ink-muted">{t("No reservations yet.")}</p>
            ) : (
              <ul className="divide-y divide-ink/[.06]">
                {reservations.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">
                        {fmtDateTime(x.startsAt, locale)} · {t("{a} adults, {c} children", { a: x.adults, c: x.children })}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {x.user.name} · <span dir="ltr">+{x.contactPhone}</span> · {x.code}
                        {x.depositCents > 0 && ` · ${x.depositPaid ? t("Deposit paid") : t("Deposit due")}`}
                      </p>
                      {x.requests && <p className="mt-1 text-xs">“{x.requests}”</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill map={RESERVATION_STATUS} status={x.status} t={t} />
                      {x.status === "REQUESTED" && (
                        <>
                          <ActionButton action={respondReservationAction.bind(null, x.code, "accept")} className="btn-primary btn-sm">
                            {t("Accept")}
                          </ActionButton>
                          <ActionButton action={respondReservationAction.bind(null, x.code, "propose")} prompt={t("Propose another time (e.g. 2026-12-24 19:30):")}>
                            {t("Propose time")}
                          </ActionButton>
                          <ActionButton action={respondReservationAction.bind(null, x.code, "reject")} className="btn-ghost btn-sm" prompt={t("Optional message to the family:")}>
                            {t("Decline")}
                          </ActionButton>
                        </>
                      )}
                      {x.status === "ACCEPTED" && x.startsAt < now && (
                        <ActionButton action={completeReservationAction.bind(null, x.code)} className="btn-soft btn-sm" prompt={t("How many guests came? (0 = no-show)")}>
                          {t("Confirm guests")}
                        </ActionButton>
                      )}
                      {x.status === "COMPLETED" && <span className="text-xs text-ink-muted">{t("{n} guests verified", { n: x.completedGuests ?? 0 })}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-ink-muted">{t("EVNT charges a small fee per verified guest who came. Cancelled reservations and no-shows are never charged.")}</p>
          </Panel>
        ))}

      {tab === "profile" && (
        <ActionForm action={saveRestaurantAction} submit={t("Save")} className="space-y-6">
          <Panel title={t("Basics")}>
            <div className="space-y-5">
              <label className="block">
                <span className="label">{t("Restaurant name")}</span>
                <input name="name" defaultValue={r?.name ?? ctx.merchant.name} required className="input" />
              </label>
              <LocalizedField name="about" label={t("About")} initial={(r?.about ?? {}) as Localized} multiline />
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className="label">{t("Cuisines (comma separated)")}</span>
                  <input name="cuisines" defaultValue={r?.cuisines.join(", ") ?? ""} placeholder="Lebanese, Café" className="input" />
                </label>
                <label className="block">
                  <span className="label">{t("Price range")}</span>
                  <select name="priceLevel" defaultValue={r?.priceLevel ?? 2} className="input">
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {"$".repeat(n)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="label">{t("Location")}</span>
                <select name="locationId" defaultValue={r?.locationId ?? locations[0]?.id ?? ""} className="input">
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} — {areaName(l.area, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Panel>
          <Panel title={t("Photos")}>
            <div className="space-y-4">
              <MediaInput name="coverId" initial={r?.coverId ?? r?.coverUrl} aspect="aspect-[16/9]" label={t("Cover photo")} />
              <GalleryInput name="gallery" initial={r?.gallery ?? []} />
            </div>
          </Panel>
          <Panel title={t("For families")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {RESTAURANT_FACILITIES.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={f} defaultChecked={!!r?.[f]} className="h-4 w-4 accent-ink" />
                  {facilityLabel(t, f)}
                </label>
              ))}
            </div>
          </Panel>
          <Panel title={t("Opening hours")}>
            <div className="space-y-2">
              {days.map(([k, l]) => (
                <div key={k} className="grid grid-cols-[110px_1fr_1fr_auto] items-center gap-2 text-sm">
                  <span>{l}</span>
                  <input type="time" name={`${k}_open`} defaultValue={hours[k]?.[0]?.[0] ?? "09:00"} className="input !py-2" />
                  <input type="time" name={`${k}_close`} defaultValue={hours[k]?.[0]?.[1] ?? "23:00"} className="input !py-2" />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name={`${k}_closed`} defaultChecked={!!r && !hours[k]?.length} className="accent-ink" />
                    {t("Closed")}
                  </label>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={t("Reservations")}>
            <div className="space-y-4">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="acceptsReservations" defaultChecked={r?.acceptsReservations ?? true} className="h-4 w-4 accent-ink" />
                {t("Accept reservation requests on EVNT")}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">{t("Largest party online")}</span>
                  <input name="maxPartySize" type="number" min={1} max={60} defaultValue={r?.maxPartySize ?? 12} className="input" />
                </label>
                <label className="block">
                  <span className="label">{t("Deposit per reservation (optional, USD)")}</span>
                  <input name="deposit" inputMode="decimal" defaultValue={r?.depositCents ? (r.depositCents / 100).toString() : ""} className="input" />
                </label>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="publish" defaultChecked={r ? r.status === "PUBLISHED" : true} className="h-4 w-4 accent-ink" />
                {t("Show my restaurant on EVNT (after verification)")}
              </label>
            </div>
          </Panel>
        </ActionForm>
      )}
    </div>
  );
}
