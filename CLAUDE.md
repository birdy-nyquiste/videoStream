# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite)
npm run build     # Type-check + production build (tsc -b && vite build)
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

## Environment Variables

**Client-side** (in `.env.local`, prefixed `VITE_`):
- `VITE_SITE_PASSWORD` — the password users enter to access the site

**Server-side** (Pages Function env vars, never exposed to the browser):
- `CF_ACCOUNT_ID` — Cloudflare account ID
- `CF_API_TOKEN` — Cloudflare API token with `Stream:Read` permission

In production these are set in the Cloudflare Pages dashboard under Settings → Environment Variables.

## Architecture

This is a minimal password-protected video streaming SPA backed by a Cloudflare Pages Function.

**Auth flow:** `App.tsx` checks `sessionStorage.isAuthenticated` on mount. If not set, it renders `<Login>`. On correct password (compared client-side against `VITE_SITE_PASSWORD`), it sets the flag and renders `<VideoList>`. Authentication persists for the browser session only.

**Video list:** `VideoList.tsx` fetches `/api/videos` on mount. The Pages Function at `functions/api/videos.ts` calls the Cloudflare Stream API and returns all videos with their uid, title, thumbnail, and duration. Video titles come from the `name` field set in the Stream dashboard. To add a video, upload it to Cloudflare Stream — no code changes needed.

**Video playback:** `VideoPlayer` wraps `@cloudflare/stream-react`'s `<Stream>` component, passing the Cloudflare Stream UID as `src`.

**Deployment target:** Cloudflare Pages (static site + Pages Functions).
