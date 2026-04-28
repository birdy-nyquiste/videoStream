# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server — frontend only, Pages Functions don't run
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run preview   # Preview production build locally

# Full stack (Pages Functions included) — required to test /api/* endpoints:
npm run build && npx wrangler pages dev dist --compatibility-date=2024-01-01
```

## Environment Variables

**Client-side** (in `.env.local`, prefixed `VITE_`):
- `VITE_SITE_PASSWORD` — the password users enter to access the site
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key

**Server-side** (Pages Function env vars; locally in `.dev.vars`, in prod via Cloudflare dashboard):
- `CF_ACCOUNT_ID` — Cloudflare account ID
- `CF_API_TOKEN` — Cloudflare API token with `Stream:Read` permission
- `SUPABASE_URL` — same Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (bypasses RLS; never expose to browser)
- `STRIPE_SECRET_KEY` — Stripe secret key (test mode in dev, live in prod)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (different value for `stripe listen` vs prod endpoint)
- `STRIPE_PRICE_ID` — Stripe Price ID for the $9.99 one-time product

## Architecture

Password-protected video streaming SPA with a Stripe paywall, backed by Cloudflare Pages Functions and Supabase.

### Auth & paywall layers

There are **three independent gates**:

1. **Site password** (`VITE_SITE_PASSWORD`) — gates the whole UI. Stored in `sessionStorage`. Browser-session only.
2. **Supabase magic-link login** — required to *play* a video. Persists 30 days via the Supabase JS client. Login form: `EmailLogin.tsx`.
3. **Stripe entitlement** — once-paid lifetime access. Stored in Supabase `entitlements` table keyed by `user_id`. Enforced by `/api/token/[uid]`.

Per-video `allowedOrigins` is a separate axis: a paid user on a non-allowed origin still can't play that specific video.

### Auth flow

- `App.tsx` checks `sessionStorage.isAuthenticated` on mount → renders `<Login>` or `<VideoList>`.
- Path `/auth/callback` bypasses the password gate and renders `<AuthCallback>`, which exchanges the PKCE code for a Supabase session, then redirects to `/`.
- `<VideoList>` subscribes to `supabase.auth.onAuthStateChange` and tracks `entitled` via a self-row read on `entitlements` (RLS scopes to own row).

### Play flow

Click a video → `requestPlay`:
- if `!session` → show `<EmailLogin>`, save `pendingPlayUid`
- if `session && !entitled` → refresh entitlement; if still none, show `<Paywall>`, save `pendingPlayUid`
- else → `fetchToken(uid)` with `Authorization: Bearer <jwt>` → mint Stream token → `<VideoPlayer>`

After auth state changes (login completes) or after `<PaymentReturn>` confirms entitlement, the pending uid auto-resumes.

### Stripe checkout

- `POST /api/checkout` — verifies JWT, creates a Checkout Session with `customer_email: jwt.email` (locked) and `client_reference_id: jwt.sub` (user_id). Returns `{ url }`.
- Stripe redirects to `${origin}/?paid=1` on success → `<PaymentReturn>` polls entitlements (15× × 1s) and unblocks playback. After 15s, shows fallback "contact support" message.

### Stripe webhook

- `POST /api/stripe/webhook` — verifies signature with `stripe.webhooks.constructEventAsync()` + `Stripe.createSubtleCryptoProvider()` (Workers-runtime crypto, NOT Node crypto).
- On `checkout.session.completed` with `payment_status: 'paid'`: upserts entitlement keyed by `client_reference_id`. Conflict on `user_id` → `ignoreDuplicates: true` (idempotent across Stripe retries).
- Refunds are NOT handled. To revoke an entitlement: `delete from entitlements where user_id = '...'` via the Supabase dashboard.

### Video list

`VideoList.tsx` fetches `/api/videos` on mount. The Pages Function at `functions/api/videos.ts` calls the Cloudflare Stream API and returns all videos. Titles come from the `name` field in the Stream dashboard. To add a video, upload it to Cloudflare Stream — no code changes needed.

### Video playback

`VideoPlayer` wraps `@cloudflare/stream-react`'s `<Stream>` component, passing a Stream signed token (NOT the UID) as `src`. All videos must have `requireSignedURLs: true` on Cloudflare Stream — that's what makes the entitlement gate enforceable.

### Files

- `src/lib/supabase.ts` — browser Supabase client, PKCE flow, persistent session
- `src/components/EmailLogin.tsx` — magic-link form
- `src/components/AuthCallback.tsx` — handles `/auth/callback`
- `src/components/Paywall.tsx` — "Pay $9.99" → POST `/api/checkout`
- `src/components/PaymentReturn.tsx` — post-payment polling
- `functions/_lib/auth.ts` — `extractBearer`, `verifyJwt` (via `supabase.auth.getUser`), `serviceClient`, `hasEntitlement`
- `functions/api/checkout.ts` — Stripe Checkout Session creation
- `functions/api/stripe/webhook.ts` — webhook handler with Subtle crypto
- `functions/api/token/[uid].ts` — gates Stream signed-token issuance on JWT + entitlement

## Local dev SOP

1. **Run wrangler, not vite, to test paywall flow** — `vite dev` doesn't run Pages Functions.
2. **Stripe webhook in local:** `stripe listen --forward-to http://localhost:8788/api/stripe/webhook` — use the printed signing secret as `STRIPE_WEBHOOK_SECRET` in `.dev.vars`.
3. **Supabase Auth Redirect URLs:** add both `http://localhost:8788` (or whatever port wrangler picks) and the prod domain to Supabase → Authentication → URL Configuration → Redirect URLs.

## Operational notes

- **Magic-link email rate limit:** Supabase's built-in SMTP is ~4 emails/hour on free tier. For higher volume, configure custom SMTP (Resend, SendGrid) in Supabase → Authentication → Emails.
- **Refund handling:** unimplemented. Manually delete the entitlement row in Supabase if a refund is issued.
- **Stream token expiry:** default ~1 hour. Mid-playback refresh is not implemented (pre-existing).

## Deployment target

Cloudflare Pages (static site + Pages Functions). Set all server-side env vars in the dashboard under Settings → Environment Variables for both Production and Preview environments.
