"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Minus, Plus, Loader2, Crown, CalendarX } from "lucide-react";
import { startBookingAction } from "@/actions/booking";
import { SeatPicker, type Seat } from "@/components/booking/seat-picker";
import { useLocale, useT } from "@/i18n/client";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtTime } from "@/lib/dates";

type Session = { id: string; startsAt: string; remaining: number; open: boolean; early: boolean; reason: string | null; opensAt: string | null };
type TicketType = { id: string; name: string; priceCents: number; zone: string | null; minQty: number; maxQty: number };

export function BookingPanel({
  sessions,
  ticketTypes,
  seating,
  flashPercent,
  feeCents,
  isMember,
  initialSession,
  holdMinutes,
}: {
  sessions: Session[];
  ticketTypes: TicketType[];
  seating: null | { width: number; height: number; zones: { key: string; name: string; color: string }[]; labels: { text: string; x: number; y: number; w: number }[] };
  flashPercent: number;
  feeCents: number;
  isMember: boolean;
  initialSession?: string;
  holdMinutes: number;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const path = usePathname();
  const firstOpen = sessions.find((s) => s.id === initialSession) ?? sessions.find((s) => s.open && s.remaining > 0);
  const [sessionId, setSessionId] = useState(firstOpen?.id ?? "");
  const [qty, setQty] = useState<Record<string, number>>(() => (ticketTypes.length === 1 && !seating ? { [ticketTypes[0].id]: 1 } : {}));
  const [seatIds, setSeatIds] = useState<string[]>([]);
  const [seatInfo, setSeatInfo] = useState<Seat[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const session = sessions.find((s) => s.id === sessionId);
  const unit = (c: number) => (flashPercent ? Math.round((c * (100 - flashPercent)) / 100) : c);

  const lines = useMemo(() => {
    if (seating) {
      const byZone = new Map<string, number>();
      for (const id of seatIds) {
        const s = seatInfo.find((x) => x.id === id);
        if (s) byZone.set(s.zone, (byZone.get(s.zone) ?? 0) + 1);
      }
      return [...byZone].map(([zone, n]) => {
        const tt = ticketTypes.find((x) => x.zone === zone) ?? ticketTypes.find((x) => !x.zone)!;
        return { name: tt?.name ?? zone, n, cents: unit(tt?.priceCents ?? 0) };
      });
    }
    return ticketTypes.filter((tt) => (qty[tt.id] ?? 0) > 0).map((tt) => ({ name: tt.name, n: qty[tt.id], cents: unit(tt.priceCents) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatIds, seatInfo, qty, seating, ticketTypes, flashPercent]);

  const count = lines.reduce((a, l) => a + l.n, 0);
  const subtotal = lines.reduce((a, l) => a + l.n * l.cents, 0);
  const fee = subtotal > 0 && !isMember ? feeCents : 0;
  const totalQtyMax = session ? Math.min(session.remaining, 50) : 0;

  if (!sessions.length)
    return (
      <div className="rounded-3xl bg-canvas p-6 text-center">
        <CalendarX className="mx-auto h-6 w-6 text-ink-muted" />
        <p className="mt-2 font-semibold">{t("No upcoming dates")}</p>
        <p className="text-sm text-ink-muted">{t("Save it to your favorites and check back soon.")}</p>
      </div>
    );

  function submit() {
    setError("");
    if (!session) return setError(t("Choose a date"));
    if (!count) return setError(seating ? t("Choose your seats") : t("Choose at least one ticket"));
    start(async () => {
      const r = await startBookingAction({
        sessionId,
        items: Object.entries(qty).map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
        seatIds: seating ? seatIds : undefined,
        returnTo: path,
      });
      if (r?.needsLogin) router.push(`/login?next=${encodeURIComponent(`${path}?session=${sessionId}`)}`);
      else if (r?.error) setError(r.error);
    });
  }

  const priceByZone = Object.fromEntries(ticketTypes.filter((x) => x.zone).map((x) => [x.zone!, formatMoney(unit(x.priceCents), locale)]));

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold">{t("1. Choose a date")}</p>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {sessions.map((s) => {
            const d = new Date(s.startsAt);
            const soldOut = s.remaining <= 0;
            const disabled = soldOut || !s.open;
            const on = s.id === sessionId;
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setSessionId(s.id);
                  setSeatIds([]);
                }}
                className={`min-w-[96px] shrink-0 rounded-2xl border px-3 py-2.5 text-start transition ${on ? "border-ink bg-ink text-white" : "border-ink/10 bg-white hover:border-ink/30"} disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <span className="block text-xs opacity-80">{fmtDate(d, locale, { weekday: "short" })}</span>
                <span className="block text-sm font-bold">{fmtDate(d, locale, { day: "numeric", month: "short" })}</span>
                <span className="block text-xs">{fmtTime(d, locale)}</span>
                <span className={`mt-1 block text-[11px] font-medium ${on ? "text-white/80" : soldOut ? "text-ink-muted" : s.remaining <= 5 ? "text-peach-deep" : "text-mint-deep"}`}>
                  {soldOut
                    ? t("Sold out")
                    : !s.open
                      ? s.reason === "members_only"
                        ? t("EVNT+ early access")
                        : t("Opens soon")
                      : s.early
                        ? t("Early access")
                        : s.remaining <= 5
                          ? t("{n} left", { n: s.remaining })
                          : t("Available")}
                </span>
              </button>
            );
          })}
        </div>
        {sessions.some((s) => s.reason === "members_only") && !isMember && (
          <Link href="/plus" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-powder-deep">
            <Crown className="h-3.5 w-3.5" />
            {t("EVNT+ members can book 48 hours before everyone else")}
          </Link>
        )}
      </div>

      {session && (
        <div>
          <p className="mb-2 text-sm font-semibold">{seating ? t("2. Choose your seats") : t("2. Tickets")}</p>
          {seating ? (
            <SeatPicker
              key={session.id}
              sessionId={session.id}
              width={seating.width}
              height={seating.height}
              zones={seating.zones}
              labels={seating.labels}
              priceByZone={priceByZone}
              selected={seatIds}
              onChange={(ids, seats) => {
                setSeatIds(ids);
                setSeatInfo(seats);
              }}
            />
          ) : (
            <div className="divide-y divide-ink/[.06] rounded-3xl border border-ink/10">
              {ticketTypes.map((tt) => {
                const n = qty[tt.id] ?? 0;
                const canAdd = n < tt.maxQty && count < totalQtyMax;
                return (
                  <div key={tt.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div>
                      <p className="font-medium">{tt.name}</p>
                      <p className="text-sm text-ink-muted">
                        {tt.priceCents === 0 ? t("Free") : formatMoney(unit(tt.priceCents), locale)}
                        {flashPercent > 0 && tt.priceCents > 0 && <span className="ms-2 text-xs line-through">{formatMoney(tt.priceCents, locale)}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" disabled={n === 0} onClick={() => setQty({ ...qty, [tt.id]: n - 1 })} className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 disabled:opacity-30" aria-label={t("Remove one")}>
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-5 text-center font-semibold" aria-live="polite">
                        {n}
                      </span>
                      <button type="button" disabled={!canAdd} onClick={() => setQty({ ...qty, [tt.id]: n + 1 })} className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 disabled:opacity-30" aria-label={t("Add one")}>
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {count > 0 && (
        <div className="space-y-1.5 rounded-3xl bg-canvas p-4 text-sm">
          {lines.map((l) => (
            <div key={l.name} className="flex justify-between">
              <span>
                {l.n} × {l.name}
              </span>
              <span>{l.cents === 0 ? t("Free") : formatMoney(l.n * l.cents, locale)}</span>
            </div>
          ))}
          {seating && seatIds.length > 0 && (
            <p className="text-xs text-ink-muted">
              {t("Seats")}: {seatIds.map((id) => seatInfo.find((s) => s.id === id)?.label).join(", ")}
            </p>
          )}
          {subtotal > 0 && (
            <div className="flex justify-between text-ink-muted">
              <span>{t("EVNT booking fee")}</span>
              <span>{fee ? formatMoney(fee, locale) : isMember ? t("Free with EVNT+") : formatMoney(0, locale)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-bold">
            <span>{t("Total")}</span>
            <span>{subtotal + fee === 0 ? t("Free") : formatMoney(subtotal + fee, locale)}</span>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-ink/[.06] bg-white/95 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <button type="button" onClick={submit} disabled={pending || !session} className="btn-primary h-12 w-full text-base">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {count ? t("Book now · {total}", { total: subtotal + fee === 0 ? t("Free") : formatMoney(subtotal + fee, locale) }) : t("Book now")}
        </button>
        <p className="mt-1.5 hidden text-center text-xs text-ink-muted lg:block">{t("Your spots are held for {n} minutes while you check out.", { n: holdMinutes })}</p>
      </div>
    </div>
  );
}
