import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { getLocale, getT } from "@/i18n/server";
import { rankedItems } from "@/server/picker";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { OrderedPicker } from "@/components/admin/ordered-picker";
import { saveRankingAction } from "@/actions/admin";
import { PICK_KINDS, type PickKind } from "@/lib/picker";

export const metadata = { title: "Ordering & priority" };

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin("CONTENT", "ADMIN");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const tab: PickKind = PICK_KINDS.includes(sp.tab as PickKind) ? (sp.tab as PickKind) : "merchant";
  const items = await rankedItems(tab, locale);
  const tabs: [PickKind, string][] = [
    ["merchant", t("Businesses")],
    ["event", t("Activities & events")],
    ["restaurant", t("Restaurants")],
    ["product", t("Products")],
  ];
  const help: Record<PickKind, string> = {
    merchant: t("All listings of these businesses show before everyone else's, in this order — on the homepage, in search and in categories."),
    event: t("These activities show first wherever the recommended order is used, ahead of pinned businesses."),
    restaurant: t("These restaurants show first wherever the recommended order is used, ahead of pinned businesses."),
    product: t("These products show first in the shop and in product sections, ahead of pinned businesses."),
  };
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t("Ordering & priority")} subtitle={t("Decide who shows first. Pinned items come first, in your order; everything else follows the automatic recommended order.")} />
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/admin/ranking?tab=${k}`} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? "bg-ink text-white" : "bg-white text-ink-soft hover:text-ink"}`}>
            {label}
          </Link>
        ))}
      </nav>
      <Panel title={tabs.find(([k]) => k === tab)![1]}>
        <p className="mb-4 text-sm text-ink-muted">{help[tab]}</p>
        <ActionForm key={tab} action={saveRankingAction} hidden={{ kind: tab }} submit={t("Save order")}>
          <OrderedPicker name="ids" kinds={[tab]} initial={items} max={100} />
        </ActionForm>
      </Panel>
      <p className="text-xs text-ink-muted">
        {t("Paid placements are managed in Advertising and are always labelled as sponsored. Sold-out activities and out-of-stock products still move to the end so families never see unavailable items first.")}
      </p>
    </div>
  );
}
