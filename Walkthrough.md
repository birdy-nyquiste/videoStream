# Complete walkthrough

## What I built

### Database (Supabase)

One table, applied via migration `create_entitlements_table`:

```sql
create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  stripe_customer_id text,
  stripe_session_id text unique,
  purchased_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
create policy "select own entitlement" on public.entitlements
  for select to authenticated using (auth.uid() = user_id);
```

Why keyed on `user_id` not `email`: survives email changes, immune to typo-mismatch between login email and Stripe email.

### Server (Pages Functions)

| File | Responsibility |
| --- | --- |
| `functions/_lib/auth.ts` | `extractBearer`, `verifyJwt` (calls `supabase.auth.getUser` — works with Supabase's asymmetric JWTs), `serviceClient`, `hasEntitlement` |
| `functions/api/token/[uid].ts` | 401 (no/invalid JWT) → 402 (no entitlement) → mints Stream signed token. **The single enforcement point.** |
| `functions/api/checkout.ts` | Verifies JWT, creates Stripe Checkout Session with `customer_email` locked + `client_reference_id = user_id` |
| `functions/api/stripe/webhook.ts` | `constructEventAsync` + `Stripe.createSubtleCryptoProvider()` (Workers-runtime crypto). Idempotent upsert keyed on `user_id`. |

### Client

| File | Responsibility |
| --- | --- |
| `src/lib/supabase.ts` | Browser client, PKCE flow, persistent 30-day session |
| `src/components/EmailLogin.tsx` | Two-step OTP form: email → 6-digit code → `verifyOtp` |
| `src/components/Paywall.tsx` | "Pay $9.99" → POST `/api/checkout` with JWT → redirect to Stripe |
| `src/components/PaymentReturn.tsx` | Polls entitlements for own row (15× × 1s), then "contact support" fallback |
| `src/components/VideoList.tsx` | Tracks session + entitlement, branches on play click, threads JWT to `/api/token`, auto-resumes deferred play after login or post-payment, sidebar shows email + Sign out |
| `src/App.tsx` | Site-password gate → renders `<VideoList>` once unlocked |

### Play branching logic

```text
click video →
  if origin not allowed → "no access" placeholder
  if no Supabase session → <EmailLogin>, save pending
  else → fetchToken with JWT
    if 402 → <Paywall>, save pending
    else → <VideoPlayer>
```

The server (`/api/token/[uid]`) is the single source of truth for entitlement — no client-side entitlement check on click. After login completes (`onAuthStateChange`) or payment activates (`PaymentReturn → onActivated`), the saved pending uid auto-resumes.

---

## What you do — development

### One-time: collect secrets

1. **Cloudflare**: account ID + API token with `Stream:Read`. Already have these.
2. **Supabase** (project `qnobycuemfgiiduvefxe`): Dashboard → Project Settings → API → copy **service role key** (the long `eyJ...` one labeled "service_role"). Already have URL + publishable key in `.env.local`.
3. **Stripe** (test mode):
   - Dashboard → Products → create one-time $9.99 product → copy `price_...`.
   - Dashboard → Developers → API keys → copy `sk_test_...`.
4. **Supabase email template**: Dashboard → Authentication → Emails → Email Templates → "Magic Link". Replace the body so it shows only the 6-digit code, e.g.:

   ```html
   <p>Your sign-in code is:</p>
   <p style="font-size: 24px; letter-spacing: 4px;"><strong>{{ .Token }}</strong></p>
   <p>This code expires in 1 hour.</p>
   ```

   (No `{{ .ConfirmationURL }}` — we use OTP, not the link.)

### One-time: write `.dev.vars`

Create `/Users/birdy/NyquisteProjects/videoStream/.dev.vars`:

```ini
CF_ACCOUNT_ID=<existing>
CF_API_TOKEN=<existing>
SUPABASE_URL=https://qnobycuemfgiiduvefxe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=<filled in next step>
```

### Each dev session: three terminals

**Terminal 1 — build + serve:**

```bash
npm run build && npx wrangler pages dev dist --compatibility-date=2024-01-01
```

Wrangler picks port 8788 by default. If it picks something else, update the Supabase Auth redirect URL.

**Terminal 2 — Stripe webhook forwarding:**

```bash
stripe listen --forward-to http://localhost:8788/api/stripe/webhook
```

First time: it prints `whsec_...`. Paste that into `.dev.vars` as `STRIPE_WEBHOOK_SECRET` and restart terminal 1.

**If you're using a Stripe Sandbox** (separate from regular test mode), `stripe listen` won't see sandbox events with the default login. Pass the sandbox's own `sk_test_...` explicitly:

```bash
stripe listen --forward-to http://localhost:8788/api/stripe/webhook --api-key sk_test_YOUR_SANDBOX_KEY
```

The `whsec_...` it prints is sandbox-specific — use that.

**Terminal 3 — vibe check:** `curl http://localhost:8788/api/videos` etc.

### Test the full flow

1. Open `http://localhost:8788` → enter site password.
2. Click a video → EmailLogin overlay → enter your email → "Send code".
3. Check your inbox → copy the 6-digit code → paste into the form → "Verify".
4. Session activates in the same tab → click video again → Paywall overlay (server returned 402).
5. Click "Pay $9.99" → Stripe Checkout (use test card `4242 4242 4242 4242`, any future expiry, any CVC).
6. Stripe redirects to `/?paid=1` → PaymentReturn overlay polls → webhook fires (Terminal 2 logs it) → entitlement appears → overlay closes → video token fetched → playback starts.

If anything breaks, check Terminal 1 (Pages Function logs) and Terminal 2 (webhook logs).

---

## What you do — production

### One-time: production secrets

1. **Stripe live mode**:
   - Activate live mode in Stripe dashboard.
   - Recreate the $9.99 product in **live mode** → copy live `price_...`.
   - Copy live `sk_live_...` from API keys.
2. **Stripe production webhook**:
   - Stripe → Developers → Webhooks → **Add endpoint**.
   - URL: `https://YOUR-DOMAIN/api/stripe/webhook`.
   - Events: select **only** `checkout.session.completed`.
   - Copy the signing secret (`whsec_...`) — different from your local one.
3. **Supabase email template**: same OTP-only template applies in production (it's a single template, not per-environment).

### Cloudflare Pages env vars

Dashboard → your Pages project → Settings → Environment Variables → set all of these for **both Production and Preview**:

| Variable | Value |
| --- | --- |
| `VITE_SITE_PASSWORD` | site password |
| `VITE_SUPABASE_URL` | `https://qnobycuemfgiiduvefxe.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `CF_ACCOUNT_ID` | your account ID |
| `CF_API_TOKEN` | the Stream:Read token |
| `SUPABASE_URL` | same as VITE_SUPABASE_URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (mark as Secret) |
| `STRIPE_SECRET_KEY` | `sk_live_...` (mark as Secret) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from production webhook (Secret) |
| `STRIPE_PRICE_ID` | live `price_...` |

### Deploy

Push to main (or whichever branch is connected) → Pages auto-builds. Or trigger manual redeploy in dashboard. Env-var changes only take effect on the next build.

### Verify in production

1. Hit `https://YOUR-DOMAIN`, enter password.
2. Sign up with a real email.
3. Pay with a real card (or use Stripe's test mode keys first by temporarily swapping env vars).
4. Confirm playback works.
5. In Supabase → Table Editor → `entitlements`: confirm your row exists.
6. In Stripe → Developers → Webhooks → click your endpoint → check recent deliveries are 200.

### Ongoing operations

- **Issue a refund**: Stripe dashboard → refund → then in Supabase, `delete from public.entitlements where user_id = '<uuid>';` (refunds aren't webhook-handled).
- **Revoke access manually**: same — delete the entitlement row.
- **Comp someone**: `insert into public.entitlements (user_id, email) values ('<uuid>', '<email>');` after they sign up.
- **Email volume grows**: Supabase's built-in SMTP is ~4 emails/hour. Configure custom SMTP via Resend:
  1. Verify your sending domain in Resend (DNS records green) and create an API key with "Sending access".
  2. Supabase → Authentication → Emails → SMTP Settings → Enable Custom SMTP. Host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key, sender = `noreply@your-verified-domain`.
  3. Supabase → Authentication → Rate Limits → bump "Emails per hour" (default stays at 4 otherwise).

---

## Known gaps (deferred from v1)

- `charge.refunded` not webhook-handled (manual SQL).
- Stream signed-token expiry mid-playback not refreshed (pre-existing).
- No admin UI for entitlements (use Supabase dashboard).
- `stripe_customer_id` is NULL on entitlement rows — expected for one-time `mode: 'payment'` Checkout. Set `customer_creation: 'always'` in `functions/api/checkout.ts` if you need a Stripe Customer record.

## Console noise that's not a bug

- `GET /api/token/<uid> 402 (Payment Required)` when the paywall opens — that's the server signaling "not entitled" via the standard HTTP code; the React side branches on it. Expected.
- `ERR_BLOCKED_BY_CLIENT` for `r.stripe.com` / `m.stripe.com` on the Stripe Checkout page — an ad blocker / privacy extension blocking Stripe's telemetry. Doesn't affect payment.
