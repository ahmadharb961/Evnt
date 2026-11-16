import Link from "next/link";
import { Pencil, ExternalLink, Plus, Search } from "lucide-react";
import type { ListingStatus } from "@prisma/client";
import { requireAdmin, hasRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { editListingAsAdminAction, moderateListingAction, reindexAction } from "@/actions/admin";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Listings" };

const src = (id?: string | null, url?: string | null) => (id ? (id.startsWith("/") || id.startsWith("http") ? id : `/media/${id}`) : url || "/brand/placeholder.svg");

const STATUS: Record<ListingStatus, { label: string; cls: string }> = {
  PUBLISHED: { label: "Live", cls: "bg-emerald-100 text-emerald-800" },
  DRAFT: { label: "Draft", cls: "bg-slate-100 text-slate-700" },
  PENDING_REVIEW: { label: "Waiting for review", cls: "bg-amber-100 text-amber-800" },
  REJECTED: { label: "Taken down", cls: "bg-rose-100 text-rose-800" },
  ARCHIVED: { label: "Archived", cls: "bg-slate-100 text-slate-500" },
} as Record<ListingStatus, { label: string; cls: string }>;

export default async function ListingsAdmin({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; status?: string }> }) {
  const me = await requireAdmin("CONTENT", "ADMIN");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const canEdit = hasRole(me, "ADMIN");
  const type = sp.type === "products" ? "products" : sp.type === "restaurants" ? "restaurants" : "events";
  const q = sp.q?.toLowerCase();
  const status = sp.status && sp.status in STATUS ? (sp.status as ListingStatus) : undefined;
  const where = { ...(q ? { searchText: { contains: q } } : {}), ...(status ? { status } : {}) };
  const [counts, events, products, restaurants] = await Promise.all([
    Promise.all([prisma.event.count(), prisma.restaurant.count(), prisma.product.count()]),
    type === "events" ? prisma.event.findMany({ where, include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }) : [],
    type === "products" ? prisma.product.findMany({ where, include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }) : [],
    type === "restaurants" ? prisma.restaurant.findMany({ where, include: { merchant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }) : [],
  ]);
  const rows =
    type === "events"
      ? events.map((e) => ({ id: e.id, title: loc(e.title, locale), href: `/events/${e.slug}`, img: src(e.coverId, e.coverUrl), merchant: e.merchant.name, status: e.status, extra: e.isFree ? t("Free") : t("From {price}", { price: formatMoney(e.fromPriceCents, locale) }) }))
      : type === "products"
        ? products.map((p) => ({ id: p.id, title: loc(p.title, locale), href: `/shop/p/${p.slug}`, img: src(p.images[0]), merchant: p.merchant.name, status: p.status, extra: formatMoney(p.salePriceCents ?? p.priceCents, locale) }))
        : restaurants.map((r) => ({ id: r.id, title: r.name, href: `/restaurants/${r.slug}`, img: src(r.coverId, r.coverUrl), merchant: r.merchant.name, status: r.status, extra: r.cuisines.join(", ") }));
  const kind = type === "events" ? "event" : type === "products" ? "product" : "restaurant";
  const tabs = [
    ["events", t("Activities & events"), counts[0], "bg-peach-soft text-peach-deep"],
    ["restaurants", t("Restaurants"), counts[1], "bg-mint-soft text-mint-deep"],
    ["products", t("Products"), counts[2], "bg-blush-soft text-blush-deep"],
  ] as const;
  const qs = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ type, q: sp.q, status: sp.status, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t("Listings")}
        subtitle={t("Every activity, restaurant and product on EVNT. Edit any of them, or take them down.")}
        actions={
          <>
            {canEdit && (
              <Link href="/admin/create" className="btn-primary btn-sm">
                <Plus className="h-4 w-4" /> {t("Create new")}
              </Link>
            )}
            <ActionButton action={reindexAction}>{t("Refresh search")}</ActionButton>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {tabs.map(([k, l, n, cls]) => (
          <Link key={k} href={`/admin/listings?type=${k}`} className={`flex items-center justify-between rounded-3xl p-4 ring-1 transition ${type === k ? "ring-2 ring-ink" : "ring-ink/[.06] hover:shadow-card"} ${cls}`}>
            <span className="font-semibold">{l}</span>
            <span className="text-2xl font-bold">{n}</span>
          </Link>
        ))}
      </div>
      <form className="mb-5 flex flex-wrap items-center gap-2">
        <input type="hidden" name="type" value={type} />
        {status && <input type="hidden" name="status" value={status} />}
        <span className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input name="q" defaultValue={sp.q} placeholder={t("Search")} className="input !h-10 !w-60 !rounded-full !py-0 !ps-10 text-sm" />
        </span>
        <Link href={qs({ status: undefined })} className={`chip ${!status ? "chip-on" : ""}`}>
          {t("All")}
        </Link>
        {(Object.keys(STATUS) as ListingStatus[]).map((s) => (
          <Link key={s} href={qs({ status: s })} className={`chip ${status === s ? "chip-on" : ""}`}>
            {t(STATUS[s].label)}
          </Link>
        ))}
      </form>
      {rows.length === 0 && <p className="rounded-3xl bg-white p-8 text-center text-sm text-ink-muted">{t("Nothing here yet.")}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const st = STATUS[r.status] ?? STATUS.DRAFT;
          return (
            <div key={r.id} className="flex flex-col overflow-hidden rounded-3xl border border-ink/[.07] bg-white shadow-card">
              <div className="relative aspect-[16/9] bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.img} alt="" loading="lazy" className={`h-full w-full ${type === "products" ? "object-contain p-2" : "object-cover"}`} />
                <span className={`absolute start-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>{t(st.label)}</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="line-clamp-1 font-semibold">{r.title}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">
                  {r.merchant} · {r.extra}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {canEdit && (
                    <ActionButton action={editListingAsAdminAction.bind(null, kind, r.id)} className="btn-primary btn-sm">
                      <Pencil className="h-3.5 w-3.5" /> {t("Edit")}
                    </ActionButton>
                  )}
                  <Link href={r.href} target="_blank" className="btn-outline btn-sm">
                    <ExternalLink className="h-3.5 w-3.5" /> {t("View")}
                  </Link>
                  {r.status === "PUBLISHED" ? (
                    <ActionButton action={moderateListingAction.bind(null, kind, r.id, "REJECTED")} className="btn-sm rounded-full px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50" prompt={t("Reason for taking it down (sent to the merchant):")}>
                      {t("Take down")}
                    </ActionButton>
                  ) : (
                    (r.status === "REJECTED" || r.status === "ARCHIVED") && (
                      <ActionButton action={moderateListingAction.bind(null, kind, r.id, "PUBLISHED")} className="btn-sm rounded-full px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                        {t("Restore")}
                      </ActionButton>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
