"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestReservationAction } from "@/actions/restaurants";
import { FormMessage, SubmitButton } from "@/components/form";
import { useT } from "@/i18n/client";

export function ReservationForm({ restaurantId, maxParty, signedIn, phone, minDate, deposit, next }: { restaurantId: string; maxParty: number; signedIn: boolean; phone: string; minDate: string; deposit: string | null; next: string }) {
  const t = useT();
  const [state, action] = useActionState(requestReservationAction, undefined);
  if (state?.ok)
    return (
      <div className="rounded-3xl bg-mint-soft p-5 text-sm text-mint-deep">
        <p className="font-semibold">{state.message}</p>
        <Link href="/account/reservations" className="mt-2 inline-block font-semibold underline">
          {t("View my reservations")}
        </Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">{t("Date")}</span>
          <input name="date" type="date" min={minDate} required className="input" />
        </label>
        <label className="block">
          <span className="label">{t("Time")}</span>
          <input name="time" type="time" required defaultValue="13:00" step={900} className="input" />
        </label>
        <label className="block">
          <span className="label">{t("Adults")}</span>
          <input name="adults" type="number" min={1} max={maxParty} defaultValue={2} required className="input" />
        </label>
        <label className="block">
          <span className="label">{t("Children")}</span>
          <input name="children" type="number" min={0} max={maxParty} defaultValue={1} className="input" />
        </label>
      </div>
      <label className="block">
        <span className="label">{t("Mobile number")}</span>
        <input name="phone" type="tel" defaultValue={phone ? `+${phone}` : ""} required className="input" />
        {state?.fieldErrors?.phone && <span className="mt-1 block text-xs text-red-600">{state.fieldErrors.phone}</span>}
      </label>
      <label className="block">
        <span className="label">{t("Special requests (optional)")}</span>
        <textarea name="requests" rows={2} maxLength={500} className="input" placeholder={t("High chair, birthday, near the play area…")} />
      </label>
      {deposit && <p className="text-xs text-ink-muted">{t("A deposit of {amount} may be requested once the restaurant confirms.", { amount: deposit })}</p>}
      {signedIn ? (
        <SubmitButton className="btn-primary h-12 w-full">{t("Request a table")}</SubmitButton>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-primary h-12 w-full">
          {t("Sign in to reserve")}
        </Link>
      )}
    </form>
  );
}
