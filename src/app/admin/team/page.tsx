import Link from "next/link";
import { requireAdmin, hasRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { PageHeader, Panel } from "@/components/portal/shell";
import { TONES } from "@/lib/tones";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { RolePicker } from "@/components/admin/role-picker";
import { addTeamMemberAction, createUserAction, removeFromTeamAction } from "@/actions/admin";
import { ROLE_INFO } from "@/lib/roles";
import { fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Admin team" };

export default async function TeamAdmin() {
  const me = await requireAdmin("ADMIN");
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const canEdit = hasRole(me, "SUPER_ADMIN") && me.roles.includes("SUPER_ADMIN");
  const team = await prisma.user.findMany({ where: { roles: { some: {} } }, include: { roles: true }, orderBy: { createdAt: "asc" } });
  const initials = (n: string) => n.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("Admin team")} subtitle={t("People who can sign in to this admin, and what each one can do.")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {ROLE_INFO.map((r) => (
          <div key={r.role} className={`rounded-3xl p-4 ${TONES[r.tone].soft}`}>
            <p className={`text-2xl font-bold ${TONES[r.tone].text}`}>{team.filter((u) => u.roles.some((x) => x.role === r.role)).length}</p>
            <p className="text-sm font-semibold">{t(r.label)}</p>
            <p className="mt-1 text-[11px] leading-snug text-ink-muted">{t(r.desc)}</p>
          </div>
        ))}
      </div>

      <Panel title={t("Team members")} icon="Shield" tone="violet">
        <ul className="divide-y divide-ink/[.06]">
          {team.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-200 to-blush text-sm font-bold">{initials(u.name)}</span>
              <span className="min-w-0 flex-1">
                <Link href={`/admin/users/${u.id}`} className="font-semibold hover:underline">
                  {u.name} {u.id === me.id && <span className="text-xs font-normal text-ink-muted">({t("you")})</span>}
                </Link>
                <span className="block truncate text-xs text-ink-muted">
                  {u.email} · {t("Last login")}: {u.lastLoginAt ? fmtDateTime(u.lastLoginAt, locale) : "—"}
                </span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {u.roles.map((x) => {
                  const info = ROLE_INFO.find((r) => r.role === x.role)!;
                  return (
                    <span key={x.role} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${TONES[info.tone].tile} ${TONES[info.tone].text}`}>
                      {t(info.label)}
                    </span>
                  );
                })}
              </span>
              {canEdit && (
                <span className="flex gap-2">
                  <Link href={`/admin/users/${u.id}`} className="btn-outline btn-sm">
                    {t("Change roles")}
                  </Link>
                  {u.id !== me.id && (
                    <ActionButton action={removeFromTeamAction.bind(null, u.id)} className="btn-danger btn-sm" confirm={t("Remove {name} from the admin team? Their normal account stays.", { name: u.name })}>
                      {t("Remove")}
                    </ActionButton>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {canEdit ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t("New team member")} subtitle={t("Creates a new account with admin access")} icon="UserPlus" tone="peach">
            <ActionForm action={createUserAction} submit={t("Create team member")} className="space-y-3">
              <input name="name" required placeholder={t("Full name")} className="input" />
              <input name="email" type="email" required placeholder={t("Email (used to sign in)")} className="input" dir="ltr" />
              <input name="password" type="text" required minLength={8} placeholder={t("Password (at least 8 characters)")} className="input" dir="ltr" autoComplete="new-password" />
              <p className="text-xs font-semibold text-ink-soft">{t("What can they do?")}</p>
              <RolePicker t={t} defaultRoles={["ADMIN"]} />
              <p className="text-xs text-ink-muted">{t("Send them the email and password yourself. They can change the password after signing in.")}</p>
            </ActionForm>
          </Panel>
          <Panel title={t("Give access to an existing account")} subtitle={t("For someone who already signed up on EVNT")} icon="Users" tone="sky">
            <ActionForm action={addTeamMemberAction} submit={t("Add to team")} className="space-y-3">
              <input name="email" type="email" required placeholder={t("Their account email")} className="input" dir="ltr" />
              <p className="text-xs font-semibold text-ink-soft">{t("What can they do?")}</p>
              <RolePicker t={t} />
            </ActionForm>
          </Panel>
        </div>
      ) : (
        <p className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-900">{t("Only a super admin can add or remove team members.")}</p>
      )}
    </div>
  );
}
