import Link from "next/link";
import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { markMerchantNotificationsReadAction } from "@/actions/merchant-growth";
import { fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Notifications" };

export default async function MerchantNotifications() {
  const ctx = await requireMerchant();
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const list = await prisma.notification.findMany({ where: { merchantId: ctx.merchant.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("Notifications")} actions={list.some((n) => !n.readAt) ? <ActionButton action={markMerchantNotificationsReadAction}>{t("Mark all as read")}</ActionButton> : undefined} />
      {!list.length && <p className="text-sm text-ink-muted">{t("No notifications yet.")}</p>}
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
