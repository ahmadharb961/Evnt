import { CardGrid } from "@/components/home/section-row";
import { EmptyState, Pager } from "@/components/empty";
import { ResultsMap } from "@/components/results-map";
import { searchEvents, type EventFilters } from "@/server/listings";
import { favoriteIds } from "@/server/home";
import { getCurrentUser } from "@/server/auth";
import { getLocale, getT } from "@/i18n/server";
import { fmtDate } from "@/lib/dates";
import { one, page as pageOf, withParams, type SP } from "@/lib/filters";

const PER_PAGE = 24;

export async function EventResults({ filters, sp, basePath }: { filters: EventFilters; sp: SP; basePath: string }) {
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  const page = pageOf(sp);
  const map = one(sp.view) === "map";
  const { items, total } = await searchEvents({ ...filters, limit: map ? 200 : PER_PAGE, offset: map ? 0 : (page - 1) * PER_PAGE }, locale);
  const saved = await favoriteIds(user?.id);
  if (!items.length)
    return (
      <EmptyState
        title={t("Nothing matches yet")}
        body={t("Try another date, age or area — new activities are added every week.")}
        cta={{ href: basePath, label: t("Clear filters") }}
      />
    );
  return (
    <>
      <p className="mb-5 text-sm text-ink-muted">{t(total === 1 ? "{n} result" : "{n} results", { n: total })}</p>
      {map ? (
        <ResultsMap
          points={items
            .filter((i) => i.lat != null)
            .map((i) => ({
              id: i.id,
              lat: i.lat!,
              lng: i.lng!,
              title: i.title,
              subtitle: [i.areaName, i.nextStartsAt ? fmtDate(new Date(i.nextStartsAt), locale) : ""].filter(Boolean).join(" · "),
              href: `/events/${i.slug}`,
              image: i.image,
            }))}
        />
      ) : (
        <>
          <CardGrid items={items} t={t} locale={locale} saved={saved} />
          <Pager page={page} total={total} perPage={PER_PAGE} t={t} hrefFor={(p) => basePath + withParams(sp, { page: String(p) })} />
        </>
      )}
    </>
  );
}
