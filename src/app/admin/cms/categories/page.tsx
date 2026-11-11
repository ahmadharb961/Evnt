import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc, type Localized } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { LocalizedField } from "@/components/localized-field";
import { MediaInput } from "@/components/uploader";
import { saveCategoryAction } from "@/actions/admin";

export const metadata = { title: "Categories" };

export default async function CategoriesAdmin({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireAdmin("CONTENT", "ADMIN");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const cats = await prisma.category.findMany({ where: { parentId: null }, include: { children: { orderBy: { sort: "asc" } } }, orderBy: { sort: "asc" } });
  const all = cats.flatMap((c) => [c, ...c.children]);
  const edit = sp.edit ? all.find((c) => c.id === sp.edit) : null;
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t("Categories")} subtitle={t("The 7 primary categories are fixed; names, images, order and subcategories are editable.")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel>
          <ul className="space-y-3 text-sm">
            {cats.map((c) => (
              <li key={c.id}>
                <a href={`?edit=${c.id}`} className="font-semibold hover:underline">
                  {loc(c.name, locale)}
                </a>{" "}
                <span className="text-xs text-ink-muted">{c.kind}{c.commission ? ` · ${c.commission}` : ""}</span>
                <ul className="mt-1 flex flex-wrap gap-1.5 ps-3">
                  {c.children.map((s) => (
                    <li key={s.id}>
                      <a href={`?edit=${s.id}`} className={`chip !min-h-7 !text-xs ${s.active ? "" : "opacity-50"}`}>
                        {loc(s.name, locale)}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={edit ? t("Edit {name}", { name: loc(edit.name, locale) }) : t("New subcategory")}>
          <ActionForm action={saveCategoryAction} hidden={edit ? { id: edit.id } : undefined} submit={t("Save")} key={edit?.id ?? "new"}>
            {!edit && (
              <label className="block">
                <span className="label">{t("Parent category")}</span>
                <select name="parentId" className="input">
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {loc(c.name, locale)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <LocalizedField name="name" label={t("Name")} initial={(edit?.name ?? {}) as Localized} required />
            <LocalizedField name="blurb" label={t("Short description (SEO)")} initial={(edit?.blurb ?? {}) as Localized} multiline rows={2} />
            <MediaInput name="imageId" initial={edit?.imageId} aspect="aspect-square" label={t("Image (optional)")} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">{t("Order")}</span>
                <input name="sort" type="number" defaultValue={edit?.sort ?? 0} className="input" />
              </label>
              <label className="flex items-center gap-2 pt-7 text-sm">
                <input type="checkbox" name="active" defaultChecked={edit ? edit.active : true} className="accent-ink" />
                {t("Active")}
              </label>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
