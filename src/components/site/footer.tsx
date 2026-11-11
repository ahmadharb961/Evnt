import Link from "next/link";
import { Logo } from "@/components/logo";
import { getT } from "@/i18n/server";

export async function SiteFooter() {
  const t = await getT();
  const cols = [
    {
      title: t("Discover"),
      links: [
        ["/activities", t("Activities & Workshops")],
        ["/birthdays", t("Birthdays & Parties")],
        ["/restaurants", t("Restaurants & Cafés")],
        ["/shop", t("Shop for Kids")],
        ["/guides", t("Family guides")],
      ],
    },
    {
      title: "EVNT",
      links: [
        ["/plus", "EVNT+"],
        ["/farah-approved", t("Farah Approved")],
        ["/contact", t("Contact & support")],
      ],
    },
    {
      title: t("For businesses"),
      links: [
        ["/business", t("List your business")],
        ["/business/pricing", t("Plans & pricing")],
        ["/merchant", t("Merchant login")],
      ],
    },
    {
      title: t("Legal"),
      links: [
        ["/terms", t("Terms & conditions")],
        ["/privacy", t("Privacy policy")],
        ["/refunds", t("Refunds & cancellations")],
        ["/reviews-policy", t("Review policy")],
      ],
    },
  ];
  return (
    <footer className="mt-20 border-t border-ink/[.06] bg-canvas">
      <div className="container-x grid gap-10 py-12 md:grid-cols-5">
        <div className="md:col-span-1">
          <Logo />
          <p className="mt-3 text-sm text-ink-muted">{t("Everything for your kids. One destination.")}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="mb-3 text-sm font-semibold">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-ink-muted hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container-x border-t border-ink/[.06] py-5 text-xs text-ink-muted">© {new Date().getFullYear()} EVNT · evnt.co</div>
    </footer>
  );
}
