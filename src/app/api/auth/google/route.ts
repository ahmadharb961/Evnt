import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomToken } from "@/server/crypto";
import { appUrl } from "@/server/urls";

// Google sign-in (OpenID Connect, authorization-code flow). Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET;
// the redirect URI to register in Google Cloud is <APP_URL>/api/auth/google/callback.
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(`${appUrl()}/login?error=google_unavailable`);
  const state = randomToken(16);
  const next = req.nextUrl.searchParams.get("next") ?? "/account";
  const jar = await cookies();
  jar.set("evnt_oauth", JSON.stringify({ state, next }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", `${appUrl()}/api/auth/google/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "select_account");
  return NextResponse.redirect(u.toString());
}
