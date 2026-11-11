import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { moderateListingAction, reindexAction } from "@/actions/admin";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Listings" };

export default async function ListingsAdmin({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  await requireAdmin("CONTENT", "ADMIN");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const type = sp.type === "products" ? "products" : sp.type === "restaurants" ? "restaurants" : "events";
  const q = sp.q?.toLowerCase();
  const [events, products, restaurants] = await Promise.all([
    type === "events" ? prisma.event.findMany({ where: q ? { searchText: { contains: q } } : {}, include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }) : [],
    type === "products" ? prisma.product.findMany({ where: q ? { searchText: { contains: q } } : {}, include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }) : [],
    type === "restaurants" ? prisma.restaurant.findMany({ where: q ? { searchText: { contains: q } } : {}, include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }) : [],
  ]);
  const rows =
    type === "events"
      ? events.map((e) => ({ id: e.id, title: loc(e.title, locale), href: `/events/${e.slug}`, merchant: e.merchant.name, status: e.status, extra: e.isFree ? t("Free") : formatMoney(e.fromPriceCents, locale) }))
      : type === "products"
        ? products.map((p) => ({ id: p.id, title: loc(p.title, locale), href: `/shop/p/${p.slug}`, merchant: p.merchant.name, status: p.status, extra: formatMoney(p.priceCents, locale) }))
        : restaurants.map((r) => ({ id: r.id, title: r.name, href: `/restaurants/${r.slug}`, merchant: r.merchant.name, status: r.status, extra: r.cuisines.join(", ") }));
  const kind = type === "events" ? "event" : type === "products" ? "product" : "restaurant";
  return (
    <div className="max-w-6xl">
      <PageHeader title={t("Listings")} actions={<ActionButton action={reindexAction}>{t("Rebuild search index")}</ActionButton>} />
      <form className="mb-4 flex flex-wrap gap-2">
        {[
          ["events", t("Activities & events")],
          ["restaurants", t("Restaurants")],
          ["products", t("Products")],
        ].map(([k, l]) => (
          <Link key={k} href={`/admin/listings?type=${k}`} className={`chip ${type === k ? "chip-on" : ""}`}>
            {l}
          </Link>
        ))}
        <input type="hidden" name="type" value={type} />
        <input name="q" defaultValue={sp.q} placeholder={t("Search")} className="input !h-9 !w-56 !rounded-full !py-0 text-sm" />
      </form>
      <Panel>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span>
                <Link href={r.href} target="_blank" className="font-medium hover:underline">
                  {r.title}
                </Link>
                <span className="block text-xs text-ink-muted">
                  {r.merchant} · {r.extra} · {r.status}
                </span>
              </span>
              <span className="flex gap-2">
                {r.status === "PUBLISHED" ? (
                  <ActionButton action={moderateListingAction.bind(null, kind, r.id, "REJECTED")} className="btn-danger btn-sm" prompt={t("Reason for taking it down (sent to the merchant):")}>
                    {t("Take down")}
                  </ActionButton>
                ) : (
                  (r.status === "REJECTED" || r.status === "ARCHIVED") && (
                    <ActionButton action={moderateListingAction.bind(null, kind, r.id, "PUBLISHED")} className="btn-outline btn-sm">
                      {t("Restore")}
                    </ActionButton>
                  )
                )}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
