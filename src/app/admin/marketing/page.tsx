import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { getLocale, getT } from "@/i18n/server";
import { loc, type Localized } from "@/i18n/core";
import { PageHeader, Panel } from "@/components/portal/shell";
import { ActionForm } from "@/components/portal/action-form";
import { ActionButton } from "@/components/portal/action-button";
import { LocalizedField } from "@/components/localized-field";
import { MediaInput } from "@/components/uploader";
import { saveArticleAction, saveDiscountAction, toggleDiscountAction, markContactHandledAction } from "@/actions/admin";
import { formatMoney } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Marketing" };

export default async function MarketingAdmin({ searchParams }: { searchParams: Promise<{ article?: string }> }) {
  await requireAdmin("CONTENT", "ADMIN");
  const [locale, t, sp] = await Promise.all([getLocale(), getT(), searchParams]);
  const [codes, articles, messages, emailOptIns, waOptIns] = await Promise.all([
    prisma.discountCode.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.article.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.contactMessage.findMany({ where: { handled: false }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.user.count({ where: { marketingEmail: true, disabled: false } }),
    prisma.user.count({ where: { marketingWhatsapp: true, disabled: false } }),
  ]);
  const editing = sp.article ? articles.find((a) => a.id === sp.article) : null;
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("Marketing")} subtitle={t("{e} parents opted in to email · {w} to WhatsApp offers. Only opted-in parents can receive marketing.", { e: emailOptIns, w: waOptIns })} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("Discount codes (EVNT-funded, shop)")}>
          <ActionForm action={saveDiscountAction} submit={t("Create code")} submitClass="btn-primary btn-sm">
            <div className="grid grid-cols-2 gap-2">
              <input name="code" placeholder="WELCOME10" className="input !py-2 uppercase" />
              <input name="percent" type="number" min={1} max={100} placeholder={t("% off")} className="input !py-2" />
              <input name="amount" inputMode="decimal" placeholder={t("or $ off")} className="input !py-2" />
              <input name="min" inputMode="decimal" placeholder={t("Min subtotal $")} className="input !py-2" />
              <input name="maxUses" type="number" placeholder={t("Max uses")} className="input !py-2" />
              <input name="endsAt" type="date" className="input !py-2" />
            </div>
          </ActionForm>
          <ul className="mt-4 divide-y divide-ink/[.06] text-sm">
            {codes.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className={c.active ? "" : "text-ink-muted line-through"}>
                  <b>{c.code}</b> · {c.percentOff ? `${c.percentOff}%` : formatMoney(c.amountOffCents ?? 0, locale)} · {c.uses}
                  {c.maxUses ? `/${c.maxUses}` : ""} {t("uses")}
                </span>
                <ActionButton action={toggleDiscountAction.bind(null, c.code)} className="btn-ghost btn-sm">
                  {c.active ? t("Disable") : t("Enable")}
                </ActionButton>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("Contact messages")}>
          {!messages.length ? (
            <p className="text-sm text-ink-muted">{t("Inbox zero.")}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {messages.map((m) => (
                <li key={m.id} className="rounded-2xl border border-ink/[.06] p-3">
                  <p className="font-medium">
                    {m.name} · <a href={`mailto:${m.email}`} className="underline">{m.email}</a> · {m.topic}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-ink-soft">{m.message}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                    {fmtDateTime(m.createdAt, locale)}
                    <ActionButton action={markContactHandledAction.bind(null, m.id)} className="btn-ghost btn-sm">
                      {t("Mark handled")}
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel
        title={t("Family guides (blog)")}
        actions={
          <Link href="/admin/marketing" className="btn-outline btn-sm">
            {t("New guide")}
          </Link>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <ul className="space-y-1 text-sm">
            {articles.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/marketing?article=${a.id}`} className={`block rounded-xl px-3 py-2 hover:bg-canvas ${editing?.id === a.id ? "bg-canvas font-semibold" : ""}`}>
                  {loc(a.title, locale)} <span className="text-xs text-ink-muted">{a.status}</span>
                </Link>
              </li>
            ))}
          </ul>
          <ActionForm action={saveArticleAction} hidden={editing ? { id: editing.id } : undefined} submit={t("Save guide")} key={editing?.id ?? "new"}>
            <LocalizedField name="title" label={t("Title")} initial={(editing?.title ?? {}) as Localized} required />
            <LocalizedField name="excerpt" label={t("Short summary")} initial={(editing?.excerpt ?? {}) as Localized} multiline rows={2} />
            <LocalizedField name="body" label={t("Article (blank line between paragraphs, ## for headings)")} initial={(editing?.body ?? {}) as Localized} multiline rows={12} maxLength={30000} />
            <MediaInput name="coverId" initial={editing?.coverId ?? editing?.coverUrl} aspect="aspect-[16/9]" label={t("Cover")} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="publish" defaultChecked={editing?.status === "PUBLISHED"} className="accent-ink" />
              {t("Published")}
            </label>
          </ActionForm>
        </div>
      </Panel>
    </div>
  );
}
