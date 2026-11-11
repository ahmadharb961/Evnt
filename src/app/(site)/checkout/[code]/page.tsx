import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { whishAvailable } from "@/server/payments";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { CheckoutForm, Countdown } from "@/components/booking/checkout-form";
import { formatMoney } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";
import { areaName } from "@/lib/areas";

export const metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser(`/checkout/${code}`);
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const b = await prisma.booking.findUnique({
    where: { code },
    include: { event: { include: { location: true } }, session: true, items: { include: { ticketType: true } } },
  });
  if (!b || b.userId !== user.id) notFound();
  if (b.status !== "PENDING_PAYMENT") redirect(`/account/bookings/${b.code}`);
  const expired = !b.holdExpiresAt || b.holdExpiresAt < new Date();
  const whish = await whishAvailable();
  const methods: ("FREE" | "WHISH" | "PAY_AT_VENUE")[] = b.totalCents === 0 ? ["FREE"] : [...(whish ? (["WHISH"] as const) : []), ...(b.event.payAtVenue ? (["PAY_AT_VENUE"] as const) : [])];
  const seatLabels = new Map((await prisma.seat.findMany({ where: { id: { in: b.items.flatMap((i) => i.seatIds) } } })).map((s) => [s.id, s.label]));
  const tickets = b.items.flatMap((it) =>
    Array.from({ length: it.quantity }, (_, k) => ({ label: `${loc(it.ticketType.name, locale)}${it.seatIds[k] ? ` · ${t("Seat")} ${seatLabels.get(it.seatIds[k])}` : ""} #${k + 1}` })),
  );

  return (
    <div className="container-x py-6 sm:py-10">
      <Link href={`/events/${b.event.slug}`} className="text-sm text-ink-muted hover:text-ink">
        ← {t("Back to the activity")}
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{t("Checkout")}</h1>
      <div className="mt-3">{b.holdExpiresAt && <Countdown until={b.holdExpiresAt.toISOString()} />}</div>
      <div className="mt-8 grid gap-10 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {expired ? (
            <div className="rounded-3xl bg-canvas p-6">
              <p className="font-semibold">{t("Your hold expired")}</p>
              <p className="mt-1 text-sm text-ink-muted">{t("The spots were released so other families could book. You can choose again.")}</p>
              <Link href={`/events/${b.event.slug}`} className="btn-primary mt-4">
                {t("Choose again")}
              </Link>
            </div>
          ) : (
            <CheckoutForm
              code={b.code}
              name={b.contactName}
              phone={b.contactPhone}
              tickets={tickets}
              total={formatMoney(b.totalCents, locale)}
              methods={methods}
              whishPending={!whish}
              policy={loc(b.event.cancellationPolicy, locale) || t("Free cancellation up to 48 hours before the session (24 hours for EVNT+ members). No refunds after that.")}
            />
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaSrc(b.event.coverId, b.event.coverUrl)} alt="" className="aspect-[16/9] w-full object-cover" />
            <div className="space-y-3 p-5 text-sm">
              <p className="text-base font-bold">{loc(b.event.title, locale)}</p>
              <p className="flex items-center gap-2 text-ink-soft">
                <Calendar className="h-4 w-4" />
                {fmtDateTime(b.session.startsAt, locale)}
              </p>
              {b.event.location && (
                <p className="flex items-center gap-2 text-ink-soft">
                  <MapPin className="h-4 w-4" />
                  {b.event.location.name}, {areaName(b.event.location.area, locale)}
                </p>
              )}
              <div className="space-y-1.5 border-t border-ink/10 pt-3">
                {b.items.map((it) => (
                  <div key={it.id} className="flex justify-between">
                    <span>
                      {it.quantity} × {loc(it.ticketType.name, locale)}
                      {it.seatIds.length > 0 && <span className="block text-xs text-ink-muted">{it.seatIds.map((s) => seatLabels.get(s)).join(", ")}</span>}
                    </span>
                    <span>{formatMoney(it.quantity * it.unitPriceCents, locale)}</span>
                  </div>
                ))}
                {b.subtotalCents > 0 && (
                  <div className="flex justify-between text-ink-muted">
                    <span>{t("EVNT booking fee")}</span>
                    <span>{b.feeCents ? formatMoney(b.feeCents, locale) : t("Free with EVNT+")}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-bold">
                  <span>{t("Total")}</span>
                  <span>{b.totalCents === 0 ? t("Free") : formatMoney(b.totalCents, locale)}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
