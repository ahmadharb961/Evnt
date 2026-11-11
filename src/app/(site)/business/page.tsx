import Link from "next/link";
import { CalendarCheck, Armchair, BarChart3, Megaphone, Cake, BadgeCheck } from "lucide-react";
import { getT } from "@/i18n/server";
import { alternates } from "@/server/urls";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("List your business on EVNT"), description: t("Reach Lebanese parents, take bookings and sell online. Free to list."), alternates: alternates("/business") };
}

export default async function BusinessPage() {
  const t = await getT();
  const features = [
    { icon: CalendarCheck, title: t("Online bookings & tickets"), body: t("Sessions, ticket types, QR check-in and automatic confirmations.") },
    { icon: Armchair, title: t("Seat & spot selection"), body: t("Build a seating or table map once, sell assigned seats with zero double bookings.") },
    { icon: Cake, title: t("Birthday requests"), body: t("Receive quote requests from parents planning parties.") },
    { icon: BarChart3, title: t("Clear reporting"), body: t("Revenue, bookings, views and what EVNT generated for you.") },
    { icon: Megaphone, title: t("Promotion tools"), body: t("Flash promotions, featured placements and category sponsorships.") },
    { icon: BadgeCheck, title: t("Farah Approved"), body: t("Get independently certified as a truly family-friendly venue.") },
  ];
  return (
    <>
      <section className="bg-gradient-to-b from-mint-soft to-white">
        <div className="container-x py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-wider text-mint-deep">{t("EVNT for businesses")}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">{t("Be where Lebanese parents plan their week.")}</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">{t("List for free, take bookings and orders, and only pay commission when EVNT brings you business.")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/business/join" className="btn-primary h-12 px-7 text-base">
              {t("List your business")}
            </Link>
            <Link href="/business/pricing" className="btn-outline h-12 px-7 text-base">
              {t("See plans & pricing")}
            </Link>
          </div>
        </div>
      </section>
      <section className="container-x mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card p-6">
            <f.icon className="h-6 w-6" />
            <h3 className="mt-4 font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-ink-muted">{f.body}</p>
          </div>
        ))}
      </section>
      <section className="container-x mt-16 text-center">
        <h2 className="text-2xl font-bold">{t("Already on EVNT?")}</h2>
        <Link href="/merchant" className="btn-outline mt-4">
          {t("Go to your merchant dashboard")}
        </Link>
      </section>
    </>
  );
}
