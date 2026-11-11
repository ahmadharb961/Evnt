# EVNT — evnt.co

Lebanon's family discovery, booking and shopping platform: kids' activities and events with seat/spot selection, family restaurants with reservations, birthday planning with quotes, a multi-vendor kids' shop, EVNT+ membership, Farah Approved certification, and a full merchant SaaS and super-admin back office. English, Arabic (right-to-left) and French.

**Stack:** Next.js 15 (App Router, server actions) · TypeScript · Tailwind · PostgreSQL + Prisma · Leaflet/OpenStreetMap · Node 22 on Hostinger (same setup as NumNum/Hireel).

## Run locally
```bash
cp .env.example .env        # set DATABASE_URL to a local Postgres
npm install
npx prisma migrate deploy
SEED_DEMO=true npm run db:setup   # demo businesses (fictional) + your admin from ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev
```
Demo logins (local only): `parent@demo.evnt.local`, `cedar-kids-theater@demo.evnt.local`, `toybox-beirut@demo.evnt.local` … password `demo12345`.

## Tests
```bash
npm test                    # unit + database tests (concurrency: no double booking; holds expire; translations complete)
node e2e/booking.js         # browser: pick seats → reserve → QR tickets → second parent can't take them
node e2e/shop.js            # browser: multi-shop COD order split per shop → fulfilment → commission on collection
node e2e/smoke.js <email|-> /path …   # every page renders for a role
```
`node scripts/i18n-extract.mjs` refreshes the list of interface texts; the i18n test fails if any lacks Arabic or French.

## Deploy
See **[docs/SETUP.md](docs/SETUP.md)**.

## Where things are
```
prisma/              schema (≈60 tables), seed (categories, plans, commission matrix, ads, sections), demo data
src/server/          business logic: booking (holds, seats, tickets), payments (+ Whish adapter), commission & ledger,
                     billing (subscriptions, invoices, payouts), orders (COD/Whish), restaurants, birthdays (Radar),
                     farah, ads, plus (EVNT+), listings search, home CMS, reports
src/actions/         server actions (every one authorises the user and checks the merchant owns the record)
src/app/(site)/      public site + parent account      src/app/merchant/  merchant portal      src/app/admin/  super admin
src/i18n/            en/ar/fr — interface texts keyed by English (tr/*.ts); listing content is stored as {en, ar, fr}
src/content/legal.ts terms, privacy, refunds, review policy (3 languages — have a lawyer review before launch)
```

## Money rules (built in)
- Money is integer US cents; rates are basis points. Every price, rate and fee is editable in the admin without a deploy.
- A booking is confirmed only when free, an authorised pay-at-venue reservation, or a payment verified with the provider.
- Seats can't be double-booked (unique seat-per-session constraint); general-admission capacity uses atomic updates.
- Commission: 100% (paid via EVNT), 50% (verified external within 72h of a contact click), 0% (merchant's own link).
- Cash on delivery is never revenue until the merchant records the cash collected.
- Paying never grants Farah Approved; sponsored placements are labelled and need admin approval.
