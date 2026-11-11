import { requireMerchant } from "@/server/auth";
import { prisma } from "@/server/db";
import { getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { inviteStaffAction, removeStaffAction } from "@/actions/merchant-growth";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireMerchant();
  const t = await getT();
  const staff = await prisma.merchantStaff.findMany({ where: { merchantId: ctx.merchant.id }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } });
  const role: Record<string, string> = { OWNER: t("Owner"), MANAGER: t("Manager"), STAFF: t("Staff") };
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t("Team")} subtitle={t("Owners manage billing and the team. Managers edit listings and bookings. Staff check in tickets and handle orders.")} />
      <Panel>
        <ul className="divide-y divide-ink/[.06] text-sm">
          {staff.map((s) => (
            <li key={s.userId} className="flex items-center justify-between gap-3 py-3">
              <span>
                <span className="font-medium">{s.user.name}</span>
                <span className="block text-xs text-ink-muted">{s.user.email}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold">{role[s.role]}</span>
                {ctx.staffRole === "OWNER" && s.role !== "OWNER" && (
                  <ActionButton action={removeStaffAction.bind(null, s.userId)} className="btn-ghost btn-sm" confirm={t("Remove from your team?")}>
                    {t("Remove")}
                  </ActionButton>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      {ctx.staffRole === "OWNER" && (
        <Panel title={t("Add a team member")}>
          <ActionForm action={inviteStaffAction} submit={t("Add")}>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <input name="email" type="email" required placeholder={t("Their EVNT account email")} className="input" />
              <select name="role" className="input">
                <option value="STAFF">{t("Staff")}</option>
                <option value="MANAGER">{t("Manager")}</option>
              </select>
            </div>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}
