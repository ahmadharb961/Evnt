"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Timer, Wallet, Store, Gift } from "lucide-react";
import { checkoutAction } from "@/actions/booking";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useT } from "@/i18n/client";

export function Countdown({ until }: { until: string }) {
  const t = useT();
  const [left, setLeft] = useState(() => Date.parse(until) - Date.now());
  useEffect(() => {
    const iv = setInterval(() => setLeft(Date.parse(until) - Date.now()), 1000);
    return () => clearInterval(iv);
  }, [until]);
  if (left <= 0) return <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{t("Your hold expired. Please go back and choose again.")}</p>;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <p className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${left < 120000 ? "bg-peach-soft text-peach-deep" : "bg-mint-soft text-mint-deep"}`}>
      <Timer className="h-4 w-4" />
      {t("We're holding your spots for {time}", { time: `${m}:${String(s).padStart(2, "0")}` })}
    </p>
  );
}

export function CheckoutForm({
  code,
  name,
  phone,
  tickets,
  total,
  methods,
  whishPending,
  policy,
}: {
  code: string;
  name: string;
  phone: string;
  tickets: { label: string }[];
  total: string;
  methods: ("FREE" | "WHISH" | "PAY_AT_VENUE")[];
  whishPending: boolean;
  policy: string;
}) {
  const t = useT();
  const [state, action] = useActionState(checkoutAction, undefined);
  const [method, setMethod] = useState(methods[0] ?? "");
  const fe = state?.fieldErrors ?? {};
  const options = {
    FREE: { icon: Gift, title: t("Free booking"), body: t("No payment needed.") },
    WHISH: { icon: Wallet, title: t("Pay with Whish Money"), body: t("Secure payment on the Whish page. Your booking is confirmed when Whish confirms the payment.") },
    PAY_AT_VENUE: { icon: Store, title: t("Pay at the venue"), body: t("Your spots are reserved. Pay the organizer when you arrive.") },
  } as const;
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="method" value={method} />
      <FormMessage state={state} />
      <section className="space-y-4">
        <h2 className="text-lg font-bold">{t("Your details")}</h2>
        <Field label={t("Full name")} name="contactName" defaultValue={name} autoComplete="name" required error={fe.contactName} />
        <Field label={t("Mobile number")} name="contactPhone" type="tel" defaultValue={phone ? `+${phone}` : ""} autoComplete="tel" required error={fe.contactPhone} />
      </section>
      {tickets.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{t("Who's coming?")}</h2>
          <p className="text-sm text-ink-muted">{t("Optional. A first name per ticket helps the organizer welcome your kids.")}</p>
          {tickets.map((tk, i) => (
            <Field key={i} label={tk.label} name="attendee" maxLength={80} placeholder={t("First name")} />
          ))}
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">{t("Payment")}</h2>
        {methods.length === 0 && (
          <p className="rounded-2xl bg-peach-soft px-4 py-3 text-sm text-peach-deep">
            {whishPending ? t("Online payment with Whish is coming soon. This activity can't be booked online yet — please contact the organizer.") : t("No payment method is available for this booking.")}
          </p>
        )}
        {methods.map((m) => {
          const o = options[m];
          const on = method === m;
          return (
            <button key={m} type="button" onClick={() => setMethod(m)} className={`flex w-full items-start gap-3 rounded-3xl border p-4 text-start transition ${on ? "border-ink ring-2 ring-ink" : "border-ink/10 hover:border-ink/30"}`} aria-pressed={on}>
              <o.icon className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <span className="block font-semibold">{o.title}</span>
                <span className="block text-sm text-ink-muted">{o.body}</span>
              </span>
            </button>
          );
        })}
      </section>
      <section>
        <div className="rounded-2xl bg-canvas p-4 text-sm text-ink-soft">
          <p className="mb-1 font-semibold text-ink">{t("Cancellation policy")}</p>
          <p className="whitespace-pre-line">{policy}</p>
        </div>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input type="checkbox" name="policy" className="mt-1 h-4 w-4 accent-ink" />
          <span>
            {t("I accept the cancellation policy and the")}{" "}
            <Link href="/terms" className="underline">
              {t("Terms & conditions")}
            </Link>
          </span>
        </label>
        {fe.policy && <p className="mt-1 text-xs font-medium text-red-600">{fe.policy}</p>}
      </section>
      {methods.length > 0 && (
        <SubmitButton className="btn-primary h-12 w-full text-base">
          {method === "WHISH" ? t("Continue to Whish · {total}", { total }) : method === "PAY_AT_VENUE" ? t("Reserve now") : t("Confirm booking")}
        </SubmitButton>
      )}
    </form>
  );
}
