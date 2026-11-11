import Link from "next/link";
import { Plus } from "lucide-react";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader } from "@/components/portal/shell";
import { EmptyState } from "@/components/empty";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Activities & events" };

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "bg-mint-soft text-mint-deep",
  DRAFT: "bg-ink/[.06] text-ink-soft",
  PENDING_REVIEW: "bg-peach-soft text-peach-deep",
  REJECTED: "bg-red-50 text-red-700",
  ARCHIVED: "bg-ink/[.06] text-ink-muted",
};

export default async function EventsList() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const events = await prisma.event.findMany({
    where: { merchantId: ctx.merchant.id },
    include: { _count: { select: { bookings: { where: { status: { in: ["CONFIRMED", "COMPLETED", "RESERVED_PAY_AT_VENUE"] } } } } }, sessions: { where: { startsAt: { gt: new Date() }, status: "SCHEDULED" }, select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });
  const label: Record<string, string> = { PUBLISHED: t("Live"), DRAFT: t("Draft"), PENDING_REVIEW: t("In review"), REJECTED: t("Rejected"), ARCHIVED: t("Archived") };
  return (
    <>
      <PageHeader
        title={t("Activities & events")}
        actions={
          <Link href="/merchant/events/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            {t("New listing")}
          </Link>
        }
      />
      {events.length === 0 ? (
        <EmptyState title={t("No listings yet")} body={t("Create your first activity: add details, tickets and dates, then publish.")} cta={{ href: "/merchant/events/new", label: t("Create a listing") }} />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-ink/[.06] bg-white">
          {events.map((e) => (
            <Link key={e.id} href={`/merchant/events/${e.id}`} className="flex items-center gap-4 border-b border-ink/[.06] p-4 last:border-0 hover:bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaSrc(e.coverId, e.coverUrl)} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{loc(e.title, locale) || t("Untitled")}</p>
                <p className="text-xs text-ink-muted">
                  {t("{n} upcoming dates", { n: e.sessions.length })} · {t("{n} bookings", { n: e._count.bookings })} · {e.isFree ? t("Free") : t("From {price}", { price: formatMoney(e.fromPriceCents, locale) })}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[e.status]}`}>{label[e.status]}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
