import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc, type Localized } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { LocalizedField } from "@/components/localized-field";
import { GalleryInput } from "@/components/uploader";
import { VariantRows } from "@/components/portal/variant-rows";
import { saveProductAction, setProductStatusAction } from "@/actions/merchant-shop";

export const metadata = { title: "Product" };
const L = (v: unknown) => (v ?? {}) as Localized;

export default async function ProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMerchant("MANAGER");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const p = id === "new" ? null : await prisma.product.findUnique({ where: { id }, include: { variants: { where: { active: true }, orderBy: { name: "asc" } } } });
  if (id !== "new" && (!p || p.merchantId !== ctx.merchant.id)) notFound();
  const cats = await prisma.category.findMany({ where: { kind: "PRODUCT", parentId: { not: null }, active: true }, orderBy: { sort: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={p ? loc(p.title, locale) : t("New product")}
        actions={
          p && (
            <>
              <Link href={`/shop/p/${p.slug}`} target="_blank" className="btn-outline btn-sm">
                <ExternalLink className="h-3.5 w-3.5" />
                {t("Preview")}
              </Link>
              {p.status !== "PUBLISHED" ? (
                <ActionButton action={setProductStatusAction.bind(null, p.id, "PUBLISHED")} className="btn-primary btn-sm">
                  {t("Publish")}
                </ActionButton>
              ) : (
                <ActionButton action={setProductStatusAction.bind(null, p.id, "DRAFT")} className="btn-outline btn-sm">
                  {t("Unpublish")}
                </ActionButton>
              )}
            </>
          )
        }
      />
      <ActionForm action={saveProductAction} hidden={p ? { id: p.id } : undefined} submit={p ? t("Save changes") : t("Create product")} className="space-y-6">
        <Panel title={t("Product")}>
          <div className="space-y-5">
            <LocalizedField name="title" label={t("Name")} initial={L(p?.title)} required maxLength={120} />
            <label className="block">
              <span className="label">{t("Category")}</span>
              <select name="categoryId" defaultValue={p?.categoryId ?? ""} required className="input">
                <option value="" disabled>
                  {t("Choose…")}
                </option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {loc(c.name, locale)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-4">
              <label className="block">
                <span className="label">{t("Price (USD)")}</span>
                <input name="price" inputMode="decimal" required defaultValue={p ? (p.priceCents / 100).toString() : ""} className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Sale price")}</span>
                <input name="salePrice" inputMode="decimal" defaultValue={p?.salePriceCents != null ? (p.salePriceCents / 100).toString() : ""} className="input" />
              </label>
              <label className="block">
                <span className="label">{t("From age")}</span>
                <input name="ageMin" type="number" min={0} max={16} defaultValue={p?.ageMin ?? ""} className="input" />
              </label>
              <label className="block">
                <span className="label">{t("To age")}</span>
                <input name="ageMax" type="number" min={0} max={16} defaultValue={p?.ageMax ?? ""} className="input" />
              </label>
            </div>
          </div>
        </Panel>
        <Panel title={t("Photos")}>
          <GalleryInput name="images" initial={p?.images ?? []} />
        </Panel>
        <Panel title={t("Options & stock")}>
          <VariantRows initial={(p?.variants ?? []).map((v) => ({ id: v.id, name: v.name, stock: v.stock, price: v.priceCents != null ? (v.priceCents / 100).toString() : "" }))} />
        </Panel>
        <Panel title={t("Description & delivery")}>
          <div className="space-y-5">
            <LocalizedField name="description" label={t("Description")} initial={L(p?.description)} multiline rows={5} />
            <LocalizedField name="deliveryInfo" label={t("Delivery information")} initial={L(p?.deliveryInfo)} multiline rows={2} />
          </div>
        </Panel>
      </ActionForm>
    </div>
  );
}
