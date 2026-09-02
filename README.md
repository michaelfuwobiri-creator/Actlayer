# ActLayer

EU AI Act + GDPR/cookie compliance scanner. Enter a URL, get a scored
report of 13 checks, unlock the exact fix for each failing/warning one
for $49.

## Local setup

```bash
npm install
cp .env.local.example .env.local   # fill in DATABASE_URL, STRIPE_* (see below)
npm run dev
```

## Required environment variables

- `DATABASE_URL` — a Neon Postgres connection string. Run `db/migrations/0001_init.sql` against it once (Neon's SQL editor, or `psql "$DATABASE_URL" -f db/migrations/0001_init.sql`).
- `STRIPE_SECRET_KEY` — from your Stripe dashboard.
- `STRIPE_UNLOCK_PRICE_ID` — create a one-time $49 Price in Stripe (Product: "ActLayer report unlock") and put its Price ID here.
- `STRIPE_WEBHOOK_SECRET` — from the Stripe webhook endpoint you point at `/api/billing/webhook` (listen for `checkout.session.completed`).
- `NEXT_PUBLIC_SITE_URL` — `https://actlayer.eu` in production.

## Deploying

1. Push this repo to GitHub.
2. Import it into Vercel, add the env vars above.
3. Point `actlayer.eu` at the Vercel project (Vercel → Domains).
4. Add a Stripe webhook endpoint at `https://actlayer.eu/api/billing/webhook` for `checkout.session.completed`, copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

## How the scan works

`lib/checks.ts` fetches the target's homepage and privacy-policy page as
plain HTML/text (no headless browser in v1) and runs 13 heuristic checks
across three categories: cookies & tracking, AI disclosure (EU AI Act
Art. 50), and privacy-policy content. Checks that can't be confidently
verified from static HTML return "review" or "na" rather than guessing --
see the comments at the top of the file. `lib/fixSnippets.ts` holds the
actual paid content: drop-in code and copy for each fixable check,
generalized from the same fixes built and shipped for gysm.io's own EU AI
Act/GDPR remediation.

Verified with mocked-fetch unit runs against three synthetic sites (a
compliant AI product, a non-compliant one, and a non-AI site) rather than
live URLs, since this sandbox has no outbound network access to actually
hit gysm.io or any other real site. Test it against a real site once
deployed, or locally with `npm run dev` if your machine has internet
access.

Not legal advice -- a technical/content scan only.
