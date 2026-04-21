# Feature: Shareable Deep Links

**Status:** Planned
**Priority:** Medium
**Complexity:** Medium–High (depending on chosen approach)
**Created:** 2026-02-20
**GitHub Issue:** [#117](https://github.com/thebayaan/Bayaan/issues/117)
**Related:** [Cloud Sync (#120)](https://github.com/thebayaan/Bayaan/issues/120), [`docs/features/cloud-sync.md`](cloud-sync.md)

## Overview

Enable users to share links to reciters, recitations, surahs, playlists, mushaf pages, and other app content. Tapping a link should open the relevant screen in Bayaan (or redirect to the App/Play Store if not installed). Links shared on social media and messaging apps should display rich preview cards (title, image, description).

## User Stories

- As a user, I want to share a reciter's page with a friend so they can discover that reciter on Bayaan.
- As a user, I want to share a specific surah recitation so the recipient can start listening immediately.
- As a user, I want to share a playlist I've curated so others can listen to the same collection.
- As a user, I want links I share on WhatsApp/iMessage/Twitter to show a preview card with the reciter name, surah title, or playlist info.

## Shareable Entities

| Entity | Example URL | Data Source |
|--------|-------------|-------------|
| Reciter | `https://bayaan.app/reciter/{id}` | Supabase `reciters` table |
| Surah (specific reciter) | `https://bayaan.app/reciter/{id}/surah/{num}` | Supabase `rewayat` table |
| Playlist | `https://bayaan.app/playlist/{id}` | Local (requires server storage to share) |
| Mushaf page | `https://bayaan.app/mushaf/{page}` | Static (page number) |
| Adhkar | `https://bayaan.app/adhkar/{superId}` | Local data |

## Current State

- **Custom URL scheme** `bayaan://` is already configured in `app.config.js`
- **Expo Router v4** with file-based routing already has dynamic routes: `reciter/[id]`, `playlist/[id]`
- **No associated domain** (Universal Links / App Links) configured yet
- **No backend** — Supabase is used for storage and data, but no edge functions or API layer exists
- **Playlists are local** — stored in Zustand/AsyncStorage, not server-side

## Options (Increasing Architectural Change)

### Level 1: Custom URL Scheme Only

Use the existing `bayaan://` scheme. Links like `bayaan://reciter/abc123` resolve via Expo Router.

- **Pros:** Near-zero effort, works today
- **Cons:** Only works with app installed, no web fallback, no social preview cards, ugly URLs

### Level 2: Universal Links + Static Landing Site

Register a domain (e.g., `bayaan.app`), host a static site on GitHub Pages or Vercel, configure Apple Associated Domains and Android App Links.

- Host `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`
- Static HTML fallback redirects to App Store / Play Store
- **Pros:** Real URLs, web fallback, free hosting
- **Cons:** Generic social previews (can't show reciter-specific info), no analytics, no deferred deep linking

### Level 3: Serverless Edge Functions for Dynamic Previews (Recommended Starting Point)

Same as Level 2, but use **Supabase Edge Functions** to dynamically render OG meta tags by looking up reciter/surah data from the existing database.

- Bot crawlers get HTML with `og:title`, `og:image`, `og:description`
- Real users get redirected to the app or store
- **Pros:** Rich social previews, fits existing Supabase stack, audio stays where it is
- **Cons:** Edge function maintenance, no deferred deep linking

### Level 4: Third-Party Deep Link Service (Branch.io, etc.)

Integrate a deep linking SDK that handles universal links, deferred deep linking, analytics, and short URLs.

- **Pros:** Deferred deep linking, analytics, short URLs out of the box
- **Cons:** Third-party dependency, SDK bundle size, potential cost

### Level 5: Dedicated Backend / BFF

Build a backend layer (Supabase Edge Functions or standalone server) that handles link resolution, short link generation, link analytics, deferred deep linking, and server-side playlist storage for sharing.

- **Pros:** Full control, enables playlist sharing, future-proof for user accounts/cloud sync
- **Cons:** Most effort, ongoing maintenance

## Key Technical Considerations

- **Audio routing does NOT need to change.** Audio continues streaming directly from Supabase Storage / mp3quran.net. The link system only handles metadata and navigation.
- **Playlist sharing requires server-side storage.** Since playlists are local, sharing them via link requires either encoding the playlist in the URL (limited) or storing it server-side and fetching on the recipient's device.
- **Expo Router handles in-app routing.** Once a link resolves to the app, Expo Router's file-based routing maps the URL path to the correct screen automatically.
- **Native config changes required:** `expo-router` linking config, Associated Domains entitlement (iOS), intent filters (Android).

## Implementation Phases

1. **Phase 1:** Configure Universal Links / App Links with a static landing page (Level 2)
2. **Phase 2:** Add Supabase Edge Functions for dynamic OG previews (Level 3)
3. **Phase 3:** Add in-app "Share" buttons that generate and copy links
4. **Phase 4:** Evaluate deferred deep linking and playlist sharing needs (Level 4/5)

## Files Likely Affected

- `app.config.js` — Associated Domains, intent filters
- `app/+native-intent.ts` — URL-to-route mapping (new file)
- `app/_layout.tsx` — Deep link handling on cold start
- New: landing site repo or Supabase Edge Function
- Share UI components across reciter, surah, playlist screens

## Open Questions

- What domain to use? (`bayaan.app`, `share.bayaan.app`, subdomain of existing?)
- Should Level 3 (edge functions) be the initial target, or start simpler with Level 2?
- Are playlists a must-have for V1 of sharing, or can they come later?
- Should shared links include the rewayah (e.g., Hafs A'n Asim) or default to the reciter's primary?
