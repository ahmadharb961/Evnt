import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, OAuthButtons } from "@/components/auth-shell";
import { RegisterForm } from "@/components/auth-forms";
import { getCurrentUser } from "@/server/auth";
import { getT } from "@/i18n/server";

export const metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/account");
  const t = await getT();
  return (
    <AuthShell
      title={t("Create your EVNT account")}
      subtitle={t("Book activities, keep your tickets and save favorites in one place.")}
      footer={
        <>
          {t("Already have an account?")}{" "}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink underline-offset-4 hover:underline">
            {t("Sign in")}
          </Link>
        </>
      }
    >
      <OAuthButtons next={next} label={t("Continue with Google")} or={t("or")} />
      <RegisterForm next={next} />
    </AuthShell>
  );
}
