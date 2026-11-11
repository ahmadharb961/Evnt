import { NextResponse, type NextRequest } from "next/server";
import { syncWhishPayment } from "@/server/payments";
import { rateLimit } from "@/server/rate-limit";

// Whish callback. The body is never trusted: we only use the payment id to look up the real
// status with Whish, server to server, and apply it once.
async function handle(req: NextRequest) {
  const pid = req.nextUrl.searchParams.get("pid") ?? "";
  if (!/^[a-z0-9]{20,40}$/.test(pid)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!rateLimit(`whish-cb:${pid}`, 20, 60_000).ok) return NextResponse.json({ ok: false }, { status: 429 });
  const status = await syncWhishPayment(pid).catch(() => null);
  return NextResponse.json({ ok: true, status });
}

export const GET = handle;
export const POST = handle;
