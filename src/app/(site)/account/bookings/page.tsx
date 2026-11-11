import Link from "next/link";
import { Ticket } from "lucide-react";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { fmtDateTime } from "@/lib/dates";
import { BOOKING_STATUS } from "@/lib/status";
import { StatusPill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty";

export const metadata = { title: "My bookings", robots: { index: false } };

export default async function BookingsPage() {
  const user = await requireUser("/account/bookings");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: { userId: user.id, status: { notIn: ["EXPIRED"] } },
    include: { event: true, session: true, _count: { select: { tickets: true } } },
    orderBy: { session: { startsAt: "asc" } },
    take: 200,
  });
  const upcoming = bookings.filter((b) => b.session.endsAt >= now && ["CONFIRMED", "RESERVED_PAY_AT_VENUE", "PENDING_PAYMENT"].includes(b.status));
  const past = bookings.filter((b) => !upcoming.includes(b)).reverse();
  const Row = ({ b }: { b: (typeof bookings)[number] }) => (
    <Link href={b.status === "PENDING_PAYMENT" ? `/checkout/${b.code}` : `/account/bookings/${b.code}`} className="card flex gap-4 p-3 transition hover:shadow-lift">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaSrc(b.event.coverId, b.event.coverUrl)} alt="" className="h-20 w-24 shrink-0 rounded-2xl object-cover sm:w-32" />
      <div className="min-w-0 flex-1 py-1">
        <p className="truncate font-semibold">{loc(b.event.title, locale)}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{fmtDateTime(b.session.startsAt, locale)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill map={BOOKING_STATUS} status={b.status} t={t} />
          {b._count.tickets > 0 && <span className="text-xs text-ink-muted">{t(b._count.tickets === 1 ? "{n} ticket" : "{n} tickets", { n: b._count.tickets })}</span>}
        </div>
      </div>
    </Link>
  );
  if (!bookings.length) return <EmptyState icon={Ticket} title={t("No bookings yet")} body={t("When you book an activity, your tickets will appear here.")} cta={{ href: "/activities", label: t("Find something to do") }} />;
  return (
    <div className="space-y-10">
      <section>
        <h1 className="h-section mb-4">{t("Upcoming")}</h1>
        {upcoming.length ? <div className="grid gap-3 md:grid-cols-2">{upcoming.map((b) => <Row key={b.id} b={b} />)}</div> : <p className="text-sm text-ink-muted">{t("Nothing coming up.")}</p>}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="h-section mb-4">{t("Past & cancelled")}</h2>
          <div className="grid gap-3 md:grid-cols-2">{past.map((b) => <Row key={b.id} b={b} />)}</div>
        </section>
      )}
    </div>
  );
}
