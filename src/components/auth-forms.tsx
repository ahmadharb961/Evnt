"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, requestPasswordResetAction, resetPasswordAction } from "@/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { rich, useT } from "@/i18n/client";

export function LoginForm({ next }: { next?: string }) {
  const t = useT();
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field label={t("Email")} name="email" type="email" autoComplete="email" required />
      <Field label={t("Password")} name="password" type="password" autoComplete="current-password" required />
      <div className="text-end">
        <Link href="/forgot-password" className="text-sm text-ink-muted underline-offset-4 hover:underline">
          {t("Forgot password?")}
        </Link>
      </div>
      <SubmitButton>{t("Sign in")}</SubmitButton>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const t = useT();
  const [state, action] = useActionState(registerAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field label={t("Full name")} name="name" autoComplete="name" required error={fe.name} />
      <Field label={t("Email")} name="email" type="email" autoComplete="email" required error={fe.email} />
      <Field label={t("Mobile number")} name="phone" type="tel" autoComplete="tel" placeholder="70 123 456" required error={fe.phone} hint={t("For booking confirmations and delivery")} />
      <Field label={t("Password")} name="password" type="password" autoComplete="new-password" required error={fe.password} hint={t("At least 8 characters")} />
      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" name="terms" className="mt-1 h-4 w-4 accent-ink" />
        <span>
          {rich(t, "I agree to the {terms} and {privacy}", {
            terms: <Link href="/terms" className="underline">{t("Terms & conditions")}</Link>,
            privacy: <Link href="/privacy" className="underline">{t("Privacy policy")}</Link>,
          })}
        </span>
      </label>
      {fe.terms && <p className="text-xs font-medium text-red-600">{fe.terms}</p>}
      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" name="marketing" className="mt-1 h-4 w-4 accent-ink" />
        <span>{t("Send me weekend ideas and offers by email (optional)")}</span>
      </label>
      <SubmitButton>{t("Create account")}</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const t = useT();
  const [state, action] = useActionState(requestPasswordResetAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label={t("Email")} name="email" type="email" autoComplete="email" required />
      <SubmitButton>{t("Send reset link")}</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useT();
  const [state, action] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field label={t("New password")} name="password" type="password" autoComplete="new-password" required error={state?.fieldErrors?.password} />
      <SubmitButton>{t("Save new password")}</SubmitButton>
    </form>
  );
}
