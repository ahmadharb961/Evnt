import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { cartView } from "@/server/orders";
import { getLocale, getT } from "@/i18n/server";
import { EmptyState } from "@/components/empty";
import { DiscountForm, QtyControl } from "@/components/cart-ui";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Cart", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const v = await cartView(locale);
  if (!v.groups.length && !v.problems.length) return <div className="container-x py-10"><EmptyState icon={ShoppingBag} title={t("Your cart is empty")} body={t("Find toys, gifts and essentials from Lebanese shops.")} cta={{ href: "/shop", label: t("Start shopping") }} /></div>;
  const money = (c: number) => formatMoney(c, locale);
  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Your cart")}</h1>
      {v.problems.length > 0 && <p className="mt-4 rounded-2xl bg-peach-soft p-3 text-sm text-peach-deep">{t("These items are no longer available and won't be ordered: {list}", { list: v.problems.join(", ") })}</p>}
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {v.groups.map((g) => (
            <section key={g.merchantId} className="card p-5">
              <p className="mb-3 text-sm font-semibold">{t("From {shop}", { shop: g.merchantName })}</p>
              <ul className="divide-y divide-ink/[.06]">
                {g.items.map((i) => (
                  <li key={i.id} className="flex gap-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.image} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/shop/p/${i.slug}`} className="line-clamp-2 text-sm font-medium">
                        {i.title}
                      </Link>
                      {i.variant !== "Default" && <p className="text-xs text-ink-muted">{i.variant}</p>}
                      <div className="mt-2 flex items-center justify-between">
                        <QtyControl itemId={i.id} quantity={i.quantity} stock={i.stock} />
                        <span className="text-sm font-semibold">{money(i.lineCents)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1 border-t border-ink/[.06] pt-3 text-sm text-ink-soft">
                <div className="flex justify-between">
                  <span>{t("Delivery")}</span>
                  <span>{g.deliveryCents ? money(g.deliveryCents) : t("Free")}</span>
                </div>
                {g.discountCents > 0 && (
                  <div className="flex justify-between text-mint-deep">
                    <span>{t("Discount")}</span>
                    <span>-{money(g.discountCents)}</span>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card space-y-4 p-5">
            <DiscountForm current={v.discountCode} invalid={v.discountError} />
            {v.discountError && <p className="text-xs text-red-600">{t("This code isn't valid for your cart")}</p>}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span>{t("Items")}</span>
                <span>{money(v.groups.reduce((a, g) => a + g.subtotalCents, 0))}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("Delivery")}</span>
                <span>{money(v.groups.reduce((a, g) => a + g.deliveryCents, 0))}</span>
              </div>
              {v.groups.some((g) => g.discountCents) && (
                <div className="flex justify-between text-mint-deep">
                  <span>{t("Discount")}</span>
                  <span>-{money(v.groups.reduce((a, g) => a + g.discountCents, 0))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-bold">
                <span>{t("Total")}</span>
                <span>{money(v.totalCents)}</span>
              </div>
            </div>
            {v.groups.length > 1 && <p className="text-xs text-ink-muted">{t("Your order will be split into {n} deliveries, one per shop.", { n: v.groups.length })}</p>}
            <Link href="/cart/checkout" className="btn-primary h-12 w-full">
              {t("Checkout")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
