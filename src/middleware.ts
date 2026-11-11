import { NextResponse, type NextRequest } from "next/server";

const DEVICE_COOKIE = "evnt_did";
const LOCALE_COOKIE = "evnt_lang";
const LOCALE_HEADER = "x-evnt-locale";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const LOCALES = new Set(["en", "ar", "fr"]);
const YEAR = 60 * 60 * 24 * 365;

function randomId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function middleware(req: NextRequest) {
  // CSRF defence for API routes: same-origin requests only (payment webhooks are exempt and verify signatures).
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/") && !path.startsWith("/api/webhooks/") && !path.startsWith("/api/cron") && MUTATING.has(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {}
      if (originHost !== host) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    } else if (req.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
  }

  const headers = new Headers(req.headers);
  const setCookies: [string, string][] = [];

  // ?lang=ar|fr|en: shareable/SEO language links. The choice is remembered.
  const lang = req.nextUrl.searchParams.get("lang");
  if (lang && LOCALES.has(lang)) {
    headers.set(LOCALE_HEADER, lang);
    setCookies.push([LOCALE_COOKIE, lang]);
  }

  if (!req.cookies.get(DEVICE_COOKIE)) {
    const id = randomId();
    req.cookies.set(DEVICE_COOKIE, id);
    headers.set("cookie", req.cookies.toString());
    setCookies.push([DEVICE_COOKIE, id]);
  }

  const res = NextResponse.next({ request: { headers } });
  for (const [name, value] of setCookies) {
    res.cookies.set(name, value, {
      httpOnly: name === DEVICE_COOKIE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: YEAR,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|media/|brand/|icons/|favicon.ico|robots.txt|sitemap.xml|sw.js|offline.html|manifest.webmanifest).*)"],
};
