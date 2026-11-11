import Link from "next/link";
import { notFound } from "next/navigation";
import type { Role } from "@prisma/client";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { pointsBalance } from "@/server/membership";
import { getLocale, getT } from "@/i18n/server";
import { loc } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionButton } from "@/components/portal/action-button";
import { setRoleAction, setUserDisabledAction, grantPlusAction } from "@/actions/admin";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "User" };
const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "FINANCE", "CONTENT", "EVALUATOR"];

export default async function UserAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin("ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const u = await prisma.user.findUnique({ where: { id }, include: { roles: true, membership: true, staff: { include: { merchant: true } }, family: true } });
  if (!u) notFound();
  const [bookings, orders, points] = await Promise.all([
    prisma.booking.findMany({ where: { userId: id }, include: { event: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.orderGroup.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    pointsBalance(id),
  ]);
  const has = (r: Role) => u.roles.some((x) => x.role === r);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={u.name}
        subtitle={u.email}
        actions={
          <>
            <ActionButton action={setUserDisabledAction.bind(null, u.id, !u.disabled)} className={u.disabled ? "btn-outline btn-sm" : "btn-danger btn-sm"} confirm={u.disabled ? t("Re-enable this account?") : t("Disable this account and sign them out?")}>
              {u.disabled ? t("Enable account") : t("Disable account")}
            </ActionButton>
            <ActionButton action={grantPlusAction.bind(null, u.id)} className="btn-outline btn-sm" prompt={t("Grant EVNT+ for how many months?")}>
              {t("Grant EVNT+")}
            </ActionButton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("Account")}>
          <dl className="space-y-1 text-sm">
            <div dir="ltr">{u.phone ? `+${u.phone}` : "—"}</div>
            <div>
              {t("Language")}: {u.locale}
            </div>
            <div>
              {t("Joined")}: {fmtDate(u.createdAt, locale, { day: "numeric", month: "short", year: "numeric" })} · {t("Last login")}: {u.lastLoginAt ? fmtDateTime(u.lastLoginAt, locale) : "—"}
            </div>
            <div>EVNT+: {u.membership ? `${u.membership.status} ${u.membership.currentPeriodEnd ? fmtDate(u.membership.currentPeriodEnd, locale, { day: "numeric", month: "short", year: "numeric" }) : ""}` : "—"}</div>
            <div>{t("{n} points", { n: points })}</div>
            <div>
              {t("Marketing")}: email {u.marketingEmail ? "✓" : "✗"} · WhatsApp {u.marketingWhatsapp ? "✓" : "✗"}
            </div>
            {u.family && <div>{t("Family")}: {u.family.ageBands.join(", ")}</div>}
            {u.staff.map((s) => (
              <div key={s.merchantId}>
                {s.role} @{" "}
                <Link href={`/admin/merchants/${s.merchantId}`} className="underline">
                  {s.merchant.name}
                </Link>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title={t("Admin roles")}>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <ActionButton key={r} action={setRoleAction.bind(null, u.id, r, !has(r))} className={`chip ${has(r) ? "chip-on" : ""}`} confirm={has(r) ? t("Remove {role}?", { role: r }) : t("Grant {role}?", { role: r })}>
                {r}
              </ActionButton>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">{t("Only super admins can change roles. ADMIN: operations · FINANCE: money · CONTENT: CMS & moderation · EVALUATOR: Farah assessments.")}</p>
        </Panel>
      </div>
      <Panel title={t("Bookings")}>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {bookings.map((b) => (
            <li key={b.id} className="flex justify-between py-2">
              <span>
                {b.code} · {loc(b.event.title, locale)}
              </span>
              <span>
                {formatMoney(b.totalCents, locale)} · {b.status}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={t("Orders")}>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex justify-between py-2">
              <span>{o.number}</span>
              <span>
                {formatMoney(o.totalCents, locale)} · {o.paymentMethod}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
