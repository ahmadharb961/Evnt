import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { joinAction } from "@/actions/merchant-onboarding";
import { ActionForm } from "@/components/portal/action-form";

export const metadata = { title: "List your business", robots: { index: false } };

export default async function JoinPage() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  const types = [
    ["ACTIVITY_PROVIDER", t("Activities, workshops & classes")],
    ["VENUE", t("Venue or play area")],
    ["EVENT_ORGANIZER", t("Shows & events organizer")],
    ["RESTAURANT", t("Restaurant or café")],
    ["RETAILER", t("Shop (kids' products)")],
    ["BIRTHDAY_SERVICE", t("Birthday services")],
  ];
  return (
    <div className="container-x flex justify-center py-10">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold tracking-tight">{t("List your business")}</h1>
        <p className="mt-2 text-ink-muted">{t("Free to join. Go live after a quick verification.")}</p>
        <div className="card mt-6 p-6 sm:p-8">
          <ActionForm action={joinAction} submit={t("Create my business account")} submitClass="btn-primary w-full">
            {!user ? (
              <>
                <label className="block">
                  <span className="label">{t("Your name")}</span>
                  <input name="name" required className="input" autoComplete="name" />
                </label>
                <label className="block">
                  <span className="label">{t("Email")}</span>
                  <input name="email" type="email" required className="input" autoComplete="email" />
                </label>
                <label className="block">
                  <span className="label">{t("Mobile number")}</span>
                  <input name="phone" type="tel" required className="input" placeholder="70 123 456" />
                </label>
                <label className="block">
                  <span className="label">{t("Password")}</span>
                  <input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
                </label>
              </>
            ) : (
              <p className="rounded-2xl bg-canvas p-3 text-sm">{t("Signed in as {email}", { email: user.email })}</p>
            )}
            <label className="block">
              <span className="label">{t("Business name")}</span>
              <input name="businessName" required className="input" />
            </label>
            <label className="block">
              <span className="label">{t("Business type")}</span>
              <select name="type" required className="input" defaultValue="">
                <option value="" disabled>
                  {t("Choose…")}
                </option>
                {types.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-start gap-3 text-sm text-ink-soft">
              <input type="checkbox" name="terms" className="mt-1 h-4 w-4 accent-ink" />
              <span>
                {t("I agree to the")}{" "}
                <Link href="/terms#merchants" className="underline">
                  {t("merchant terms")}
                </Link>
              </span>
            </label>
          </ActionForm>
        </div>
        {!user && (
          <p className="mt-4 text-center text-sm text-ink-muted">
            {t("Already have an EVNT account?")}{" "}
            <Link href="/login?next=/business/join" className="font-semibold text-ink">
              {t("Sign in first")}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
