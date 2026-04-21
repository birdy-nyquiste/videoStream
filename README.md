# Video Platform

A password-protected video streaming site built with React, Cloudflare Stream, and Cloudflare Pages.

## How it works

- Users enter a password to access the site. Auth is stored in `sessionStorage` (browser session only).
- The video list is fetched live from Cloudflare Stream via a Pages Function — no code changes needed when you upload new videos.
- Video titles are pulled from the name you set in the Cloudflare Stream dashboard.

## Prerequisites

- [Node.js](https://nodejs.org) (v18+)
- A [Cloudflare account](https://dash.cloudflare.com) with Cloudflare Stream enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) for local full-stack dev (`npm install -g wrangler`)

## Local setup

**1. Clone and install**

```bash
git clone <repo-url>
cd videoStream
npm install
```

**2. Create a Cloudflare API token**

Go to [Cloudflare dashboard](https://dash.cloudflare.com) → My Profile → API Tokens → Create Token.
Use the "Create custom token" option with:
- Permission: `Account > Cloudflare Stream > Read`
- Account Resources: your account

**3. Find your Account ID**

In the Cloudflare dashboard, select any domain (or go to Workers & Pages). Your Account ID is shown in the right sidebar.

**4. Configure environment variables**

Create a `.env.local` file in the project root (this file is gitignored):

```
VITE_SITE_PASSWORD=your-site-password
```

Create a `.dev.vars` file in the project root (also gitignored) for the Pages Function secrets:

```
CF_ACCOUNT_ID=your-cloudflare-account-id
CF_API_TOKEN=your-cloudflare-api-token
```

**5. Run locally**

The frontend alone (no video list — use this for UI work):

```bash
npm run dev
```

Full stack with the Pages Function (video list works):

```bash
npm run build
npx wrangler pages dev dist --compatibility-date=2024-01-01
```

## Adding videos

Upload a video to Cloudflare Stream and set its **Name** field — that becomes the title shown in the UI. No code changes needed.

## Deployment

**1. Push to GitHub** and connect the repo to Cloudflare Pages:
- Go to Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git
- Build command: `npm run build`
- Build output directory: `dist`

**2. Set environment variables** in Cloudflare Pages → your project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `VITE_SITE_PASSWORD` | the site password |
| `CF_ACCOUNT_ID` | your Cloudflare account ID |
| `CF_API_TOKEN` | the API token created above |

Make sure to add these to both **Production** and **Preview** environments if needed.

**3. Redeploy** (or push a new commit) for the env vars to take effect.

## Project structure

```
├── functions/
│   └── api/
│       └── videos.ts       # Pages Function — fetches video list from Cloudflare Stream
├── src/
│   ├── components/
│   │   ├── Login.tsx        # Password gate
│   │   ├── VideoList.tsx    # Sidebar + player layout, fetches /api/videos
│   │   └── VideoPlayer.tsx  # Cloudflare Stream embed
│   ├── config.ts            # Site password config
│   └── App.tsx              # Auth state, renders Login or VideoList
└── .env.local               # Local client env vars (gitignored)
└── .dev.vars                # Local Pages Function secrets (gitignored)
```
