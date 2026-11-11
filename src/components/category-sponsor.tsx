import Link from "next/link";
import { prisma } from "@/server/db";
import { liveCampaigns } from "@/server/home";
import { mediaSrc } from "@/server/media";
import type { T } from "@/i18n/core";

/** The month's category sponsor (exclusive placement), clearly labelled as sponsored. */
export async function CategorySponsor({ categoryId, t }: { categoryId: string; t: T }) {
  const [c] = await liveCampaigns("CATEGORY_SPONSOR", { categoryId });
  if (!c) return null;
  const [merchant, ev] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: c.merchantId }, select: { name: true, slug: true } }),
    c.eventId ? prisma.event.findUnique({ where: { id: c.eventId }, select: { slug: true } }) : null,
  ]);
  await prisma.adCampaign.update({ where: { id: c.id }, data: { impressions: { increment: 1 } } });
  const href = ev ? `/events/${ev.slug}?ad=${c.id}` : `/m/${merchant?.slug}?ad=${c.id}`;
  return (
    <Link href={href} className="mt-6 flex items-center gap-4 overflow-hidden rounded-3xl border border-ink/[.06] bg-peach-soft p-3 pe-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaSrc(c.creativeId)} alt="" className="h-16 w-24 shrink-0 rounded-2xl object-cover sm:h-20 sm:w-32" />
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-peach-deep">{t("Sponsored")} · {merchant?.name}</span>
        <p className="truncate font-semibold">{c.headline}</p>
      </div>
    </Link>
  );
}
