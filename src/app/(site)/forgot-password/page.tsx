import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "@/components/auth-forms";
import { getT } from "@/i18n/server";

export const metadata = { title: "Forgot password", robots: { index: false } };

export default async function ForgotPage() {
  const t = await getT();
  return (
    <AuthShell
      title={t("Forgot your password?")}
      subtitle={t("Enter your email and we'll send you a link to choose a new one.")}
      footer={<Link href="/login" className="font-semibold text-ink">{t("Back to sign in")}</Link>}
    >
      <ForgotForm />
    </AuthShell>
  );
}
