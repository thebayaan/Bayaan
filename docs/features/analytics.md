# Feature: Analytics & Listening Insights

**Status:** Proposed
**Priority:** High
**Complexity:** Incremental (Level 0 through Level 4)
**Created:** 2026-02-20
**GitHub Issue:** [#119](https://github.com/thebayaan/Bayaan/issues/119)

## Overview

Add analytics to Bayaan to understand how users interact with the app — what they listen to, how long, which reciters are popular, and where users drop off. The implementation is designed as incremental levels of architectural change, allowing us to ship value quickly (Level 0) and layer on more capability over time.

## Problem Statement

Currently Bayaan has zero analytics, zero crash reporting, and no visibility into user behavior. We don't know:
- How many active users we have
- Which reciters/surahs are most popular
- Average listening session duration
- Where users drop off or churn
- What features are actually used
- What crashes are occurring in production

## Current State

- **Analytics:** None
- **Auth:** None (fully anonymous app)
- **Backend:** No runtime backend. Supabase is used only at build-time for fetching reciter data
- **Audio delivery:** Direct from CDNs (Supabase Storage, MP3Quran.net, QuranicAudio.com, Tarteel.ai)
- **State:** All local via Zustand + AsyncStorage + SQLite + MMKV
- **API URLs:** `EXPO_PUBLIC_API_URL` placeholders exist in `eas.json` but are unused

## Implementation Levels

### Level 0 — Anonymous Client-Side Analytics (No Backend, No Auth)

**What you get:** Screen views, button taps, session duration, device info, retention, funnels, listening behavior tracking.

**What you don't get:** Cross-device user identity, server-side event validation, data surviving reinstalls.

#### Recommended Tools

| Service | Free Tier | Strengths |
|---------|-----------|-----------|
| **PostHog** (recommended) | 1M events/mo | Open source, feature flags, session replay, funnels |
| **Mixpanel** | 20M events/mo | Great funnels and retention charts |
| **Amplitude** | 50K MTUs | Best-in-class product analytics |
| **Firebase Analytics** | Unlimited | Free forever, Crashlytics integration |
| **Aptabase** | Open source | Privacy-focused, lightweight, GDPR-friendly |

#### Core Events to Instrument

| Event | Trigger | Key Properties |
|-------|---------|----------------|
| `app_open` | App launches | `device_type`, `app_version`, `os_version` |
| `session_start` | Foreground | `referrer` |
| `session_end` | Background | `session_duration_ms` |
| `screen_viewed` | Navigation | `screen_name` (automatic with most SDKs) |
| `playback_started` | User hits play | `reciter_id`, `surah_number`, `rewayah_id` |
| `playback_paused` | User pauses | `listen_duration_ms`, `position_ms`, `total_duration_ms` |
| `playback_completed` | Surah finishes naturally | `listen_duration_ms`, `completed: true` |
| `playback_skipped` | User skips to next | `listen_duration_ms`, `percent_completed` |
| `session_listen_time` | App backgrounds | `total_listen_ms`, `surahs_played_count` |
| `reciter_selected` | Reciter chosen | `reciter_id`, `reciter_name` |
| `rewayah_changed` | Rewayah switched | `rewayah_id`, `rewayah_name` |
| `download_started` | Download begins | `reciter_id`, `surah_number` |
| `download_completed` | Download finishes | `reciter_id`, `surah_number`, `file_size_bytes` |
| `ambient_sound_toggled` | Ambient on/off | `sound_type`, `enabled` |
| `mushaf_page_viewed` | Mushaf page opened | `page_number`, `surah_number` |
| `search_performed` | User searches | `query`, `results_count` |
| `playlist_created` | New playlist | `playlist_name`, `track_count` |

#### Derived Insights (from dashboards)

- Total listen time per reciter, per surah, per rewayah
- Surah completion rate (% of surah actually finished)
- Most popular reciters and surahs
- Average session listen time
- Daily/weekly/monthly active listeners
- Drop-off points within surahs
- Reciter switching patterns
- Feature adoption (ambient sounds, mushaf, downloads, playlists)

#### Implementation Estimate: 1-2 days

Key files to modify:
- New: `services/analytics/AnalyticsService.ts` — singleton, wraps SDK
- New: `services/analytics/events.ts` — event name constants and property types
- Modify: `services/audio/ExpoAudioProvider.tsx` — fire playback events
- Modify: `services/player/store/playerStore.ts` — fire player state events
- Modify: `app/_layout.tsx` — initialize analytics on app start
- Modify: `services/AppInitializer.ts` — register analytics service

---

### Level 1 — Add Crash Reporting (No Backend, No Auth)

Everything from Level 0, plus:

- **Sentry** for crash reporting and performance monitoring
- JS exceptions, native crashes, ANRs
- Breadcrumbs correlated with analytics events
- Slow screen detection

**Cost:** Sentry free tier = 5K errors/mo, 10K performance transactions/mo.

**Implementation estimate:** +1 day on top of Level 0.

---

### Level 2 — Supabase Anonymous Auth + Cloud Events (Minimal Backend)

**Prerequisite for:** Wrapped/compilation feature, cross-device sync.

Uses existing Supabase project — no new infrastructure.

#### What This Unlocks

- Stable user identity that survives app reinstalls
- Cross-device listening history (if user later creates account)
- Server-side event storage for long-term queries
- "Wrapped" / annual listening compilation feature
- User cohorts and segmentation

#### Architecture

```
App → Supabase Auth (anonymous session, invisible to user)
App → Supabase PostgREST (write events to listening_events table)
App → CDN (audio unchanged — NOT routed through backend)
```

#### Database Schema

```sql
-- Anonymous user sessions (Supabase Auth handles this automatically)

-- Listening events for long-term storage and Wrapped feature
CREATE TABLE listening_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  reciter_id uuid,
  rewayah_id uuid,
  surah_number int,
  duration_listened_ms bigint,
  completed boolean DEFAULT false,
  played_at timestamptz DEFAULT now()
);

-- Index for Wrapped queries
CREATE INDEX idx_listening_events_user_year
  ON listening_events (user_id, EXTRACT(YEAR FROM played_at));

CREATE INDEX idx_listening_events_reciter
  ON listening_events (reciter_id, played_at);
```

#### Wrapped Feature Queries

```sql
-- Total listen time for the year
SELECT SUM(duration_listened_ms) / 3600000.0 AS hours_listened
FROM listening_events
WHERE user_id = $1 AND EXTRACT(YEAR FROM played_at) = 2026;

-- Top 5 reciters
SELECT reciter_id, SUM(duration_listened_ms) AS total_ms
FROM listening_events
WHERE user_id = $1 AND EXTRACT(YEAR FROM played_at) = 2026
GROUP BY reciter_id
ORDER BY total_ms DESC LIMIT 5;

-- Most played surah
SELECT surah_number, COUNT(*) AS play_count
FROM listening_events
WHERE user_id = $1 AND EXTRACT(YEAR FROM played_at) = 2026
GROUP BY surah_number
ORDER BY play_count DESC LIMIT 1;

-- Listening streak (days in a row)
SELECT played_at::date AS day
FROM listening_events
WHERE user_id = $1
GROUP BY day ORDER BY day;

-- Completion rate
SELECT
  COUNT(*) FILTER (WHERE completed) AS completed,
  COUNT(*) AS total
FROM listening_events
WHERE user_id = $1 AND EXTRACT(YEAR FROM played_at) = 2026;
```

#### Account Upgrade Path

Users start anonymous. When they want to preserve data across devices:
1. Prompt to create account (email, Apple, or Google sign-in)
2. Supabase `linkIdentity()` upgrades the anonymous session
3. All historical listening data is preserved under the same `user_id`
4. No data migration needed

#### Implementation Estimate: 3-5 days

Key files to create/modify:
- New: `services/supabase/SupabaseClient.ts` — runtime Supabase client (currently only exists in build scripts)
- New: `services/auth/AuthService.ts` — anonymous auth + optional upgrade
- New: `services/analytics/ListeningEventService.ts` — batched writes to Supabase
- Modify: `services/AppInitializer.ts` — initialize Supabase auth on startup
- Modify: `services/audio/ExpoAudioProvider.tsx` — write listening events

---

### Level 3 — Custom API Endpoints (Lightweight Backend)

Adds custom logic without managing servers.

**Option A: Expo API Routes** (use existing `EXPO_PUBLIC_API_URL` config)
- Create `app/api/` routes, deploy to EAS Hosting

**Option B: Supabase Edge Functions**
- Deno-based, deployed to existing Supabase project

#### What This Unlocks Beyond Level 2

- Custom event processing and validation
- Rate limiting and abuse prevention
- Aggregation endpoints (e.g., global "most played surahs this week")
- Webhook integrations (Slack alerts, email digests)
- Push notification targeting based on behavior
- Public stats / community features

#### Implementation Estimate: 1-2 weeks

**Audio still NOT routed through backend.** Direct CDN streaming continues.

---

### Level 4 — Full Backend with User Accounts (Maximum Capability)

Dedicated backend (Node/Express, Fastify, or Hono on Cloudflare Workers):

- Full user auth (email, Apple, Google sign-in)
- Server-side session tracking
- Audio URL proxying (optional — only for verified listen counts)
- User profiles, preferences sync, social features
- Admin dashboard for content management

**When needed:**
- Social features (sharing, following reciters)
- Verified/auditable listen counts
- Server-side A/B testing
- Subscription monetization

**Implementation Estimate:** Weeks to months.

---

## Recommended Rollout Plan

| Phase | Level | Effort | What Ships |
|-------|-------|--------|------------|
| **Phase 1** | Level 0 + 1 | 2-3 days | Full analytics + crash reporting |
| **Phase 2** | Level 2 | 3-5 days | Cloud listening history + anonymous auth |
| **Phase 3** | Wrapped UI | 3-5 days | Annual listening compilation (depends on Phase 2) |
| **Phase 4** | Level 3 | 1-2 weeks | Custom endpoints, community stats |

## Key Decisions

- **Audio is never routed through a backend.** At all levels, audio streams directly from CDNs. Analytics is a separate concern.
- **No auth enforcement required** for analytics or even Wrapped. Supabase anonymous auth is invisible to the user.
- **PostHog recommended** for Level 0 — best free tier + feature flags + React Native SDK.
- **Sentry recommended** for crash reporting — industry standard, great Expo integration.
- **Existing Supabase project** is sufficient through Level 2 — no new infrastructure needed.
