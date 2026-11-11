# Putting EVNT online (Hostinger — same setup as NumNum and Hireel)

| | What for | Cost |
|---|---|---|
| **Hostinger Cloud Startup** (Node.js) | Runs evnt.co + the email mailbox | Your existing plan |
| **Neon** | PostgreSQL database (also stores photos and the hero video) | Free to start |
| **GitHub** | The code (`ahmadharb961/Evnt`) | Free |
| **Whish Money** (later) | Online payments | Merchant agreement with Whish |

Passwords, API keys and secrets go **only** into Hostinger's environment-variable screen — never into chat, email or code.

---

## 1. Domain (10 min + waiting)
1. hPanel → **Websites → Add website** → add `evnt.co` to your Cloud plan. hPanel shows two nameservers.
2. At your registrar, set the domain's nameservers to those two.
3. When hPanel shows the domain as connected: **Security → SSL** → turn on free SSL.

## 2. Database (Neon, 5 min)
1. neon.tech → **New project** → name `evnt`, region **Europe (Frankfurt)**. (A new project, separate from NumNum/Hireel.)
2. Copy the connection string (**pooled connection OFF**). Keep it for step 4.

## 3. Email (Hostinger mailbox, 5 min)
hPanel → **Emails** → `evnt.co` → create `no-reply@evnt.co`. SMTP: host `smtp.hostinger.com`, port `465`.

## 4. Deploy the app (15 min)
1. hPanel → **Websites → evnt.co → Node.js → Import Git repository** → `ahmadharb961/Evnt`, branch `main`
   (merge the development branch into `main` first, or select it directly).
2. Node **22** · Install `npm install` · Build `npm run build` · Start `npm start`.
3. Environment variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `APP_URL` | `https://evnt.co` (no slash at the end) |
| `SESSION_SECRET` | long random text (40+ characters) |
| `CRON_SECRET` | another long random text |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | your first super-admin login (created on first deploy) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | from step 3 |
| `MAIL_FROM` | `EVNT <no-reply@evnt.co>` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional — the Google button appears only when set |
| `NEXT_PUBLIC_MAP_TILES_URL` | optional — a map tile provider for production traffic |

Do **not** set `SEED_DEMO` in production (it loads fictional demo businesses).

4. Deploy. The build applies database migrations, creates categories, plans, the commission matrix, ad placements, homepage sections and your admin account. It never overwrites prices or content you changed later.

## 5. Scheduled jobs (2 min)
hPanel → **Advanced → Cron jobs** → every 10 minutes:
```
curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://evnt.co/api/cron
```
It releases expired seat holds, re-checks pending payments, completes past bookings (unlocks verified reviews), cancels unpaid orders, sends reminders, and runs billing, EVNT+ renewals, Farah expiry and ad endings. Every job is safe to run repeatedly.

## 6. First things to do as admin (`/admin`)
1. **Platform settings** — support WhatsApp/email, booking fee, hold minutes, trial, prices.
2. **Homepage & content** — upload the hero video (MP4, compressed, ~10 s loop, under 35 MB) and fallback image; reorder sections.
3. **Plans & pricing** — confirm the subscription prices, commission matrix and ad prices.
4. **Users** — give your team roles (ADMIN, FINANCE, CONTENT, EVALUATOR).
5. Invite your first merchants to `/business/join` and approve them in **Merchants**.

## 7. Whish Money (when you have the merchant account)
Online payment stays clearly marked as "not available yet" until this is done — nothing is ever shown as paid without Whish confirming it.
1. Get from Whish: API base URL, **channel**, **secret**, and your registered **website URL**, plus their official API documentation and sandbox access.
2. Set `WHISH_API_BASE`, `WHISH_CHANNEL`, `WHISH_SECRET`, `WHISH_WEBSITE_URL` in Hostinger.
3. Give the developer the Whish documentation to compare with `src/server/payments/whish.ts`, then test end to end in sandbox.
4. Admin → Platform settings → tick `whish.enabled`.
Payments are confirmed only by asking Whish for the status server-to-server (callback: `https://evnt.co/api/webhooks/whish`).

Until then, bookings work as **free** or **pay at the venue** (per listing), shop orders as **cash on delivery**, and merchant invoices are recorded by finance as offline payments.
