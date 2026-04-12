# Analytics Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instrument every user interaction in Bayaan with PostHog analytics and local MMKV aggregation, establishing the data foundation for future stats dashboard, activity calendar, and Wrapped features.

**Architecture:** PostHog Cloud as sole analytics destination via `posthog-react-native` SDK. AnalyticsService singleton dual-writes events to PostHog (remote) and LocalAggregationStore (MMKV). Sentry for crash reporting. Device UUID for anonymous identity.

**Tech Stack:** posthog-react-native, @sentry/react-native, react-native-mmkv (existing), expo-crypto, jest-expo

**Spec:** `docs/features/analytics.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `services/analytics/events.ts` | Event name constants and property type definitions |
| `services/analytics/AnalyticsService.ts` | Singleton wrapping PostHog + local aggregation |
| `services/analytics/LocalAggregationStore.ts` | MMKV daily aggregation buckets |
| `services/analytics/MeaningfulListenTracker.ts` | 30s/10% threshold detection per playback session |
| `services/analytics/deviceId.ts` | Stable device UUID generation and persistence |
| `services/analytics/__tests__/LocalAggregationStore.test.ts` | Tests for local aggregation logic |
| `services/analytics/__tests__/MeaningfulListenTracker.test.ts` | Tests for meaningful listen threshold |
| `services/analytics/__tests__/AnalyticsService.test.ts` | Tests for analytics service |

### Modified Files

| File | Change |
|------|--------|
| `services/AppInitializer.ts` | Register AnalyticsService at priority 0 |
| `app/_layout.tsx` | Add PostHogProvider wrapper |
| `services/audio/ExpoAudioProvider.tsx` | Fire playback started/paused/completed/resumed events |
| `services/player/store/playerStore.ts` | Fire skip, seek, rate, queue events |
| `store/ambientStore.ts` | Fire ambient toggle events |
| `services/player/store/lovedStore.ts` | Fire favorite toggle events |
| `services/player/store/downloadStore.ts` | Fire download started/completed events |
| `utils/shareUtils.ts` | Fire share events |
| `package.json` | Add posthog-react-native, @sentry/react-native, expo-crypto deps |
| `app.json` or `app.config.ts` | Add Sentry config plugin |

---

## Task 1: Install Dependencies and Configure PostHog

**Files:**
- Modify: `package.json`
- Create: `services/analytics/deviceId.ts`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Install PostHog, Sentry, and expo-crypto**

```bash
npx expo install posthog-react-native @sentry/react-native expo-crypto
```

- [ ] **Step 2: Create the device ID module**

Create `services/analytics/deviceId.ts`:

```typescript
import * as Crypto from 'expo-crypto';
import {MMKV} from 'react-native-mmkv';

const mmkv = new MMKV({id: 'analytics'});
const DEVICE_ID_KEY = 'device_id';

export function getOrCreateDeviceId(): string {
  const existing = mmkv.getString(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const id = Crypto.randomUUID();
  mmkv.set(DEVICE_ID_KEY, id);
  return id;
}
```

- [ ] **Step 3: Verify MMKV import pattern matches codebase**

The codebase uses `createMMKV` in some files and `new MMKV` in others. Check which is available:

```bash
grep -rn "from 'react-native-mmkv'" services/ store/ --include="*.ts" --include="*.tsx" | head -5
```

Adjust the import to match (the codebase uses `createMMKV` from `react-native-mmkv`). Update `deviceId.ts` if needed:

```typescript
import {createMMKV} from 'react-native-mmkv';

const mmkv = createMMKV({id: 'analytics'});
```

- [ ] **Step 4: Add PostHogProvider to app layout**

Read `app/_layout.tsx` and find the provider nesting around line 384-429. Add `PostHogProvider` wrapping the outermost content provider. The PostHog API key will come from an environment variable.

In `app/_layout.tsx`, add the import:

```typescript
import {PostHogProvider} from 'posthog-react-native';
import {getOrCreateDeviceId} from '@/services/analytics/deviceId';
```

Wrap the existing providers with PostHogProvider. The exact insertion point depends on the current nesting, but it should be inside `ThemeProvider` and outside `ExpoAudioProvider`:

```tsx
<PostHogProvider
  apiKey={process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? ''}
  options={{
    host: 'https://us.i.posthog.com',
    enableSessionReplay: false,
    flushAt: 20,
    flushInterval: 30000,
  }}
  autocapture={{
    captureScreens: true,
    captureLifecycleEvents: true,
  }}
>
  {/* existing providers */}
</PostHogProvider>
```

- [ ] **Step 5: Add PostHog env var to `.env.example` or `eas.json`**

Add `EXPO_PUBLIC_POSTHOG_API_KEY` to environment configuration. You'll need to create a PostHog project and get the API key.

- [ ] **Step 6: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add services/analytics/deviceId.ts app/_layout.tsx package.json package-lock.json
git commit -m "feat(analytics): install PostHog SDK and add device ID generation"
```

---

## Task 2: Define Event Schema Types

**Files:**
- Create: `services/analytics/events.ts`

- [ ] **Step 1: Create event name constants and property types**

Create `services/analytics/events.ts`:

```typescript
// ============================================================================
// Event Names
// ============================================================================

export const ANALYTICS_EVENTS = {
  // Listening
  PLAYBACK_STARTED: 'playback_started',
  PLAYBACK_PAUSED: 'playback_paused',
  PLAYBACK_RESUMED: 'playback_resumed',
  PLAYBACK_COMPLETED: 'playback_completed',
  PLAYBACK_SKIPPED: 'playback_skipped',
  PLAYBACK_SEEKED: 'playback_seeked',
  MEANINGFUL_LISTEN: 'meaningful_listen',
  RATE_CHANGED: 'rate_changed',
  QUEUE_MODIFIED: 'queue_modified',

  // Mushaf
  MUSHAF_PAGE_OPENED: 'mushaf_page_opened',
  MUSHAF_PAGE_READ: 'mushaf_page_read',
  MUSHAF_SESSION_ENDED: 'mushaf_session_ended',

  // Adhkar
  ADHKAR_SESSION_STARTED: 'adhkar_session_started',
  ADHKAR_SESSION_COMPLETED: 'adhkar_session_completed',
  TASBEEH_COMPLETED: 'tasbeeh_completed',

  // Feature usage
  RECITER_SELECTED: 'reciter_selected',
  REWAYAH_CHANGED: 'rewayah_changed',
  DOWNLOAD_STARTED: 'download_started',
  DOWNLOAD_COMPLETED: 'download_completed',
  AMBIENT_TOGGLED: 'ambient_toggled',
  FAVORITE_TOGGLED: 'favorite_toggled',
  PLAYLIST_MODIFIED: 'playlist_modified',
  SHARE_CREATED: 'share_created',
  SEARCH_PERFORMED: 'search_performed',
  TRANSLATION_VIEWED: 'translation_viewed',

  // Lifecycle
  APP_OPENED: 'app_opened',
  APP_BACKGROUNDED: 'app_backgrounded',
} as const;

// ============================================================================
// Event Property Types
// ============================================================================

export interface PlaybackStartedProps {
  surah_id: number;
  reciter_id: string;
  rewayah_id: string;
  source: 'queue' | 'direct' | 'autoplay' | 'playlist';
  position_ms: number;
}

export interface PlaybackPausedProps {
  surah_id: number;
  reciter_id: string;
  position_ms: number;
  listened_ms: number;
}

export interface PlaybackResumedProps {
  surah_id: number;
  reciter_id: string;
  position_ms: number;
}

export interface PlaybackCompletedProps {
  surah_id: number;
  reciter_id: string;
  duration_ms: number;
  listened_ms: number;
  completion_pct: number;
}

export interface PlaybackSkippedProps {
  surah_id: number;
  reciter_id: string;
  position_ms: number;
  listened_ms: number;
  direction: 'next' | 'prev';
}

export interface PlaybackSeekedProps {
  surah_id: number;
  from_ms: number;
  to_ms: number;
}

export interface MeaningfulListenProps {
  surah_id: number;
  reciter_id: string;
  rewayah_id: string;
}

export interface RateChangedProps {
  old_rate: number;
  new_rate: number;
}

export interface QueueModifiedProps {
  action: 'add' | 'remove' | 'reorder';
  surah_id: number;
  queue_length: number;
}

export interface MushafPageOpenedProps {
  page_number: number;
  surah_id: number;
  juz_number: number;
}

export interface MushafPageReadProps {
  page_number: number;
  duration_ms: number;
  surah_id: number;
}

export interface MushafSessionEndedProps {
  pages_opened: number;
  pages_read: number;
  total_duration_ms: number;
}

export interface AdhkarSessionStartedProps {
  category: string;
}

export interface AdhkarSessionCompletedProps {
  category: string;
  duration_ms: number;
  dhikr_count: number;
}

export interface TasbeehCompletedProps {
  category: string;
  count: number;
}

export interface ReciterSelectedProps {
  reciter_id: string;
  reciter_name: string;
}

export interface RewayahChangedProps {
  rewayah_id: string;
  rewayah_name: string;
}

export interface DownloadStartedProps {
  surah_id: number;
  reciter_id: string;
}

export interface DownloadCompletedProps {
  surah_id: number;
  reciter_id: string;
  file_size_bytes: number;
}

export interface AmbientToggledProps {
  sound_type: string;
  enabled: boolean;
}

export interface FavoriteToggledProps {
  surah_id: number;
  reciter_id: string;
  action: 'add' | 'remove';
}

export interface PlaylistModifiedProps {
  action: 'create' | 'add_track' | 'remove_track';
  track_count: number;
}

export interface ShareCreatedProps {
  content_type: 'verse' | 'surah' | 'mushaf' | 'reciter' | 'adhkar';
  surah_id?: number;
}

export interface SearchPerformedProps {
  query: string;
  results_count: number;
}

export interface TranslationViewedProps {
  translation_id: string;
  language: string;
}

export interface AppBackgroundedProps {
  session_duration_ms: number;
  total_listen_ms: number;
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Format and commit**

```bash
npx prettier --write services/analytics/events.ts
git add services/analytics/events.ts
git commit -m "feat(analytics): define event schema types and constants"
```

---

## Task 3: Build Local Aggregation Store

**Files:**
- Create: `services/analytics/LocalAggregationStore.ts`
- Create: `services/analytics/__tests__/LocalAggregationStore.test.ts`

- [ ] **Step 1: Write tests for local aggregation**

Create `services/analytics/__tests__/LocalAggregationStore.test.ts`:

```typescript
import {LocalAggregationStore} from '../LocalAggregationStore';

// Mock MMKV
const mockStorage = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string) => mockStorage.set(key, value),
    delete: (key: string) => mockStorage.delete(key),
    getAllKeys: () => Array.from(mockStorage.keys()),
  }),
}));

describe('LocalAggregationStore', () => {
  let store: LocalAggregationStore;

  beforeEach(() => {
    mockStorage.clear();
    store = new LocalAggregationStore();
  });

  describe('addListeningTime', () => {
    it('creates a new daily aggregate if none exists', () => {
      store.addListeningTime('2026-04-12', 60000, '1', 'reciter-1');
      const agg = store.getDailyAggregate('2026-04-12');
      expect(agg.listeningMs).toBe(60000);
      expect(agg.surahs['1']).toBe(60000);
      expect(agg.reciters['reciter-1']).toBe(60000);
    });

    it('accumulates listening time on the same day', () => {
      store.addListeningTime('2026-04-12', 30000, '1', 'reciter-1');
      store.addListeningTime('2026-04-12', 45000, '2', 'reciter-1');
      const agg = store.getDailyAggregate('2026-04-12');
      expect(agg.listeningMs).toBe(75000);
      expect(agg.surahs['1']).toBe(30000);
      expect(agg.surahs['2']).toBe(45000);
      expect(agg.reciters['reciter-1']).toBe(75000);
    });
  });

  describe('incrementMeaningfulListens', () => {
    it('increments the meaningful listen counter', () => {
      store.incrementMeaningfulListens('2026-04-12');
      store.incrementMeaningfulListens('2026-04-12');
      const agg = store.getDailyAggregate('2026-04-12');
      expect(agg.meaningfulListens).toBe(2);
    });
  });

  describe('addPagesOpened and addPagesRead', () => {
    it('tracks mushaf page opens and reads separately', () => {
      store.addPagesOpened('2026-04-12', 5);
      store.addPagesRead('2026-04-12', 3);
      const agg = store.getDailyAggregate('2026-04-12');
      expect(agg.pagesOpened).toBe(5);
      expect(agg.pagesRead).toBe(3);
    });
  });

  describe('incrementAdhkarSessions', () => {
    it('increments adhkar session count', () => {
      store.incrementAdhkarSessions('2026-04-12');
      const agg = store.getDailyAggregate('2026-04-12');
      expect(agg.adhkarSessions).toBe(1);
    });
  });

  describe('addTasbeehCount', () => {
    it('accumulates tasbeeh count', () => {
      store.addTasbeehCount('2026-04-12', 33);
      store.addTasbeehCount('2026-04-12', 33);
      const agg = store.getDailyAggregate('2026-04-12');
      expect(agg.tasbeehCount).toBe(66);
    });
  });

  describe('getToday', () => {
    it('returns today formatted as YYYY-MM-DD', () => {
      const today = store.getToday();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('khatmah', () => {
    it('marks a surah as completed', () => {
      store.markSurahCompleted('42');
      const progress = store.getKhatmahProgress();
      expect(progress.surahsCompleted).toContain('42');
    });

    it('does not duplicate surah entries', () => {
      store.markSurahCompleted('42');
      store.markSurahCompleted('42');
      const progress = store.getKhatmahProgress();
      expect(progress.surahsCompleted.filter(s => s === '42')).toHaveLength(1);
    });
  });

  describe('listening goal', () => {
    it('defaults to 10 minutes', () => {
      expect(store.getListeningGoal()).toBe(10);
    });

    it('persists a custom goal', () => {
      store.setListeningGoal(20);
      expect(store.getListeningGoal()).toBe(20);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest services/analytics/__tests__/LocalAggregationStore.test.ts --no-cache
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement LocalAggregationStore**

Create `services/analytics/LocalAggregationStore.ts`:

```typescript
import {createMMKV} from 'react-native-mmkv';

const DAILY_PREFIX = 'analytics:daily:';
const KHATMAH_KEY = 'analytics:khatmah:current';
const GOAL_KEY = 'analytics:goal';

export interface DailyAggregate {
  date: string;
  listeningMs: number;
  meaningfulListens: number;
  pagesOpened: number;
  pagesRead: number;
  adhkarSessions: number;
  tasbeehCount: number;
  surahs: Record<string, number>;
  reciters: Record<string, number>;
}

export interface KhatmahProgress {
  id: string;
  startedAt: string;
  surahsCompleted: string[];
  completedAt?: string;
}

function emptyAggregate(date: string): DailyAggregate {
  return {
    date,
    listeningMs: 0,
    meaningfulListens: 0,
    pagesOpened: 0,
    pagesRead: 0,
    adhkarSessions: 0,
    tasbeehCount: 0,
    surahs: {},
    reciters: {},
  };
}

export class LocalAggregationStore {
  private mmkv;

  constructor() {
    this.mmkv = createMMKV({id: 'analytics-aggregation'});
  }

  getToday(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  getDailyAggregate(date: string): DailyAggregate {
    const raw = this.mmkv.getString(`${DAILY_PREFIX}${date}`);
    if (!raw) return emptyAggregate(date);
    return JSON.parse(raw) as DailyAggregate;
  }

  private saveDailyAggregate(agg: DailyAggregate): void {
    this.mmkv.set(`${DAILY_PREFIX}${agg.date}`, JSON.stringify(agg));
  }

  addListeningTime(
    date: string,
    ms: number,
    surahId: string,
    reciterId: string,
  ): void {
    const agg = this.getDailyAggregate(date);
    agg.listeningMs += ms;
    agg.surahs[surahId] = (agg.surahs[surahId] ?? 0) + ms;
    agg.reciters[reciterId] = (agg.reciters[reciterId] ?? 0) + ms;
    this.saveDailyAggregate(agg);
  }

  incrementMeaningfulListens(date: string): void {
    const agg = this.getDailyAggregate(date);
    agg.meaningfulListens += 1;
    this.saveDailyAggregate(agg);
  }

  addPagesOpened(date: string, count: number): void {
    const agg = this.getDailyAggregate(date);
    agg.pagesOpened += count;
    this.saveDailyAggregate(agg);
  }

  addPagesRead(date: string, count: number): void {
    const agg = this.getDailyAggregate(date);
    agg.pagesRead += count;
    this.saveDailyAggregate(agg);
  }

  incrementAdhkarSessions(date: string): void {
    const agg = this.getDailyAggregate(date);
    agg.adhkarSessions += 1;
    this.saveDailyAggregate(agg);
  }

  addTasbeehCount(date: string, count: number): void {
    const agg = this.getDailyAggregate(date);
    agg.tasbeehCount += count;
    this.saveDailyAggregate(agg);
  }

  // --- Khatmah ---

  getKhatmahProgress(): KhatmahProgress {
    const raw = this.mmkv.getString(KHATMAH_KEY);
    if (!raw) {
      const fresh: KhatmahProgress = {
        id: Date.now().toString(),
        startedAt: new Date().toISOString(),
        surahsCompleted: [],
      };
      this.mmkv.set(KHATMAH_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return JSON.parse(raw) as KhatmahProgress;
  }

  markSurahCompleted(surahId: string): void {
    const progress = this.getKhatmahProgress();
    if (!progress.surahsCompleted.includes(surahId)) {
      progress.surahsCompleted.push(surahId);
      if (progress.surahsCompleted.length === 114) {
        progress.completedAt = new Date().toISOString();
      }
      this.mmkv.set(KHATMAH_KEY, JSON.stringify(progress));
    }
  }

  startNewKhatmah(): void {
    const fresh: KhatmahProgress = {
      id: Date.now().toString(),
      startedAt: new Date().toISOString(),
      surahsCompleted: [],
    };
    this.mmkv.set(KHATMAH_KEY, JSON.stringify(fresh));
  }

  // --- Listening Goal ---

  getListeningGoal(): number {
    const raw = this.mmkv.getString(GOAL_KEY);
    if (!raw) return 10;
    return JSON.parse(raw) as number;
  }

  setListeningGoal(minutes: number): void {
    this.mmkv.set(GOAL_KEY, JSON.stringify(minutes));
  }
}

export const localAggregationStore = new LocalAggregationStore();
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest services/analytics/__tests__/LocalAggregationStore.test.ts --no-cache
```

Expected: All tests PASS.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write services/analytics/LocalAggregationStore.ts services/analytics/__tests__/LocalAggregationStore.test.ts
git add services/analytics/LocalAggregationStore.ts services/analytics/__tests__/LocalAggregationStore.test.ts
git commit -m "feat(analytics): local aggregation store with MMKV daily buckets"
```

---

## Task 4: Build Meaningful Listen Tracker

**Files:**
- Create: `services/analytics/MeaningfulListenTracker.ts`
- Create: `services/analytics/__tests__/MeaningfulListenTracker.test.ts`

- [ ] **Step 1: Write tests**

Create `services/analytics/__tests__/MeaningfulListenTracker.test.ts`:

```typescript
import {MeaningfulListenTracker} from '../MeaningfulListenTracker';

describe('MeaningfulListenTracker', () => {
  let tracker: MeaningfulListenTracker;
  let onMeaningfulListen: jest.Mock;

  beforeEach(() => {
    onMeaningfulListen = jest.fn();
    tracker = new MeaningfulListenTracker(onMeaningfulListen);
  });

  describe('startTracking', () => {
    it('resets state for a new track', () => {
      tracker.startTracking({
        surahId: 1,
        reciterId: 'r1',
        rewayahId: 'rw1',
        totalDurationMs: 300000, // 5 min
      });
      expect(onMeaningfulListen).not.toHaveBeenCalled();
    });
  });

  describe('updateProgress', () => {
    it('fires at 30 seconds for a long track', () => {
      tracker.startTracking({
        surahId: 2,
        reciterId: 'r1',
        rewayahId: 'rw1',
        totalDurationMs: 600000, // 10 min
      });
      tracker.updateProgress(29000);
      expect(onMeaningfulListen).not.toHaveBeenCalled();
      tracker.updateProgress(31000);
      expect(onMeaningfulListen).toHaveBeenCalledWith({
        surah_id: 2,
        reciter_id: 'r1',
        rewayah_id: 'rw1',
      });
    });

    it('fires at 10% for a short track (< 5 min)', () => {
      tracker.startTracking({
        surahId: 1,
        reciterId: 'r1',
        rewayahId: 'rw1',
        totalDurationMs: 40000, // 40 sec — 10% = 4 sec
      });
      tracker.updateProgress(3000);
      expect(onMeaningfulListen).not.toHaveBeenCalled();
      tracker.updateProgress(5000);
      expect(onMeaningfulListen).toHaveBeenCalledTimes(1);
    });

    it('only fires once per track', () => {
      tracker.startTracking({
        surahId: 1,
        reciterId: 'r1',
        rewayahId: 'rw1',
        totalDurationMs: 300000,
      });
      tracker.updateProgress(31000);
      tracker.updateProgress(60000);
      tracker.updateProgress(120000);
      expect(onMeaningfulListen).toHaveBeenCalledTimes(1);
    });

    it('does nothing if no track is being tracked', () => {
      tracker.updateProgress(60000);
      expect(onMeaningfulListen).not.toHaveBeenCalled();
    });
  });

  describe('stopTracking', () => {
    it('prevents future fires', () => {
      tracker.startTracking({
        surahId: 1,
        reciterId: 'r1',
        rewayahId: 'rw1',
        totalDurationMs: 300000,
      });
      tracker.stopTracking();
      tracker.updateProgress(60000);
      expect(onMeaningfulListen).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest services/analytics/__tests__/MeaningfulListenTracker.test.ts --no-cache
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement MeaningfulListenTracker**

Create `services/analytics/MeaningfulListenTracker.ts`:

```typescript
import type {MeaningfulListenProps} from './events';

interface TrackInfo {
  surahId: number;
  reciterId: string;
  rewayahId: string;
  totalDurationMs: number;
}

const ABSOLUTE_THRESHOLD_MS = 30000; // 30 seconds
const RELATIVE_THRESHOLD_PCT = 0.1; // 10%

export class MeaningfulListenTracker {
  private currentTrack: TrackInfo | null = null;
  private hasFired = false;
  private thresholdMs = 0;
  private onMeaningfulListen: (props: MeaningfulListenProps) => void;

  constructor(onMeaningfulListen: (props: MeaningfulListenProps) => void) {
    this.onMeaningfulListen = onMeaningfulListen;
  }

  startTracking(track: TrackInfo): void {
    this.currentTrack = track;
    this.hasFired = false;
    const relativeThreshold = track.totalDurationMs * RELATIVE_THRESHOLD_PCT;
    this.thresholdMs = Math.min(ABSOLUTE_THRESHOLD_MS, relativeThreshold);
  }

  updateProgress(positionMs: number): void {
    if (!this.currentTrack || this.hasFired) return;
    if (positionMs >= this.thresholdMs) {
      this.hasFired = true;
      this.onMeaningfulListen({
        surah_id: this.currentTrack.surahId,
        reciter_id: this.currentTrack.reciterId,
        rewayah_id: this.currentTrack.rewayahId,
      });
    }
  }

  stopTracking(): void {
    this.currentTrack = null;
    this.hasFired = false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest services/analytics/__tests__/MeaningfulListenTracker.test.ts --no-cache
```

Expected: All tests PASS.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write services/analytics/MeaningfulListenTracker.ts services/analytics/__tests__/MeaningfulListenTracker.test.ts
git add services/analytics/MeaningfulListenTracker.ts services/analytics/__tests__/MeaningfulListenTracker.test.ts
git commit -m "feat(analytics): meaningful listen tracker with 30s/10% threshold"
```

---

## Task 5: Build AnalyticsService Singleton

**Files:**
- Create: `services/analytics/AnalyticsService.ts`
- Modify: `services/AppInitializer.ts`

- [ ] **Step 1: Create AnalyticsService**

Create `services/analytics/AnalyticsService.ts`:

```typescript
import PostHog from 'posthog-react-native';
import {getOrCreateDeviceId} from './deviceId';
import {
  ANALYTICS_EVENTS,
  type PlaybackStartedProps,
  type PlaybackPausedProps,
  type PlaybackResumedProps,
  type PlaybackCompletedProps,
  type PlaybackSkippedProps,
  type PlaybackSeekedProps,
  type MeaningfulListenProps,
  type RateChangedProps,
  type QueueModifiedProps,
  type MushafPageOpenedProps,
  type MushafPageReadProps,
  type MushafSessionEndedProps,
  type AdhkarSessionStartedProps,
  type AdhkarSessionCompletedProps,
  type TasbeehCompletedProps,
  type ReciterSelectedProps,
  type RewayahChangedProps,
  type DownloadStartedProps,
  type DownloadCompletedProps,
  type AmbientToggledProps,
  type FavoriteToggledProps,
  type PlaylistModifiedProps,
  type ShareCreatedProps,
  type SearchPerformedProps,
  type TranslationViewedProps,
  type AppBackgroundedProps,
} from './events';
import {localAggregationStore} from './LocalAggregationStore';
import {MeaningfulListenTracker} from './MeaningfulListenTracker';

class AnalyticsServiceImpl {
  private posthog: PostHog | null = null;
  private deviceId: string = '';
  private meaningfulListenTracker: MeaningfulListenTracker;
  private sessionStartTime: number = Date.now();
  private sessionListenMs: number = 0;

  constructor() {
    this.meaningfulListenTracker = new MeaningfulListenTracker(
      (props: MeaningfulListenProps) => {
        this.trackMeaningfulListen(props);
      },
    );
  }

  async initialize(): Promise<void> {
    this.deviceId = getOrCreateDeviceId();
    this.sessionStartTime = Date.now();
    this.sessionListenMs = 0;
    console.log(
      '[Analytics] Initialized with device ID:',
      this.deviceId.slice(0, 8) + '...',
    );
  }

  setPostHogInstance(instance: PostHog): void {
    this.posthog = instance;
    this.posthog.identify(this.deviceId);
  }

  private capture(event: string, properties: Record<string, unknown>): void {
    this.posthog?.capture(event, properties);
  }

  // --- Listening Events ---

  trackPlaybackStarted(props: PlaybackStartedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_STARTED, {...props});
    this.meaningfulListenTracker.startTracking({
      surahId: props.surah_id,
      reciterId: props.reciter_id,
      rewayahId: props.rewayah_id,
      totalDurationMs: 0, // updated by first progress event
    });
  }

  trackPlaybackPaused(props: PlaybackPausedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_PAUSED, {...props});
    this.sessionListenMs += props.listened_ms;
    const today = localAggregationStore.getToday();
    localAggregationStore.addListeningTime(
      today,
      props.listened_ms,
      String(props.surah_id),
      props.reciter_id,
    );
  }

  trackPlaybackResumed(props: PlaybackResumedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_RESUMED, {...props});
  }

  trackPlaybackCompleted(props: PlaybackCompletedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_COMPLETED, {...props});
    this.sessionListenMs += props.listened_ms;
    this.meaningfulListenTracker.stopTracking();
    const today = localAggregationStore.getToday();
    localAggregationStore.addListeningTime(
      today,
      props.listened_ms,
      String(props.surah_id),
      props.reciter_id,
    );
  }

  trackPlaybackSkipped(props: PlaybackSkippedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_SKIPPED, {...props});
    this.sessionListenMs += props.listened_ms;
    this.meaningfulListenTracker.stopTracking();
    const today = localAggregationStore.getToday();
    localAggregationStore.addListeningTime(
      today,
      props.listened_ms,
      String(props.surah_id),
      props.reciter_id,
    );
  }

  trackPlaybackSeeked(props: PlaybackSeekedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYBACK_SEEKED, {...props});
  }

  trackMeaningfulListen(props: MeaningfulListenProps): void {
    this.capture(ANALYTICS_EVENTS.MEANINGFUL_LISTEN, {...props});
    const today = localAggregationStore.getToday();
    localAggregationStore.incrementMeaningfulListens(today);
    localAggregationStore.markSurahCompleted(String(props.surah_id));
  }

  trackRateChanged(props: RateChangedProps): void {
    this.capture(ANALYTICS_EVENTS.RATE_CHANGED, {...props});
  }

  trackQueueModified(props: QueueModifiedProps): void {
    this.capture(ANALYTICS_EVENTS.QUEUE_MODIFIED, {...props});
  }

  updatePlaybackProgress(positionMs: number, totalDurationMs: number): void {
    this.meaningfulListenTracker.updateProgress(positionMs);
  }

  setTrackDuration(totalDurationMs: number, surahId: number, reciterId: string, rewayahId: string): void {
    this.meaningfulListenTracker.startTracking({
      surahId,
      reciterId,
      rewayahId,
      totalDurationMs,
    });
  }

  // --- Mushaf Events ---

  trackMushafPageOpened(props: MushafPageOpenedProps): void {
    this.capture(ANALYTICS_EVENTS.MUSHAF_PAGE_OPENED, {...props});
  }

  trackMushafPageRead(props: MushafPageReadProps): void {
    this.capture(ANALYTICS_EVENTS.MUSHAF_PAGE_READ, {...props});
    const today = localAggregationStore.getToday();
    localAggregationStore.addPagesRead(today, 1);
  }

  trackMushafSessionEnded(props: MushafSessionEndedProps): void {
    this.capture(ANALYTICS_EVENTS.MUSHAF_SESSION_ENDED, {...props});
    const today = localAggregationStore.getToday();
    localAggregationStore.addPagesOpened(today, props.pages_opened);
  }

  // --- Adhkar Events ---

  trackAdhkarSessionStarted(props: AdhkarSessionStartedProps): void {
    this.capture(ANALYTICS_EVENTS.ADHKAR_SESSION_STARTED, {...props});
  }

  trackAdhkarSessionCompleted(props: AdhkarSessionCompletedProps): void {
    this.capture(ANALYTICS_EVENTS.ADHKAR_SESSION_COMPLETED, {...props});
    const today = localAggregationStore.getToday();
    localAggregationStore.incrementAdhkarSessions(today);
  }

  trackTasbeehCompleted(props: TasbeehCompletedProps): void {
    this.capture(ANALYTICS_EVENTS.TASBEEH_COMPLETED, {...props});
    const today = localAggregationStore.getToday();
    localAggregationStore.addTasbeehCount(today, props.count);
  }

  // --- Feature Usage Events ---

  trackReciterSelected(props: ReciterSelectedProps): void {
    this.capture(ANALYTICS_EVENTS.RECITER_SELECTED, {...props});
  }

  trackRewayahChanged(props: RewayahChangedProps): void {
    this.capture(ANALYTICS_EVENTS.REWAYAH_CHANGED, {...props});
  }

  trackDownloadStarted(props: DownloadStartedProps): void {
    this.capture(ANALYTICS_EVENTS.DOWNLOAD_STARTED, {...props});
  }

  trackDownloadCompleted(props: DownloadCompletedProps): void {
    this.capture(ANALYTICS_EVENTS.DOWNLOAD_COMPLETED, {...props});
  }

  trackAmbientToggled(props: AmbientToggledProps): void {
    this.capture(ANALYTICS_EVENTS.AMBIENT_TOGGLED, {...props});
  }

  trackFavoriteToggled(props: FavoriteToggledProps): void {
    this.capture(ANALYTICS_EVENTS.FAVORITE_TOGGLED, {...props});
  }

  trackPlaylistModified(props: PlaylistModifiedProps): void {
    this.capture(ANALYTICS_EVENTS.PLAYLIST_MODIFIED, {...props});
  }

  trackShareCreated(props: ShareCreatedProps): void {
    this.capture(ANALYTICS_EVENTS.SHARE_CREATED, {...props});
  }

  trackSearchPerformed(props: SearchPerformedProps): void {
    this.capture(ANALYTICS_EVENTS.SEARCH_PERFORMED, {...props});
  }

  trackTranslationViewed(props: TranslationViewedProps): void {
    this.capture(ANALYTICS_EVENTS.TRANSLATION_VIEWED, {...props});
  }

  // --- Lifecycle ---

  trackAppOpened(): void {
    this.sessionStartTime = Date.now();
    this.sessionListenMs = 0;
    this.capture(ANALYTICS_EVENTS.APP_OPENED, {});
  }

  trackAppBackgrounded(): void {
    const props: AppBackgroundedProps = {
      session_duration_ms: Date.now() - this.sessionStartTime,
      total_listen_ms: this.sessionListenMs,
    };
    this.capture(ANALYTICS_EVENTS.APP_BACKGROUNDED, {...props});
  }

  // --- Identity (future auth) ---

  identifyUser(userId: string): void {
    this.posthog?.identify(userId, {device_id: this.deviceId});
  }
}

export const analyticsService = new AnalyticsServiceImpl();
```

- [ ] **Step 2: Register in AppInitializer**

In `services/AppInitializer.ts`, add the import at the top:

```typescript
import {analyticsService} from '@/services/analytics/AnalyticsService';
```

Then add the registration after the Database service (around line 207), at priority 0 (before everything else, non-critical):

```typescript
/**
 * Analytics Service (Priority 0)
 * Initializes device ID and analytics. Non-critical — app works without it.
 */
appInitializer.registerService({
  name: 'Analytics',
  priority: 0,
  critical: false,
  initialize: async () => {
    await analyticsService.initialize();
  },
});
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write services/analytics/AnalyticsService.ts services/AppInitializer.ts
git add services/analytics/AnalyticsService.ts services/AppInitializer.ts
git commit -m "feat(analytics): AnalyticsService singleton with PostHog + local aggregation"
```

---

## Task 6: Instrument Audio Playback Events

**Files:**
- Modify: `services/audio/ExpoAudioProvider.tsx`

This is the highest-value instrumentation — it captures all listening behavior.

- [ ] **Step 1: Read ExpoAudioProvider.tsx carefully**

Read the full file to understand:
- Where track loading happens (to fire `playback_started`)
- Where `didJustFinish` is handled (to fire `playback_completed`)
- Where progress updates happen (to feed MeaningfulListenTracker)
- Where pause/resume state changes are detected

- [ ] **Step 2: Add analytics import**

At the top of `services/audio/ExpoAudioProvider.tsx`:

```typescript
import {analyticsService} from '@/services/analytics/AnalyticsService';
```

- [ ] **Step 3: Fire playback_started when a new track loads**

Find where the track URL is loaded and playback begins. Add after the track starts playing:

```typescript
analyticsService.trackPlaybackStarted({
  surah_id: currentTrack.surahNumber,
  reciter_id: currentTrack.reciterId,
  rewayah_id: currentTrack.rewayahId,
  source: 'direct', // Determine from context: queue, direct, autoplay, playlist
  position_ms: 0,
});
```

The exact property names on the track object will depend on the current type definitions — read the file and adapt.

- [ ] **Step 4: Fire playback_completed on didJustFinish**

In the `handleTrackEnd` function (around line 231), before the queue advances:

```typescript
analyticsService.trackPlaybackCompleted({
  surah_id: currentTrack.surahNumber,
  reciter_id: currentTrack.reciterId,
  duration_ms: totalDuration,
  listened_ms: totalDuration, // Completed = full listen
  completion_pct: 100,
});
```

- [ ] **Step 5: Fire playback_paused and playback_resumed on state changes**

In the status monitoring section (around lines 163-195), detect transitions:

```typescript
// When transitioning from playing to paused:
analyticsService.trackPlaybackPaused({
  surah_id: currentTrack.surahNumber,
  reciter_id: currentTrack.reciterId,
  position_ms: currentPosition,
  listened_ms: listenedSinceLastEvent,
});

// When transitioning from paused to playing:
analyticsService.trackPlaybackResumed({
  surah_id: currentTrack.surahNumber,
  reciter_id: currentTrack.reciterId,
  position_ms: currentPosition,
});
```

You'll need to track `listenedSinceLastEvent` using a ref that accumulates between pause/resume cycles and resets on each analytics fire.

- [ ] **Step 6: Feed progress to MeaningfulListenTracker**

In the progress update handler (throttled, fires every 1-2 seconds):

```typescript
analyticsService.updatePlaybackProgress(positionMs, durationMs);
```

- [ ] **Step 7: Run type check and test on device**

```bash
npx tsc --noEmit
```

Start the app and verify:
- Playing a surah logs `playback_started` in PostHog (check PostHog dashboard or console logs)
- Pausing logs `playback_paused` with correct `listened_ms`
- Completing a surah logs `playback_completed`
- After 30s, `meaningful_listen` fires

- [ ] **Step 8: Format and commit**

```bash
npx prettier --write services/audio/ExpoAudioProvider.tsx
git add services/audio/ExpoAudioProvider.tsx
git commit -m "feat(analytics): instrument audio playback events in ExpoAudioProvider"
```

---

## Task 7: Instrument Player Store Events

**Files:**
- Modify: `services/player/store/playerStore.ts`

- [ ] **Step 1: Add analytics import**

```typescript
import {analyticsService} from '@/services/analytics/AnalyticsService';
```

- [ ] **Step 2: Instrument skipToNext and skipToPrevious**

In `skipToNext()` (around line 216), before advancing the queue:

```typescript
const currentTrack = get().queue[get().currentIndex];
if (currentTrack) {
  analyticsService.trackPlaybackSkipped({
    surah_id: currentTrack.surahNumber,
    reciter_id: currentTrack.reciterId,
    position_ms: get().position,
    listened_ms: get().position, // Approximate
    direction: 'next',
  });
}
```

Similarly in `skipToPrevious()` (around line 275) with `direction: 'prev'`.

- [ ] **Step 3: Instrument seekTo**

In `seekTo()` (around line 349):

```typescript
const currentTrack = get().queue[get().currentIndex];
if (currentTrack) {
  analyticsService.trackPlaybackSeeked({
    surah_id: currentTrack.surahNumber,
    from_ms: get().position,
    to_ms: positionMs,
  });
}
```

- [ ] **Step 4: Instrument setRate**

In `setRate()` (around line 365):

```typescript
analyticsService.trackRateChanged({
  old_rate: get().rate,
  new_rate: newRate,
});
```

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit
```

Adapt property names to match the actual track type in the store.

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write services/player/store/playerStore.ts
git add services/player/store/playerStore.ts
git commit -m "feat(analytics): instrument skip, seek, rate change events"
```

---

## Task 8: Instrument Feature Usage Events (Ambient, Favorites, Downloads)

**Files:**
- Modify: `store/ambientStore.ts`
- Modify: `services/player/store/lovedStore.ts`
- Modify: `services/player/store/downloadStore.ts`

- [ ] **Step 1: Instrument ambient toggle**

In `store/ambientStore.ts`, add import and fire event in the `setEnabled` action (around line 46):

```typescript
import {analyticsService} from '@/services/analytics/AnalyticsService';

// Inside setEnabled:
analyticsService.trackAmbientToggled({
  sound_type: get().currentSound ?? 'unknown',
  enabled: newValue,
});
```

- [ ] **Step 2: Instrument favorite toggle**

In `services/player/store/lovedStore.ts`, add import and fire event in `toggleLoved` (around line 56):

```typescript
import {analyticsService} from '@/services/analytics/AnalyticsService';

// Inside toggleLoved, after determining add/remove:
analyticsService.trackFavoriteToggled({
  surah_id: track.surahNumber,
  reciter_id: track.reciterId,
  action: isCurrentlyLoved ? 'remove' : 'add',
});
```

- [ ] **Step 3: Instrument download events**

In `services/player/store/downloadStore.ts`:

Add import and fire `download_started` in `setDownloading` (around line 393):

```typescript
import {analyticsService} from '@/services/analytics/AnalyticsService';

// In setDownloading:
analyticsService.trackDownloadStarted({
  surah_id: download.surahNumber,
  reciter_id: download.reciterId,
});
```

Fire `download_completed` in `clearDownloading` when status is completed (around line 399):

```typescript
// In clearDownloading, when download succeeded:
analyticsService.trackDownloadCompleted({
  surah_id: download.surahNumber,
  reciter_id: download.reciterId,
  file_size_bytes: download.fileSize ?? 0,
});
```

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

Adapt property names to match actual store types.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write store/ambientStore.ts services/player/store/lovedStore.ts services/player/store/downloadStore.ts
git add store/ambientStore.ts services/player/store/lovedStore.ts services/player/store/downloadStore.ts
git commit -m "feat(analytics): instrument ambient, favorite, and download events"
```

---

## Task 9: Instrument Share Events

**Files:**
- Modify: `utils/shareUtils.ts`

- [ ] **Step 1: Add analytics to share functions**

In `utils/shareUtils.ts`, the share action is at lines 67-77 (`Share.share()`). Add the import and fire event after a successful share:

```typescript
import {analyticsService} from '@/services/analytics/AnalyticsService';

// After Share.share() call succeeds, determine content_type from context:
analyticsService.trackShareCreated({
  content_type: contentType, // 'verse' | 'surah' | 'mushaf' | 'reciter' | 'adhkar'
  surah_id: surahId,
});
```

The exact integration depends on how share functions are structured. Read the file, identify each share path, and add the appropriate tracking call with the correct `content_type`.

- [ ] **Step 2: Run type check and format**

```bash
npx tsc --noEmit
npx prettier --write utils/shareUtils.ts
```

- [ ] **Step 3: Commit**

```bash
git add utils/shareUtils.ts
git commit -m "feat(analytics): instrument share events"
```

---

## Task 10: Instrument App Lifecycle Events

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add AppState listener for foreground/background tracking**

In `app/_layout.tsx`, add an effect that listens to AppState changes and connects the PostHog instance to the analytics service:

```typescript
import {AppState, type AppStateStatus} from 'react-native';
import {usePostHog} from 'posthog-react-native';
import {analyticsService} from '@/services/analytics/AnalyticsService';
```

Inside the root layout component, add:

```typescript
const posthog = usePostHog();

useEffect(() => {
  if (posthog) {
    analyticsService.setPostHogInstance(posthog);
    analyticsService.trackAppOpened();
  }
}, [posthog]);

useEffect(() => {
  function handleAppStateChange(nextState: AppStateStatus) {
    if (nextState === 'background' || nextState === 'inactive') {
      analyticsService.trackAppBackgrounded();
    } else if (nextState === 'active') {
      analyticsService.trackAppOpened();
    }
  }

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription.remove();
}, []);
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Format and commit**

```bash
npx prettier --write app/_layout.tsx
git add app/_layout.tsx
git commit -m "feat(analytics): instrument app lifecycle events and connect PostHog"
```

---

## Task 11: Configure Sentry Crash Reporting

**Files:**
- Modify: `app.json` or `app.config.ts`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add Sentry config plugin**

In `app.json` (or `app.config.ts`), add the Sentry plugin to the `plugins` array:

```json
["@sentry/react-native/expo", {
  "organization": "bayaan",
  "project": "bayaan-mobile"
}]
```

- [ ] **Step 2: Initialize Sentry in root layout**

In `app/_layout.tsx`, add Sentry initialization:

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  tracesSampleRate: 0.2,
  enableAutoSessionTracking: true,
  attachScreenshot: true,
});
```

This should be called early, before the component renders — at the module level or in the root layout's initialization.

- [ ] **Step 3: Wrap root component with Sentry**

```typescript
export default Sentry.wrap(RootLayout);
```

Or if using Expo Router's default export pattern, wrap the component that Expo Router exports.

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write app/_layout.tsx
git add app/_layout.tsx app.json
git commit -m "feat(analytics): add Sentry crash reporting"
```

---

## Task 12: Instrument Mushaf, Adhkar, Search, Translation, Reciter, and Playlist Events

**Files:**
- Modify: Mushaf screen components (e.g., `app/mushaf.tsx` and mushaf viewer)
- Modify: Adhkar components (e.g., `components/adhkar/TasbeehCounter.tsx`, adhkar category screens)
- Modify: Search components (e.g., `app/(tabs)/(b.search)/index.tsx`)
- Modify: Translation viewer components
- Modify: Reciter selection components
- Modify: Playlist store or components

These are the remaining events from the spec that need instrumentation. Each is a small addition — import `analyticsService` and call the appropriate method at the right point.

- [ ] **Step 1: Instrument mushaf page tracking**

In the mushaf viewer component, track when pages become visible and when the user spends >15s on a page:

```typescript
import {analyticsService} from '@/services/analytics/AnalyticsService';

// When a page becomes visible:
analyticsService.trackMushafPageOpened({
  page_number: pageNumber,
  surah_id: surahId,
  juz_number: juzNumber,
});

// When page is visible for >15 seconds (use a timer ref):
analyticsService.trackMushafPageRead({
  page_number: pageNumber,
  duration_ms: timeOnPageMs,
  surah_id: surahId,
});

// When leaving mushaf or app backgrounds:
analyticsService.trackMushafSessionEnded({
  pages_opened: totalPagesOpened,
  pages_read: totalPagesRead,
  total_duration_ms: sessionDurationMs,
});
```

Use a `useRef` to track page entry timestamps and a 15-second timer that fires `mushaf_page_read`. Reset on page change. Fire `mushaf_session_ended` on unmount or app background.

- [ ] **Step 2: Instrument adhkar events**

In adhkar category screens, fire session started when entering a category and session completed when all dhikrs are done:

```typescript
import {analyticsService} from '@/services/analytics/AnalyticsService';

// On entering an adhkar category:
analyticsService.trackAdhkarSessionStarted({category: categoryName});

// On completing all dhikrs:
analyticsService.trackAdhkarSessionCompleted({
  category: categoryName,
  duration_ms: sessionDurationMs,
  dhikr_count: totalDhikrs,
});
```

In `components/adhkar/TasbeehCounter.tsx`, fire when a tasbeeh set is completed (around line 51-65 in `incrementCount`):

```typescript
analyticsService.trackTasbeehCompleted({
  category: categoryName,
  count: targetCount,
});
```

- [ ] **Step 3: Instrument search events**

In the search screen, fire after search results are computed:

```typescript
analyticsService.trackSearchPerformed({
  query: searchQuery,
  results_count: results.length,
});
```

Debounce to avoid firing on every keystroke — fire after 500ms of no typing or on search submit.

- [ ] **Step 4: Instrument translation viewed**

In the translation/tafseer viewing component, fire when a translation is opened:

```typescript
analyticsService.trackTranslationViewed({
  translation_id: translationId,
  language: translationLanguage,
});
```

- [ ] **Step 5: Instrument reciter selected and rewayah changed**

Find where reciters are selected (e.g., reciter detail screens, default reciter picker). Fire:

```typescript
analyticsService.trackReciterSelected({
  reciter_id: reciterId,
  reciter_name: reciterName,
});
```

For rewayah changes:

```typescript
analyticsService.trackRewayahChanged({
  rewayah_id: rewayahId,
  rewayah_name: rewayahName,
});
```

- [ ] **Step 6: Instrument playlist events**

In playlist creation/modification flows:

```typescript
analyticsService.trackPlaylistModified({
  action: 'create', // or 'add_track' or 'remove_track'
  track_count: playlist.tracks.length,
});
```

- [ ] **Step 7: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Format and commit**

```bash
npx prettier --write app/mushaf.tsx components/adhkar/TasbeehCounter.tsx
# Add all modified files
git add -u
git commit -m "feat(analytics): instrument mushaf, adhkar, search, translation, reciter, and playlist events"
```

---

## Task 13: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit
```

Fix any remaining type errors.

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-cache
```

All tests should pass.

- [ ] **Step 3: Start the dev server and test on device/simulator**

```bash
npm start
```

Open the app and perform these actions, checking PostHog for events (or console logs if PostHog API key isn't configured yet):

1. **Launch app** — should see `app_opened` event
2. **Play a surah** — should see `playback_started`
3. **Wait 30+ seconds** — should see `meaningful_listen`
4. **Pause** — should see `playback_paused` with correct `listened_ms`
5. **Resume** — should see `playback_resumed`
6. **Skip to next** — should see `playback_skipped`
7. **Toggle ambient** — should see `ambient_toggled`
8. **Favorite a track** — should see `favorite_toggled`
9. **Background the app** — should see `app_backgrounded` with session duration

- [ ] **Step 4: Verify local aggregation**

After playing some content, check that MMKV has daily aggregate data. You can add a temporary debug button or use the dev menu to log:

```typescript
const today = localAggregationStore.getToday();
const agg = localAggregationStore.getDailyAggregate(today);
console.log('[Analytics Debug]', JSON.stringify(agg, null, 2));
```

- [ ] **Step 5: Format all changed files**

```bash
npx prettier --write services/analytics/**/*.ts services/audio/ExpoAudioProvider.tsx services/player/store/playerStore.ts store/ambientStore.ts services/player/store/lovedStore.ts services/player/store/downloadStore.ts utils/shareUtils.ts app/_layout.tsx services/AppInitializer.ts
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(analytics): end-to-end verification and formatting cleanup"
```
