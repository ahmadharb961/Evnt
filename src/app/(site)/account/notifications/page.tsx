import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { getLocale, getT } from "@/i18n/server";
import { EmptyState } from "@/components/empty";
import { ActionButton } from "@/components/portal/action-button";
import { markNotificationsReadAction } from "@/actions/account";
import { fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Notifications", robots: { index: false } };

export default async function NotificationsPage() {
  const user = await requireUser("/account/notifications");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const list = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  if (!list.length) return <EmptyState icon={Bell} title={t("No notifications yet")} />;
  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="h-section">{t("Notifications")}</h1>
        {list.some((n) => !n.readAt) && <ActionButton action={markNotificationsReadAction}>{t("Mark all as read")}</ActionButton>}
      </div>
      <ul className="space-y-2">
        {list.map((n) => (
          <li key={n.id}>
            <Link href={n.link ?? "#"} className={`block rounded-2xl p-4 ${n.readAt ? "bg-white" : "bg-mint-soft"}`}>
              <p className="font-medium">{n.title}</p>
              <p className="text-sm text-ink-soft">{n.body}</p>
              <p className="mt-1 text-xs text-ink-muted">{fmtDateTime(n.createdAt, locale)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
