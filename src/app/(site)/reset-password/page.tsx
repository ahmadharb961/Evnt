import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "@/components/auth-forms";
import { getT } from "@/i18n/server";

export const metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = await getT();
  return (
    <AuthShell title={t("Choose a new password")}>
      <ResetForm token={token ?? ""} />
    </AuthShell>
  );
}
