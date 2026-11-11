import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { cartView } from "@/server/orders";
import { whishAvailable } from "@/server/payments";
import { getLocale, getT } from "@/i18n/server";
import { CheckoutForm } from "@/components/cart-ui";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ShopCheckout() {
  const user = await requireUser("/cart/checkout");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const v = await cartView(locale);
  if (!v.groups.length) redirect("/cart");
  const whish = await whishAvailable();
  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Delivery & payment")}</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        <CheckoutForm name={user.name} phone={user.phone ?? ""} codAvailable={v.groups.every((g) => g.codEnabled)} whishAvailable={whish} total={formatMoney(v.totalCents, locale)} />
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card space-y-3 p-5 text-sm">
            {v.groups.map((g) => (
              <div key={g.merchantId}>
                <p className="font-semibold">{g.merchantName}</p>
                {g.items.map((i) => (
                  <p key={i.id} className="flex justify-between text-ink-soft">
                    <span className="truncate pe-2">
                      {i.quantity} × {i.title}
                    </span>
                    <span>{formatMoney(i.lineCents, locale)}</span>
                  </p>
                ))}
                <p className="flex justify-between text-ink-muted">
                  <span>{t("Delivery")}</span>
                  <span>{formatMoney(g.deliveryCents, locale)}</span>
                </p>
              </div>
            ))}
            <p className="flex justify-between border-t border-ink/10 pt-3 text-base font-bold">
              <span>{t("Total")}</span>
              <span>{formatMoney(v.totalCents, locale)}</span>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
