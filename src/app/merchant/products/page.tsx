import Link from "next/link";
import { Plus } from "lucide-react";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { mediaSrc } from "@/server/media";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { EmptyState } from "@/components/empty";
import { ActionForm } from "@/components/portal/action-form";
import { saveShopSettingsAction } from "@/actions/merchant-shop";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Products" };

export default async function ProductsList() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const products = await prisma.product.findMany({ where: { merchantId: ctx.merchant.id }, include: { variants: { where: { active: true } } }, orderBy: { createdAt: "desc" } });
  const m = ctx.merchant;
  const img = (s?: string) => (!s ? mediaSrc() : s.startsWith("/") ? s : mediaSrc(s));
  return (
    <>
      <PageHeader
        title={t("Products")}
        actions={
          <Link href="/merchant/products/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            {t("New product")}
          </Link>
        }
      />
      {products.length === 0 ? (
        <EmptyState title={t("No products yet")} cta={{ href: "/merchant/products/new", label: t("Add a product") }} />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-ink/[.06] bg-white">
          {products.map((p) => {
            const stock = p.variants.reduce((a, v) => a + v.stock, 0);
            return (
              <Link key={p.id} href={`/merchant/products/${p.id}`} className="flex items-center gap-4 border-b border-ink/[.06] p-4 last:border-0 hover:bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(p.images[0])} alt="" className="h-14 w-14 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{loc(p.title, locale)}</p>
                  <p className={`text-xs ${stock <= 3 ? "text-peach-deep" : "text-ink-muted"}`}>
                    {formatMoney(p.salePriceCents ?? p.priceCents, locale)} · {t("{n} in stock", { n: stock })}
                  </p>
                </div>
                <span className="rounded-full bg-ink/[.06] px-2.5 py-1 text-xs font-semibold">{p.status === "PUBLISHED" ? t("Live") : p.status === "DRAFT" ? t("Draft") : t("Archived")}</span>
              </Link>
            );
          })}
        </div>
      )}
      <Panel title={t("Delivery & payment settings")} className="mt-6 max-w-xl">
        <ActionForm action={saveShopSettingsAction} submit={t("Save")}>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="label">{t("Delivery fee (USD)")}</span>
              <input name="deliveryFee" inputMode="decimal" defaultValue={(m.deliveryFeeCents / 100).toString()} className="input" />
            </label>
            <label className="block">
              <span className="label">{t("Free delivery over (optional)")}</span>
              <input name="freeOver" inputMode="decimal" defaultValue={m.freeDeliveryOverCents != null ? (m.freeDeliveryOverCents / 100).toString() : ""} className="input" />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="cod" defaultChecked={m.codEnabled} className="h-4 w-4 accent-ink" />
            {t("Accept cash on delivery")}
          </label>
        </ActionForm>
      </Panel>
    </>
  );
}
