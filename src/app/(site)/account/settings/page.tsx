import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { ActionForm } from "@/components/portal/action-form";
import { updateProfileAction } from "@/actions/auth";
import { deleteAccountAction } from "@/actions/account";

export const metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const user = await requireUser("/account/settings");
  const t = await getT();
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return (
    <div className="max-w-xl space-y-8">
      <section className="card p-6">
        <h1 className="mb-4 text-lg font-bold">{t("Profile & communication")}</h1>
        <ActionForm action={updateProfileAction} submit={t("Save")}>
          <label className="block">
            <span className="label">{t("Full name")}</span>
            <input name="name" defaultValue={u.name} required className="input" />
          </label>
          <label className="block">
            <span className="label">{t("Mobile number")}</span>
            <input name="phone" type="tel" defaultValue={u.phone ? `+${u.phone}` : ""} required className="input" />
          </label>
          <fieldset className="space-y-2">
            <legend className="label">{t("Booking & order updates")}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="notifyEmail" defaultChecked={u.notifyEmail} className="accent-ink" />
              {t("By email")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="notifyWhatsapp" defaultChecked={u.notifyWhatsapp} className="accent-ink" />
              {t("By WhatsApp (when available)")}
            </label>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="label">{t("Offers & weekend ideas (optional)")}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="marketingEmail" defaultChecked={u.marketingEmail} className="accent-ink" />
              {t("Email newsletter")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="marketingWhatsapp" defaultChecked={u.marketingWhatsapp} className="accent-ink" />
              {t("WhatsApp offers")}
            </label>
          </fieldset>
        </ActionForm>
      </section>
      <section className="card p-6">
        <h2 className="text-lg font-bold">{t("Delete account")}</h2>
        <p className="mb-4 mt-1 text-sm text-ink-muted">{t("Your personal data is deleted. Booking and payment records are kept anonymised for accounting.")}</p>
        <ActionForm action={deleteAccountAction} submit={t("Delete my account")} submitClass="btn-danger">
          {u.passwordHash && (
            <label className="block">
              <span className="label">{t("Confirm with your password")}</span>
              <input name="password" type="password" required className="input" />
            </label>
          )}
        </ActionForm>
      </section>
    </div>
  );
}
