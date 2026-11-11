import { MessageCircle, Mail } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { getSettings } from "@/server/settings";
import { getT } from "@/i18n/server";
import { ActionForm } from "@/components/portal/action-form";
import { contactAction } from "@/actions/contact";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Contact & support"), alternates: alternates("/contact") };
}

export default async function ContactPage() {
  const [t, user, s] = await Promise.all([getT(), getCurrentUser(), getSettings(["support.whatsapp", "support.email"])]);
  return (
    <div className="container-x grid max-w-5xl gap-10 py-10 lg:grid-cols-[1fr_380px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("Contact & support")}</h1>
        <p className="mt-2 text-ink-muted">{t("Questions about a booking, an order or your business account? We usually reply within a working day.")}</p>
        <div className="card mt-6 p-6">
          <ActionForm action={contactAction} submit={t("Send message")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">{t("Your name")}</span>
                <input name="name" defaultValue={user?.name} required className="input" />
              </label>
              <label className="block">
                <span className="label">{t("Email")}</span>
                <input name="email" type="email" defaultValue={user?.email} required className="input" />
              </label>
            </div>
            <label className="block">
              <span className="label">{t("Topic")}</span>
              <select name="topic" className="input">
                <option value="booking">{t("A booking")}</option>
                <option value="order">{t("A shop order")}</option>
                <option value="business">{t("My business on EVNT")}</option>
                <option value="privacy">{t("Privacy & my data")}</option>
                <option value="other">{t("Something else")}</option>
              </select>
            </label>
            <label className="block">
              <span className="label">{t("Message")}</span>
              <textarea name="message" rows={5} required minLength={10} maxLength={3000} className="input" />
            </label>
            <input name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
          </ActionForm>
        </div>
      </div>
      <aside className="space-y-3 lg:pt-20">
        {s["support.whatsapp"] && (
          <a href={`https://wa.me/${s["support.whatsapp"].replace(/\D/g, "")}`} className="card flex items-center gap-3 p-5" target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-5 w-5" />
            <span>
              <b>WhatsApp</b>
              <span className="block text-sm text-ink-muted" dir="ltr">
                {s["support.whatsapp"]}
              </span>
            </span>
          </a>
        )}
        <a href={`mailto:${s["support.email"]}`} className="card flex items-center gap-3 p-5">
          <Mail className="h-5 w-5" />
          <span>
            <b>{t("Email")}</b>
            <span className="block text-sm text-ink-muted">{s["support.email"]}</span>
          </span>
        </a>
      </aside>
    </div>
  );
}
