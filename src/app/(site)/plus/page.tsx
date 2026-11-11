import Link from "next/link";
import { Crown, Ticket, Sparkles, CalendarClock, RefreshCcw, PartyPopper, Gift } from "lucide-react";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { getSettings } from "@/server/settings";
import { pointsBalance } from "@/server/membership";
import { whishAvailable } from "@/server/payments";
import { getLocale, getT } from "@/i18n/server";
import { ActionButton } from "@/components/portal/action-button";
import { joinPlusAction, cancelPlusAction, resumePlusAction } from "@/actions/plus";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const t = await getT();
  return { title: "EVNT+", description: t("The family membership: no booking fees, double points, early access and members-only playdates."), alternates: alternates("/plus") };
}

export default async function PlusPage() {
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const s = await getSettings(["membership.monthlyCents", "membership.yearlyCents", "membership.earlyAccessHours"]);
  const [m, points, whish] = await Promise.all([user ? prisma.membership.findUnique({ where: { userId: user.id } }) : null, user ? pointsBalance(user.id) : 0, whishAvailable()]);
  const active = !!m && m.status === "ACTIVE" && (!m.currentPeriodEnd || m.currentPeriodEnd > new Date());
  const benefits = [
    { icon: Ticket, title: t("No booking fees"), body: t("Never pay the EVNT convenience fee on bookings.") },
    { icon: Sparkles, title: t("Double loyalty points"), body: t("Earn 2 points for every dollar you spend.") },
    { icon: CalendarClock, title: t("{n}-hour early access", { n: s["membership.earlyAccessHours"] }), body: t("Book popular shows and camps before everyone else.") },
    { icon: RefreshCcw, title: t("Flexible cancellation"), body: t("Cancel up to 24 hours before (instead of 48), subject to the organizer's terms.") },
    { icon: PartyPopper, title: t("Members-only playdates"), body: t("Exclusive EVNT+ family experiences throughout the year.") },
    { icon: Gift, title: t("Partner perks"), body: t("Discounts and birthday credits with partners, added over time.") },
  ];
  return (
    <div>
      <section className="bg-gradient-to-br from-powder via-blush-soft to-peach-soft">
        <div className="container-x py-14 text-center sm:py-20">
          <Crown className="mx-auto h-10 w-10" />
          <h1 className="mt-4 text-5xl font-extrabold tracking-tight">EVNT+</h1>
          <p className="mx-auto mt-3 max-w-lg text-lg text-ink-soft">{t("More moments, fewer fees. The membership for busy Lebanese families.")}</p>
        </div>
      </section>
      <div className="container-x -mt-10">
        {active && m ? (
          <div className="mx-auto max-w-md rounded-4xl bg-ink p-7 text-white shadow-lift">
            <p className="text-xs uppercase tracking-[.3em] text-white/60">EVNT+ {t("member")}</p>
            <p className="mt-6 font-mono text-xl tracking-widest" dir="ltr">
              {m.cardNumber}
            </p>
            <div className="mt-6 flex justify-between text-sm">
              <span>{user!.name}</span>
              <span>
                {m.cancelAtPeriodEnd ? t("Ends") : t("Renews")} {m.currentPeriodEnd ? fmtDate(m.currentPeriodEnd, locale, { day: "numeric", month: "short", year: "numeric" }) : ""}
              </span>
            </div>
            <p className="mt-4 text-sm text-white/80">{t("{n} points", { n: points })}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {m.cancelAtPeriodEnd ? (
                <ActionButton action={resumePlusAction} className="btn btn-sm bg-white text-ink">
                  {t("Keep my membership")}
                </ActionButton>
              ) : (
                <ActionButton action={cancelPlusAction} className="btn btn-sm border border-white/30 text-white" confirm={t("Cancel auto-renewal? You keep your benefits until the end of the period.")}>
                  {t("Cancel renewal")}
                </ActionButton>
              )}
              {whish && m.priceCents > 0 && (
                <ActionButton action={joinPlusAction.bind(null, m.interval)} className="btn btn-sm bg-white text-ink">
                  {t("Renew now")}
                </ActionButton>
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
            {[
              { interval: "MONTHLY" as const, price: s["membership.monthlyCents"], per: t("/month") },
              { interval: "YEARLY" as const, price: s["membership.yearlyCents"], per: t("/year"), best: true },
            ].map((p) => (
              <div key={p.interval} className={`rounded-4xl p-7 shadow-lift ${p.best ? "bg-ink text-white" : "bg-white"}`}>
                {p.best && <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-mint-deep">{t("Best value")}</span>}
                <p className="mt-3 text-4xl font-extrabold">
                  {formatMoney(p.price, locale)}
                  <span className="text-base font-medium opacity-70">{p.per}</span>
                </p>
                {!user ? (
                  <Link href="/login?next=/plus" className={`mt-6 w-full ${p.best ? "btn bg-white text-ink" : "btn-primary"}`}>
                    {t("Sign in to join")}
                  </Link>
                ) : whish ? (
                  <ActionButton action={joinPlusAction.bind(null, p.interval)} className={`mt-6 w-full ${p.best ? "btn bg-white text-ink" : "btn-primary"}`}>
                    {t("Join with Whish")}
                  </ActionButton>
                ) : (
                  <p className={`mt-6 rounded-2xl p-3 text-center text-sm ${p.best ? "bg-white/10" : "bg-canvas"}`}>{t("Online sign-up opens soon.")}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <section className="container-x mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((b) => (
          <div key={b.title} className="card p-6">
            <b.icon className="h-6 w-6" />
            <h3 className="mt-4 font-bold">{b.title}</h3>
            <p className="mt-1 text-sm text-ink-muted">{b.body}</p>
          </div>
        ))}
      </section>
      <p className="container-x mt-6 text-xs text-ink-muted">{t("Membership renews until cancelled. Cancellation benefits never override an organizer's stated policy. See our terms for details.")}</p>
    </div>
  );
}
