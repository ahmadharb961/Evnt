import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { prisma } from "@/server/db";
import { createSession } from "@/server/auth";
import { mergeDeviceCart } from "@/server/cart";
import { appUrl } from "@/server/urls";
import { getLocale } from "@/i18n/server";

export async function GET(req: NextRequest) {
  const fail = (code: string) => NextResponse.redirect(`${appUrl()}/login?error=${code}`);
  const jar = await cookies();
  const raw = jar.get("evnt_oauth")?.value;
  jar.delete("evnt_oauth");
  let saved: { state: string; next: string } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {}
  const code = req.nextUrl.searchParams.get("code");
  if (!saved || !code || req.nextUrl.searchParams.get("state") !== saved.state) return fail("google_failed");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${appUrl()}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("google_failed");
  const tokens = (await tokenRes.json()) as { access_token?: string };
  // Profile from Google's userinfo endpoint over TLS with the fresh access token.
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tokens.access_token}` } });
  if (!infoRes.ok) return fail("google_failed");
  const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
  if (!info.sub || !info.email || !info.email_verified) return fail("google_unverified");

  const email = info.email.toLowerCase();
  const linked = await prisma.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider: "google", providerAccountId: info.sub } } });
  let userId = linked?.userId;
  if (!userId) {
    const existing = await prisma.user.findUnique({ where: { email } });
    const user =
      existing ??
      (await prisma.user.create({ data: { email, name: info.name || email.split("@")[0], emailVerifiedAt: new Date(), locale: await getLocale() } }));
    await prisma.oAuthAccount.create({ data: { provider: "google", providerAccountId: info.sub, userId: user.id } });
    userId = user.id;
  }
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.disabled) return fail("account_disabled");
  await createSession(userId, (await headers()).get("user-agent"));
  await mergeDeviceCart(userId);
  const next = saved.next.startsWith("/") && !saved.next.startsWith("//") ? saved.next : "/account";
  return NextResponse.redirect(`${appUrl()}${next}`);
}
