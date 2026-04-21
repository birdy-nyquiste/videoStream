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

Copy `.env.local` (not committed) with:

- `VITE_SITE_PASSWORD` — the password users enter to access the site
- `VITE_VIDEO_ID` — Cloudflare Stream video ID

In production these are set in Cloudflare Pages dashboard.

## Architecture

This is a minimal password-protected video streaming SPA. There is no backend or router.

**Auth flow:** `App.tsx` checks `sessionStorage.isAuthenticated` on mount. If not set, it renders `<Login>`. On correct password (compared client-side against `VITE_SITE_PASSWORD`), it sets the flag and renders `<VideoList>`. Authentication persists for the browser session only.

**Video config:** All videos are declared as a static array in `src/config.ts`. Each entry has `{ id, title, videoId }` where `videoId` is a Cloudflare Stream UID. To add videos, add entries to this array (additional IDs via new env vars or hardcoded).

**Video playback:** `VideoPlayer` wraps `@cloudflare/stream-react`'s `<Stream>` component, passing the Cloudflare Stream UID as `src`.

**Deployment target:** Cloudflare Pages (static site, no SSR).
