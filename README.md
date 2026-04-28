# Video Platform

A password-protected video streaming site with a Stripe paywall, built with React, Cloudflare Stream, Cloudflare Pages, and Supabase.

## How it works

Three independent gates:

1. **Site password** — anyone reaching the URL must enter the site password to see the library. Stored in `sessionStorage`.
2. **Magic-link login** — required to play a video. Email-only, no passwords. Sessions persist 30 days.
3. **One-time Stripe payment** — $9.99 lifetime access to the library. Enforced server-side at the Stream signed-token endpoint.

Per-video `allowedOrigins` (set in Cloudflare Stream) is independent of the paywall — a paid user on a non-allowed origin still can't play that specific video.

Video titles come from the `name` field set in the Cloudflare Stream dashboard. To add a video, upload it to Stream — no code changes needed.

## Prerequisites

- [Node.js](https://nodejs.org) (v18+)
- A [Cloudflare account](https://dash.cloudflare.com) with Cloudflare Stream enabled
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Stripe](https://stripe.com) account (test mode for dev)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) for local full-stack dev (`npm install -g wrangler`)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) for local webhook forwarding

## Local setup

### 1. Clone and install

```bash
git clone <repo-url>
cd videoStream
npm install
```

### 2. Cloudflare API token

Go to [Cloudflare dashboard](https://dash.cloudflare.com) → My Profile → API Tokens → Create Token (custom):

- Permission: `Account > Cloudflare Stream > Read`
- Account Resources: your account

Find your Account ID in the dashboard sidebar (Workers & Pages or any domain page).

### 3. Supabase setup

In your Supabase project:

- Apply the schema in `supabase/migrations/` (or run the SQL from `CLAUDE.md` → Architecture).
- Authentication → URL Configuration → Redirect URLs: add both `http://localhost:8788` and your prod domain.
- Authentication → Emails: optionally configure custom SMTP (the built-in is ~4 emails/hour on free tier).
- Project Settings → API: copy the Project URL, the publishable key, and the **service role key**.

### 4. Stripe setup

- Create a one-time Product priced at $9.99 (test mode) and copy the Price ID (`price_...`).
- For local webhook testing: `stripe login`, then `stripe listen --forward-to http://localhost:8788/api/stripe/webhook`. Copy the printed `whsec_...` signing secret.
- If you're using a Stripe **Sandbox** (separate from regular test mode), the CLI won't see sandbox events with the default login. Pass the sandbox's own test key explicitly: `stripe listen --forward-to http://localhost:8788/api/stripe/webhook --api-key sk_test_YOUR_SANDBOX_KEY`.

### 5. Environment variables

Create `.env.local` (gitignored) for client-side:

```ini
VITE_SITE_PASSWORD=your-site-password
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Create `.dev.vars` (gitignored) for Pages Function secrets:

```ini
CF_ACCOUNT_ID=...
CF_API_TOKEN=...
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

### 6. Run locally

Frontend only (no API):

```bash
npm run dev
```

Full stack (required for paywall flow):

```bash
npm run build && npx wrangler pages dev dist --compatibility-date=2024-01-01
```

In a separate terminal, forward Stripe webhooks:

```bash
stripe listen --forward-to http://localhost:8788/api/stripe/webhook
```

## Deployment

### 1. Push to GitHub and connect Cloudflare Pages

- Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git
- Build command: `npm run build`
- Build output: `dist`

### 2. Set environment variables

In Cloudflare Pages → Settings → Environment Variables (both Production and Preview):

| Variable | Notes |
| --- | --- |
| `VITE_SITE_PASSWORD` | site password |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `CF_API_TOKEN` | Stream:Read token |
| `SUPABASE_URL` | same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `STRIPE_SECRET_KEY` | live key for prod |
| `STRIPE_WEBHOOK_SECRET` | from the prod webhook endpoint, see below |
| `STRIPE_PRICE_ID` | live Price ID |

### 3. Register the prod Stripe webhook

In Stripe dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://YOUR-DOMAIN/api/stripe/webhook`
- Events: `checkout.session.completed`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` (different from the local `stripe listen` secret).

### 4. Add prod domain to Supabase Auth

Add the prod domain to Supabase → Authentication → URL Configuration → Redirect URLs.

### 5. Redeploy

Push a new commit (or trigger redeploy) for env vars to take effect.

## Adding videos

Upload to Cloudflare Stream and set the **Name** field — that becomes the title in the UI. Make sure `requireSignedURLs` is enabled (the paywall depends on it).

## Operational SOPs

- **Refunds:** not auto-handled. Manually `delete from entitlements where user_id = '...'` in Supabase.
- **Magic-link rate limit:** Supabase free tier ~4 emails/hour. To use Resend: verify your sending domain in Resend, then in Supabase → Authentication → Emails → SMTP Settings, set host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key, sender = `noreply@your-verified-domain`. After enabling custom SMTP, raise the limit under Authentication → Rate Limits.
- **Locked out user:** delete their row from `entitlements` (revokes paywall) or `auth.users` (revokes login entirely).

## Project structure

```text
├── functions/
│   ├── _lib/
│   │   └── auth.ts                 # JWT verify + entitlement check (server)
│   └── api/
│       ├── videos.ts               # Lists videos from Cloudflare Stream
│       ├── token/[uid].ts          # Gates Stream signed-token issuance
│       ├── checkout.ts             # Creates Stripe Checkout Session
│       └── stripe/webhook.ts       # Handles checkout.session.completed
├── src/
│   ├── components/
│   │   ├── Login.tsx               # Site password gate
│   │   ├── EmailLogin.tsx          # Supabase magic-link form
│   │   ├── AuthCallback.tsx        # /auth/callback handler
│   │   ├── Paywall.tsx             # Stripe checkout entry
│   │   ├── PaymentReturn.tsx       # Post-payment polling
│   │   ├── VideoList.tsx           # Sidebar + player layout
│   │   └── VideoPlayer.tsx         # Cloudflare Stream embed
│   ├── lib/
│   │   └── supabase.ts             # Browser Supabase client
│   ├── config.ts                   # Site password config
│   └── App.tsx
├── .env.local                      # Client env (gitignored)
└── .dev.vars                       # Pages Function secrets (gitignored)
```
