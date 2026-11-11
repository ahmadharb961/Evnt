import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { AccountTabs } from "@/components/account/tabs";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/account");
  const t = await getT();
  const tabs = [
    { href: "/account", label: t("Overview") },
    { href: "/account/bookings", label: t("Bookings") },
    { href: "/account/orders", label: t("Orders") },
    { href: "/account/reservations", label: t("Reservations") },
    { href: "/favorites", label: t("Favorites") },
    { href: "/account/family", label: t("Family") },
    { href: "/account/notifications", label: t("Notifications") },
    { href: "/account/settings", label: t("Settings") },
  ];
  return (
    <div className="container-x py-6 sm:py-10">
      <AccountTabs tabs={tabs} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
