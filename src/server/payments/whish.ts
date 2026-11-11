import "server-only";
import { getSetting } from "../settings";

/**
 * Whish Money adapter.
 *
 * IMPORTANT: this must be checked against the official Whish merchant API documentation and tested
 * with sandbox credentials before it is switched on (Admin → Settings → "Whish payments enabled").
 * Until then online payment is shown as unavailable and nothing is ever marked as paid.
 *
 * Safety rules implemented regardless of the exact API shape:
 * - A payment is only confirmed after EVNT asks Whish for the status server-to-server (never from
 *   browser redirect parameters or an unauthenticated callback body alone).
 * - Each EVNT payment has a unique externalId (Payment.id) so retries can't double charge.
 * - Credentials come only from environment variables.
 */

export type WhishStatus = "success" | "failed" | "pending";

function config() {
  const base = process.env.WHISH_API_BASE?.replace(/\/$/, "");
  const channel = process.env.WHISH_CHANNEL;
  const secret = process.env.WHISH_SECRET;
  const websiteUrl = process.env.WHISH_WEBSITE_URL;
  if (!base || !channel || !secret || !websiteUrl) return null;
  return { base, channel, secret, websiteUrl };
}

export async function whishAvailable(): Promise<boolean> {
  return !!config() && (await getSetting("whish.enabled"));
}

function headers(c: NonNullable<ReturnType<typeof config>>) {
  return { "content-type": "application/json", channel: c.channel, secret: c.secret, websiteurl: c.websiteUrl };
}

/** Starts a payment and returns the Whish page URL the parent is sent to. */
export async function createWhishPayment(p: { externalId: string; amountCents: number; description: string; successUrl: string; failureUrl: string; callbackUrl: string }) {
  const c = config();
  if (!c || !(await getSetting("whish.enabled"))) throw new Error("Whish payments are not enabled");
  const res = await fetch(`${c.base}/payment/whish`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({
      amount: p.amountCents / 100,
      currency: "USD",
      invoice: p.description.slice(0, 100),
      externalId: p.externalId,
      successCallbackUrl: p.callbackUrl,
      failureCallbackUrl: p.callbackUrl,
      successRedirectUrl: p.successUrl,
      failureRedirectUrl: p.failureUrl,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { status?: boolean; data?: { collectUrl?: string } } | null;
  if (!res.ok || !json?.status || !json.data?.collectUrl) throw new Error("Whish did not return a payment page");
  return { redirectUrl: json.data.collectUrl };
}

/** Asks Whish for the real status of a payment (the only thing that can confirm it). */
export async function fetchWhishStatus(externalId: string): Promise<{ status: WhishStatus; raw: unknown }> {
  const c = config();
  if (!c) return { status: "pending", raw: null };
  const res = await fetch(`${c.base}/payment/collect/status`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({ currency: "USD", externalId }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { status?: boolean; data?: { collectStatus?: string } } | null;
  const s = json?.data?.collectStatus?.toLowerCase();
  return { status: s === "success" ? "success" : s === "failed" ? "failed" : "pending", raw: json };
}
