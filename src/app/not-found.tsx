import Link from "next/link";
import { Logo } from "@/components/logo";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-10 text-3xl font-bold">{t("We couldn't find that page")}</h1>
      <p className="mt-2 text-ink-muted">{t("It may have moved, or the activity is no longer available.")}</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-primary">
          {t("Go home")}
        </Link>
        <Link href="/discover" className="btn-outline">
          {t("Discover")}
        </Link>
      </div>
    </div>
  );
}
