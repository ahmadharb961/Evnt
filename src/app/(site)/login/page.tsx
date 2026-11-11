import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, OAuthButtons } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-forms";
import { getCurrentUser } from "@/server/auth";
import { getT } from "@/i18n/server";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/account");
  const t = await getT();
  return (
    <AuthShell
      title={t("Welcome back")}
      subtitle={t("Sign in to book, check out and see your tickets.")}
      footer={
        <>
          {t("New to EVNT?")}{" "}
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink underline-offset-4 hover:underline">
            {t("Create an account")}
          </Link>
        </>
      }
    >
      {error && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{t("Sign-in with that provider didn't work. Please try again or use your email.")}</p>}
      <OAuthButtons next={next} label={t("Continue with Google")} or={t("or")} />
      <LoginForm next={next} />
    </AuthShell>
  );
}
