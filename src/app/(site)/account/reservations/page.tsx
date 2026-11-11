import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { getLocale, getT } from "@/i18n/server";
import { EmptyState } from "@/components/empty";
import { StatusPill } from "@/components/status-pill";
import { ActionButton } from "@/components/portal/action-button";
import { answerProposalAction, cancelReservationAction, payDepositAction } from "@/actions/restaurants";
import { whishAvailable } from "@/server/payments";
import { formatMoney } from "@/lib/money";
import { RESERVATION_STATUS } from "@/lib/status";
import { fmtDateTime } from "@/lib/dates";

export const metadata = { title: "My reservations", robots: { index: false } };

export default async function MyReservations() {
  const user = await requireUser("/account/reservations");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const list = await prisma.restaurantReservation.findMany({ where: { userId: user.id }, include: { restaurant: true }, orderBy: { startsAt: "desc" }, take: 100 });
  const whish = await whishAvailable();
  if (!list.length) return <EmptyState icon={UtensilsCrossed} title={t("No reservations yet")} cta={{ href: "/restaurants", label: t("Find a family restaurant") }} />;
  return (
    <div className="space-y-3">
      <h1 className="h-section mb-4">{t("Reservations")}</h1>
      {list.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/restaurants/${r.restaurant.slug}`} className="font-semibold">
              {r.restaurant.name}
            </Link>
            <StatusPill map={RESERVATION_STATUS} status={r.status} t={t} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {fmtDateTime(r.startsAt, locale)} · {t("{a} adults, {c} children", { a: r.adults, c: r.children })} · {r.code}
          </p>
          {r.status === "PROPOSED" && r.proposedAt && (
            <div className="mt-3 rounded-2xl bg-blush-soft p-3 text-sm">
              <p>{t("The restaurant proposed {time} instead.", { time: fmtDateTime(r.proposedAt, locale) })}</p>
              {r.merchantNote && <p className="text-ink-muted">{r.merchantNote}</p>}
              <div className="mt-2 flex gap-2">
                <ActionButton action={answerProposalAction.bind(null, r.code, true)} className="btn-primary btn-sm">
                  {t("Accept new time")}
                </ActionButton>
                <ActionButton action={answerProposalAction.bind(null, r.code, false)} className="btn-outline btn-sm">
                  {t("Decline")}
                </ActionButton>
              </div>
            </div>
          )}
          {r.status === "ACCEPTED" && r.depositCents > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-canvas p-3 text-sm">
              {r.depositPaid ? (
                <span className="font-medium text-mint-deep">{t("Deposit paid: {amount}", { amount: formatMoney(r.depositCents, locale) })}</span>
              ) : whish ? (
                <ActionButton action={payDepositAction.bind(null, r.code)} className="btn-primary btn-sm">
                  {t("Pay deposit {amount} with Whish", { amount: formatMoney(r.depositCents, locale) })}
                </ActionButton>
              ) : (
                <span>{t("Deposit of {amount} payable at the restaurant.", { amount: formatMoney(r.depositCents, locale) })}</span>
              )}
            </div>
          )}
          {r.status === "REJECTED" && r.merchantNote && <p className="mt-2 text-sm text-ink-muted">{r.merchantNote}</p>}
          {["REQUESTED", "ACCEPTED"].includes(r.status) && r.startsAt > new Date() && (
            <div className="mt-3">
              <ActionButton action={cancelReservationAction.bind(null, r.code)} className="btn-ghost btn-sm" confirm={t("Cancel this reservation?")}>
                {t("Cancel")}
              </ActionButton>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
