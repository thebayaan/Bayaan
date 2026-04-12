# Feature: Analytics & Listening Insights

**Status:** In Design
**Priority:** High
**Created:** 2026-02-20
**Updated:** 2026-04-12
**GitHub Issue:** [#119](https://github.com/thebayaan/Bayaan/issues/119)

## Overview

Comprehensive analytics system for Bayaan — Spotify-level listening insights, Tarteel-level reading tracking, adhkar engagement, and the data foundation for future features like a stats dashboard, activity calendar, and Bayaan Wrapped.

This document covers the **full vision** (what we're building toward) and the **Phase 1 scope** (what ships first). Phase 1 is the data foundation: event tracking, local aggregation, and PostHog dashboards. UI features (stats dashboard, activity calendar, Wrapped) are future phases that build on this foundation.

## Problem Statement

Bayaan has zero analytics, zero crash reporting, and no visibility into user behavior. We don't know:

- How many active users we have
- Which reciters/surahs are most popular
- Average listening session duration
- Where users drop off or churn
- What features are actually used
- What crashes are occurring in production
- How users engage with the mushaf, adhkar, or translations

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Analytics platform | PostHog (sole destination) | 1M events/mo free, JS-only SDK (Expo compatible), funnels/retention/cohorts included, offline queuing, feature flags built-in |
| Privacy model | Track everything, anonymous by default | All data is anonymous (device ID, no PII). Request platform permissions (ATT on iOS) as required. No in-app consent toggle. |
| User identity | Device UUID (MMKV) | Generated via `expo-crypto` on first launch. Designed for future auth — PostHog `identify()` merges anonymous history when accounts ship. |
| Listen threshold | Graduated | Raw `playback_started` always tracked. `meaningful_listen` fires at 30s or 10% of duration (whichever first). Stats/Wrapped use meaningful listens. |
| Mushaf tracking | Page-level + time heuristics | Track pages opened and estimate actual reading via time thresholds (~15s = actually read). No verse-level tracking. |
| Adhkar tracking | Category-level | Track morning/evening/sleep/custom session starts and completions. Not individual dhikr repetitions. |
| Wrapped cadence | Ramadan Wrapped (Eid) + Annual | Future feature. Event schema captures everything needed — purely a computation + UI layer later. |
| Stats dashboard | Dedicated tab, growing into deep insights hub | Future feature. Local aggregation layer built in Phase 1 so data is ready. |
| Activity calendar | GitHub-style grid | Distinct hues for listening/reading/both, intensity by duration. Future feature, data captured from day one. |
| Gamification | Consistency without punishment | Days-this-month counter, configurable daily goal. No streaks, no XP, no leaderboards. Respects worship context. |
| Backend role | Minimal — Wrapped computation only | PostHog handles all event storage and product analytics. Backend (`api.thebayaan.com`) only involved for future Wrapped batch computation via PostHog API/exports. |

## Full Vision (All Phases)

### 1. Event Tracking Infrastructure (Phase 1)
PostHog SDK integration, analytics service singleton, full event instrumentation across all app surfaces.

### 2. Local Aggregation Layer (Phase 1)
MMKV-based daily counters updated as events fire — listening time, pages read, adhkar sessions, khatmah progress. Data ready for UI before UI ships.

### 3. PostHog Dashboards (Phase 1)
Product analytics: DAU/WAU/MAU, retention, feature adoption, top reciters/surahs, surah completion rates, reciter trends.

### 4. Stats Dashboard (Future)
Dedicated tab with listening summary, reading summary, khatmah tracker, adhkar summary, daily goal, activity calendar.

### 5. Deep Insights Hub (Future)
Trends over time, time-of-day heat map (mapped to prayer times), reciter discovery stats, surah completion grid (all 114), personal milestones.

### 6. Bayaan Wrapped (Future)
Ramadan Wrapped (released on Eid al-Fitr) and Annual Wrapped. Shareable story-format cards. Listening personality archetypes. Percentile rankings.

---

## Phase 1 Scope: Data Foundation

### Architecture

```
+-----------------------------------------------------+
|                    App Layer                         |
|  ExpoAudioProvider | PlayerStore | MushafView | ...  |
+----------+------------------------------+-----------+
           | fires events                 | fires events
           v                              v
+-----------------------------------------------------+
|              AnalyticsService (singleton)            |
|  - Typed event methods                              |
|  - Attaches common properties                       |
|  - Dual-writes: PostHog + local aggregation         |
+----------+------------------------------+-----------+
           |                              |
           v                              v
+---------------------+    +--------------------------+
|   PostHog Cloud     |    |  Local Aggregation Store  |
|   (remote)          |    |  (MMKV)                   |
|                     |    |                            |
|  - Raw event store  |    |  - Daily listening mins    |
|  - Dashboards       |    |  - Daily pages read        |
|  - Funnels          |    |  - Adhkar sessions         |
|  - Retention        |    |  - Khatmah progress        |
|  - Feature flags    |    |  - Activity calendar data  |
+---------------------+    +---------------------------+
```

### Analytics Service

Singleton at `services/analytics/AnalyticsService.ts`. Wraps PostHog SDK and local aggregation. All event firing goes through this service — no direct PostHog calls from components or stores.

```typescript
interface AnalyticsService {
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Listening events
  trackPlaybackStarted(props: PlaybackStartedProps): void;
  trackPlaybackPaused(props: PlaybackPausedProps): void;
  trackPlaybackResumed(props: PlaybackResumedProps): void;
  trackPlaybackCompleted(props: PlaybackCompletedProps): void;
  trackPlaybackSkipped(props: PlaybackSkippedProps): void;
  trackPlaybackSeeked(props: PlaybackSeekedProps): void;
  trackMeaningfulListen(props: MeaningfulListenProps): void;
  trackRateChanged(props: RateChangedProps): void;
  trackQueueModified(props: QueueModifiedProps): void;

  // Mushaf events
  trackMushafPageOpened(props: MushafPageOpenedProps): void;
  trackMushafPageRead(props: MushafPageReadProps): void;
  trackMushafSessionEnded(props: MushafSessionEndedProps): void;

  // Adhkar events
  trackAdhkarSessionStarted(props: AdhkarSessionStartedProps): void;
  trackAdhkarSessionCompleted(props: AdhkarSessionCompletedProps): void;
  trackTasbeehCompleted(props: TasbeehCompletedProps): void;

  // Feature usage events
  trackReciterSelected(props: ReciterSelectedProps): void;
  trackRewayahChanged(props: RewayahChangedProps): void;
  trackDownloadStarted(props: DownloadStartedProps): void;
  trackDownloadCompleted(props: DownloadCompletedProps): void;
  trackAmbientToggled(props: AmbientToggledProps): void;
  trackFavoriteToggled(props: FavoriteToggledProps): void;
  trackPlaylistModified(props: PlaylistModifiedProps): void;
  trackShareCreated(props: ShareCreatedProps): void;
  trackSearchPerformed(props: SearchPerformedProps): void;
  trackTranslationViewed(props: TranslationViewedProps): void;

  // App lifecycle
  trackAppOpened(): void;
  trackAppBackgrounded(props: AppBackgroundedProps): void;

  // Identity (future auth support)
  identifyUser(userId: string): void;
}
```

### Event Schema

#### Listening Events

| Event | Trigger | Key Properties |
|-------|---------|----------------|
| `playback_started` | Play pressed or autoplay | `surah_id`, `reciter_id`, `rewayah_id`, `source` (queue/direct/autoplay/playlist), `position_ms` |
| `playback_paused` | User pauses | `surah_id`, `reciter_id`, `position_ms`, `listened_ms` |
| `playback_resumed` | User resumes | `surah_id`, `reciter_id`, `position_ms` |
| `playback_completed` | Surah finishes naturally | `surah_id`, `reciter_id`, `duration_ms`, `listened_ms`, `completion_pct` |
| `playback_skipped` | Skip next/prev | `surah_id`, `reciter_id`, `position_ms`, `listened_ms`, `direction` (next/prev) |
| `playback_seeked` | User seeks | `surah_id`, `from_ms`, `to_ms` |
| `meaningful_listen` | Crosses 30s or 10% threshold | `surah_id`, `reciter_id`, `rewayah_id` |
| `rate_changed` | Playback speed changed | `old_rate`, `new_rate` |
| `queue_modified` | Track added/removed/reordered | `action` (add/remove/reorder), `surah_id`, `queue_length` |

#### Mushaf Reading Events

| Event | Trigger | Key Properties |
|-------|---------|----------------|
| `mushaf_page_opened` | Page becomes visible | `page_number`, `surah_id`, `juz_number` |
| `mushaf_page_read` | Page visible > 15s | `page_number`, `duration_ms`, `surah_id` |
| `mushaf_session_ended` | Leave mushaf or app backgrounds | `pages_opened`, `pages_read`, `total_duration_ms` |

#### Adhkar Events

| Event | Trigger | Key Properties |
|-------|---------|----------------|
| `adhkar_session_started` | Open an adhkar category | `category` (morning/evening/sleep/custom) |
| `adhkar_session_completed` | Complete all dhikrs in category | `category`, `duration_ms`, `dhikr_count` |
| `tasbeeh_completed` | Finish a tasbeeh set | `category`, `count` |

#### Feature Usage Events

| Event | Trigger | Key Properties |
|-------|---------|----------------|
| `reciter_selected` | Reciter chosen | `reciter_id`, `reciter_name` |
| `rewayah_changed` | Rewayah switched | `rewayah_id`, `rewayah_name` |
| `download_started` | Download begins | `surah_id`, `reciter_id` |
| `download_completed` | Download finishes | `surah_id`, `reciter_id`, `file_size_bytes` |
| `ambient_toggled` | Ambient on/off | `sound_type`, `enabled` |
| `favorite_toggled` | Love/unlove | `surah_id`, `reciter_id`, `action` (add/remove) |
| `playlist_modified` | Playlist created/edited | `action` (create/add_track/remove_track), `track_count` |
| `share_created` | User shares content | `content_type` (verse/surah/mushaf), `surah_id` |
| `search_performed` | User searches | `query`, `results_count` |
| `translation_viewed` | Translation opened | `translation_id`, `language` |

#### App Lifecycle Events

| Event | Trigger | Key Properties |
|-------|---------|----------------|
| `$screen` | Navigation | Auto-captured by PostHog |
| `app_opened` | App foregrounds | (auto properties: device, version, OS) |
| `app_backgrounded` | App backgrounds | `session_duration_ms`, `total_listen_ms` |

### Local Aggregation Store

MMKV-based store at `services/analytics/LocalAggregationStore.ts`. Updated synchronously as events fire. Structured as daily buckets for efficient calendar rendering and stats queries.

```typescript
// MMKV key: `analytics:daily:{YYYY-MM-DD}`
interface DailyAggregate {
  date: string;                    // "2026-04-12"
  listeningMs: number;             // total ms listened
  meaningfulListens: number;       // count of meaningful listens
  pagesOpened: number;             // mushaf pages opened
  pagesRead: number;               // mushaf pages actually read (>15s)
  adhkarSessions: number;          // adhkar category sessions completed
  tasbeehCount: number;            // total tasbeeh taps
  surahs: Record<string, number>;  // surah_id -> listened_ms
  reciters: Record<string, number>; // reciter_id -> listened_ms
}

// MMKV key: `analytics:khatmah:current`
interface KhatmahProgress {
  id: string;
  startedAt: string;
  surahsCompleted: string[];       // surah IDs with meaningful_listen
  completedAt?: string;
}

// MMKV key: `analytics:goal`
interface ListeningGoal {
  dailyMinutes: number;            // default 10
}
```

### Integration Points

Files to create:
- `services/analytics/AnalyticsService.ts` — singleton wrapping PostHog + local aggregation
- `services/analytics/events.ts` — event name constants and property type definitions
- `services/analytics/LocalAggregationStore.ts` — MMKV daily aggregates
- `services/analytics/MeaningfulListenTracker.ts` — tracks 30s/10% threshold per active playback

Files to modify:
- `services/audio/ExpoAudioProvider.tsx` — fire playback events (started, paused, completed, progress for meaningful listen detection)
- `services/player/store/playerStore.ts` — fire queue, rate, skip events
- `services/AppInitializer.ts` — register analytics service initialization
- `app/_layout.tsx` — wrap with PostHog provider, initialize on startup
- `store/ambientStore.ts` — fire ambient toggle events
- `store/lovedStore.ts` — fire favorite toggle events
- `store/downloadStore.ts` — fire download events
- Mushaf screen components — fire page opened/read events
- Adhkar screen components — fire session/tasbeeh events
- Search components — fire search events
- Share flow — fire share events

### PostHog Dashboard Configuration

**Product dashboards to set up:**
- **Overview:** DAU/WAU/MAU, sessions per day, avg session duration
- **Retention:** Day 1/7/30 retention cohorts
- **Listening:** Top reciters by listen time, top surahs by play count, surah completion rate, avg listen duration
- **Feature adoption:** % users using mushaf, ambient, downloads, playlists, translations, adhkar
- **Funnels:** App open → play → meaningful listen → complete surah

### Crash Reporting

Sentry integration alongside PostHog:
- JS exceptions, native crashes, ANRs
- Breadcrumbs correlated with analytics events
- Performance monitoring (slow screens)
- Free tier: 5K errors/mo, 10K transactions/mo

---

## Future Phases (Not In Scope for Phase 1)

### Stats Dashboard
Dedicated tab with: listening summary, reading summary, khatmah tracker, adhkar summary, daily goal progress ring, GitHub-style activity calendar (distinct hues for listening/reading/both). All powered by local aggregation data from Phase 1.

### Deep Insights Hub
Extension of stats dashboard: trends over time (listening up/down vs last month), time-of-day heat map mapped to prayer times, reciter discovery stats, surah completion grid (all 114 surahs), personal milestones.

### Bayaan Wrapped
Ramadan Wrapped (released Eid al-Fitr) + Annual Wrapped. Story-format shareable cards. Listening personality archetypes (The Devoted, The Explorer, The Consistent, The Night Listener, The Ramadan Warrior, The Scholar, The Mushaf Companion). Percentile rankings. Backend computation via PostHog API/data export.

### Optional Auth
Apple/Google sign-in to preserve data across devices and reinstalls. PostHog `identify()` merges anonymous device history into authenticated profile. No schema changes needed — device ID → user ID resolution is built into PostHog.
