import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { releaseExpiredHolds, completePastBookings } from "@/server/booking";
import { syncPendingPayments } from "@/server/payments";
import { cancelStaleUnpaidOrders } from "@/server/orders";
import { runBilling } from "@/server/billing";
import { runMemberships } from "@/server/plus";
import { expireCertifications } from "@/server/farah";
import { endCampaigns } from "@/server/ads";
import { getSetting } from "@/server/settings";
import { prisma } from "@/server/db";
import { notifyUser } from "@/server/notify";

// Scheduled jobs. Call every 5–15 minutes from Hostinger's cron with the CRON_SECRET:
//   curl -s -H "Authorization: Bearer $CRON_SECRET" https://evnt.co/api/cron
// Each job is idempotent, so running it more often is safe.
function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || req.nextUrl.searchParams.get("key") || "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function remindUpcoming() {
  // Day-before reminders for confirmed bookings (sent once per booking).
  const from = new Date(Date.now() + 20 * 3600_000);
  const to = new Date(Date.now() + 28 * 3600_000);
  const due = await prisma.booking.findMany({ where: { status: { in: ["CONFIRMED", "RESERVED_PAY_AT_VENUE"] }, session: { startsAt: { gte: from, lt: to } } }, include: { event: true }, take: 300 });
  let n = 0;
  for (const b of due) {
    const sent = await prisma.notification.findFirst({ where: { userId: b.userId, kind: "booking.reminder", link: `/account/bookings/${b.code}` } });
    if (sent) continue;
    await notifyUser(b.userId, { kind: "booking.reminder", title: "See you tomorrow!", body: "A reminder about your booking tomorrow. Your QR tickets are ready in the app.", link: `/account/bookings/${b.code}` });
    n++;
  }
  return n;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const out: Record<string, unknown> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn();
    } catch (e) {
      console.error(`[cron] ${name}`, e);
      out[name] = `error: ${(e as Error).message}`;
    }
  };
  await run("holds", () => releaseExpiredHolds());
  await run("payments", () => syncPendingPayments());
  await run("completed", () => completePastBookings());
  await run("unpaidOrders", async () => cancelStaleUnpaidOrders(await getSetting("orders.autoCancelUnpaidHours")));
  await run("reminders", remindUpcoming);
  // Daily-ish jobs are cheap and idempotent; they run every time.
  await run("billing", () => runBilling());
  await run("memberships", () => runMemberships());
  await run("certifications", () => expireCertifications());
  await run("campaigns", () => endCampaigns());
  return NextResponse.json({ ok: true, ...out });
}
