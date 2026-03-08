# On-Demand Timestamp Fetch & Cache — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 40MB bundled timestamps.db with on-demand fetching from MP3Quran (113 reciters) and QDC (16 unique reciters), permanently cached in local SQLite — expanding follow-along coverage from 34 to ~129 reciters while deleting all URL overrides.

**Architecture:** Two API adapters (MP3Quran + QDC) behind a `TimestampFetchService` that normalizes responses into the existing `AyahTimestamp` shape. Fetches are triggered lazily when a surah is played, then permanently cached in SQLite (timestamps never change). The follow-along registry is built from static `mp3quran_read_id` / `qdc_reciter_id` fields on each rewayat — no network call needed at startup.

**Tech Stack:** expo-sqlite, Zustand, TypeScript, fetch API

---

## Overview of Changes

| Area | What changes |
|------|-------------|
| `data/reciterData.ts` | Add `mp3quranReadId` and `qdcReciterId` optional fields to `Rewayat` interface |
| `data/reciters.json` | Add mapping fields to ~129 rewayat entries |
| `types/timestamps.ts` | Add API response types, new `TimestampSource` type |
| `services/timestamps/TimestampFetchService.ts` | **NEW** — fetches from MP3Quran/QDC, normalizes, writes to SQLite |
| `services/timestamps/TimestampDatabaseService.ts` | Remove bundled DB import, add write methods |
| `services/timestamps/TimestampService.ts` | Add fetch-on-miss path via TimestampFetchService |
| `store/timestampStore.ts` | Build registry from static rewayat fields instead of DB metadata |
| `utils/audioUtils.ts` | Delete `TIMESTAMP_AUDIO_OVERRIDES` map, simplify `generateAudioUrl` |
| `utils/mushafAudioUtils.ts` | Delete `TIMESTAMP_AUDIO_OVERRIDES` map, simplify `resolveMushafAudioUrl` |
| `services/AppInitializer.ts` | Update timestamp init (no bundled DB copy) |
| `assets/data/timestamps.db` | **DELETE** |
| `assets/data/timestamps.db.gz` | **DELETE** (if exists) |

---

## Task 1: Add Mapping Fields to Rewayat Interface

**Files:**
- Modify: `data/reciterData.ts:11-21`

**Step 1: Add optional fields to Rewayat interface**

In `data/reciterData.ts`, add two optional fields after `source_type`:

```typescript
export interface Rewayat {
  id: string;
  reciter_id: string;
  name: string;
  style: string;
  server: string;
  surah_total: number;
  surah_list: (number | null)[];
  source_type: string;
  created_at: string;
  mp3quran_read_id?: number;    // MP3Quran timing API read ID
  qdc_reciter_id?: number;      // Quran.com (QDC) reciter ID
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (fields are optional, no downstream breakage)

**Step 3: Commit**

```bash
git add data/reciterData.ts
git commit -m "feat(timestamps): add mp3quran_read_id and qdc_reciter_id to Rewayat interface"
```

---

## Task 2: Add Mapping IDs to reciters.json

**Files:**
- Modify: `data/reciters.json`

This is the data mapping step. We need to add `mp3quran_read_id` to ~113 rewayat entries and `qdc_reciter_id` to ~16 rewayat entries.

**Step 1: Write a mapping script**

Create a temporary Node script at `scripts/add-timestamp-ids.ts` that:

1. Loads `data/reciters.json`
2. Loads the MP3Quran reads list (fetch from `https://mp3quran.net/api/v3/ayat_timing/reads` or use cached `/tmp/mp3quran_reads.json`)
3. For each MP3Quran read, matches `folder_url` against each rewayat's `server` field (strip trailing slashes, compare)
4. Sets `mp3quran_read_id` on matching rewayat
5. For the 6 QDC-only reciters, manually maps `qdc_reciter_id`:
   - Mohammed Jibreel → `qdc_reciter_id: 32` (rewayat ID: `78a256f3-b1b8-4e1f-b593-d73a6b8dc64d`)
   - Minshawi Mujawwad → `qdc_reciter_id: 21` (rewayat ID: `efeccedb-81c6-4ba5-b49a-f69fc723c46b`)
   - Mustafa Ismail → `qdc_reciter_id: 20` (rewayat ID: `db736d03-e7c3-4692-ac7c-588f09ed5ad0`)
   - Albanna → `qdc_reciter_id: 36` (rewayat ID: `d375b45c-0c0f-48e1-a940-526bc1f68890`)
   - Bandar Baleelah → `qdc_reciter_id: 44` (rewayat ID: `ad6b3383-0004-4bba-ab91-b4f584b3be9f`)
   - Maher Al Meaqli (year1440/mujawwad) → `qdc_reciter_id: 49` (rewayat ID: `243312ab-9884-4af2-a034-64774b0f2276`)
6. Writes updated JSON back to `data/reciters.json`
7. Prints summary: how many matched, how many QDC-only, any unmatched

**Step 2: Run the script**

```bash
npx ts-node scripts/add-timestamp-ids.ts
```

Expected: ~113 MP3Quran matches + 6 QDC mappings applied.

**Step 3: Verify the output**

```bash
cat data/reciters.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
mp3 = sum(1 for r in d for rw in r['rewayat'] if rw.get('mp3quran_read_id'))
qdc = sum(1 for r in d for rw in r['rewayat'] if rw.get('qdc_reciter_id'))
print(f'MP3Quran mapped: {mp3}')
print(f'QDC mapped: {qdc}')
"
```

Expected: `MP3Quran mapped: ~113`, `QDC mapped: 6`

**Step 4: Update Supabase `rewayat` table**

Also add `mp3quran_read_id` (integer, nullable) and `qdc_reciter_id` (integer, nullable) columns to the Supabase `rewayat` table so `npm run fetch-reciters` preserves them in future fetches. Run SQL in Supabase dashboard:

```sql
ALTER TABLE rewayat ADD COLUMN IF NOT EXISTS mp3quran_read_id integer;
ALTER TABLE rewayat ADD COLUMN IF NOT EXISTS qdc_reciter_id integer;
```

Then update the matching rows with the IDs from the script output.

**Step 5: Update fetch-reciters script**

Find the fetch-reciters script (likely in `scripts/`) and ensure it includes `mp3quran_read_id` and `qdc_reciter_id` in the SELECT query so future fetches don't strip the fields.

**Step 6: Commit**

```bash
git add data/reciters.json scripts/add-timestamp-ids.ts
git commit -m "feat(timestamps): map rewayat to MP3Quran read IDs and QDC reciter IDs"
```

---

## Task 3: Add API Response Types

**Files:**
- Modify: `types/timestamps.ts`

**Step 1: Add new types to types/timestamps.ts**

Append after the existing types (after line 78):

```typescript
// --- API Response Types ---

export type TimestampSource = 'mp3quran' | 'qdc' | 'local';

/** MP3Quran /api/v3/ayat_timing response shape */
export interface Mp3QuranTimingResponse {
  ayat_timing: Mp3QuranAyahTiming[];
}

export interface Mp3QuranAyahTiming {
  ayah: number;
  start_time: number; // seconds (float)
  end_time: number;   // seconds (float)
}

/** QDC /api/qdc/audio/reciters/{id}/audio_files response shape */
export interface QdcAudioFileResponse {
  audio_files: QdcAudioFile[];
}

export interface QdcAudioFile {
  verse_timings: QdcVerseTiming[];
}

export interface QdcVerseTiming {
  verse_key: string;    // "2:255"
  timestamp_from: number; // milliseconds
  timestamp_to: number;   // milliseconds
  segments: number[][];   // word-level segments (ignored for now)
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add types/timestamps.ts
git commit -m "feat(timestamps): add MP3Quran and QDC API response types"
```

---

## Task 4: Rewrite TimestampDatabaseService (Remove Bundled DB, Add Write Methods)

**Files:**
- Modify: `services/timestamps/TimestampDatabaseService.ts`

This is a significant rewrite. The DB is no longer imported from a bundled asset — it's created empty and populated on-demand.

**Step 1: Rewrite TimestampDatabaseService.ts**

Replace the entire file with:

```typescript
import * as SQLite from 'expo-sqlite';
import type {
  AyahTimestamp,
  AyahTimestampRow,
  TimestampSource,
} from '@/types/timestamps';
import {mapAyahTimestampRow} from '@/types/timestamps';

const DB_NAME = 'timestamps_v3.db';

class TimestampDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync(DB_NAME);

        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS ayah_timestamps (
            rewayat_id TEXT NOT NULL,
            surah_number INTEGER NOT NULL,
            ayah_number INTEGER NOT NULL,
            timestamp_from INTEGER NOT NULL,
            timestamp_to INTEGER NOT NULL,
            duration_ms INTEGER NOT NULL,
            PRIMARY KEY (rewayat_id, surah_number, ayah_number)
          );

          CREATE TABLE IF NOT EXISTS cached_surahs (
            rewayat_id TEXT NOT NULL,
            surah_number INTEGER NOT NULL,
            source TEXT NOT NULL,
            fetched_at INTEGER NOT NULL,
            PRIMARY KEY (rewayat_id, surah_number)
          );
        `);

        this.db = db;
      } catch (error) {
        console.error('Failed to initialize timestamps database:', error);
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  async getTimestampsForSurah(
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[]> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT rewayat_id, surah_number, ayah_number, timestamp_from, timestamp_to, duration_ms
       FROM ayah_timestamps
       WHERE rewayat_id = ? AND surah_number = ?
       ORDER BY ayah_number`,
      [rewayatId, surahNumber],
    )) as AyahTimestampRow[];

    return rows.map(mapAyahTimestampRow);
  }

  async isSurahCached(
    rewayatId: string,
    surahNumber: number,
  ): Promise<boolean> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    const result = await this.db.getFirstAsync(
      `SELECT 1 FROM cached_surahs WHERE rewayat_id = ? AND surah_number = ? LIMIT 1`,
      [rewayatId, surahNumber],
    );

    return result !== null;
  }

  async writeTimestamps(
    rewayatId: string,
    surahNumber: number,
    timestamps: AyahTimestamp[],
    source: TimestampSource,
  ): Promise<void> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    await this.db.withTransactionAsync(async () => {
      // Delete any existing data for this surah (in case of re-fetch)
      await this.db!.runAsync(
        `DELETE FROM ayah_timestamps WHERE rewayat_id = ? AND surah_number = ?`,
        [rewayatId, surahNumber],
      );

      // Insert all ayah timestamps
      for (const t of timestamps) {
        await this.db!.runAsync(
          `INSERT INTO ayah_timestamps (rewayat_id, surah_number, ayah_number, timestamp_from, timestamp_to, duration_ms)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [rewayatId, surahNumber, t.ayahNumber, t.timestampFrom, t.timestampTo, t.durationMs],
        );
      }

      // Mark surah as cached
      await this.db!.runAsync(
        `INSERT OR REPLACE INTO cached_surahs (rewayat_id, surah_number, source, fetched_at)
         VALUES (?, ?, ?, ?)`,
        [rewayatId, surahNumber, source, Date.now()],
      );
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export const timestampDatabaseService = new TimestampDatabaseService();
```

Key changes:
- DB name changed to `timestamps_v3.db` (fresh start, old `timestamps.db` from bundled era will be ignored)
- No `importDatabaseFromAssetAsync` — tables created empty
- `timestamp_meta` table replaced with simpler `cached_surahs` table
- New `writeTimestamps()` method for caching fetched data
- New `isSurahCached()` method for cache-hit checks

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: Errors in TimestampService.ts and timestampStore.ts (they reference removed `getAllMeta`, `hasTimestamps`, `getMeta`). This is expected — we fix them in Tasks 6 and 7.

**Step 3: Commit**

```bash
git add services/timestamps/TimestampDatabaseService.ts
git commit -m "feat(timestamps): rewrite DB service — remove bundled import, add write methods"
```

---

## Task 5: Create TimestampFetchService

**Files:**
- Create: `services/timestamps/TimestampFetchService.ts`

This is the core new service. It fetches from the correct API based on the rewayat's mapping fields, normalizes the response, and writes to SQLite.

**Step 1: Create TimestampFetchService.ts**

```typescript
import {RECITERS, type Rewayat} from '@/data/reciterData';
import {timestampDatabaseService} from './TimestampDatabaseService';
import type {
  AyahTimestamp,
  Mp3QuranTimingResponse,
  QdcAudioFileResponse,
  TimestampSource,
} from '@/types/timestamps';

const MP3QURAN_BASE = 'https://mp3quran.net/api/v3/ayat_timing';
const QDC_BASE = 'https://api.qurancdn.com/api/qdc/audio/reciters';

class TimestampFetchService {
  /**
   * Get the timestamp source info for a rewayat.
   * Returns null if the rewayat has no timestamp mapping.
   */
  getSourceForRewayat(rewayatId: string): {
    source: TimestampSource;
    apiId: number;
  } | null {
    const rewayat = this.findRewayat(rewayatId);
    if (!rewayat) return null;

    if (rewayat.mp3quran_read_id) {
      return {source: 'mp3quran', apiId: rewayat.mp3quran_read_id};
    }
    if (rewayat.qdc_reciter_id) {
      return {source: 'qdc', apiId: rewayat.qdc_reciter_id};
    }
    return null;
  }

  /**
   * Fetch timestamps for a surah from the appropriate API.
   * Returns normalized AyahTimestamp[] or null if fetch fails.
   */
  async fetchAndCache(
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[] | null> {
    const sourceInfo = this.getSourceForRewayat(rewayatId);
    if (!sourceInfo) return null;

    try {
      let timestamps: AyahTimestamp[];

      if (sourceInfo.source === 'mp3quran') {
        timestamps = await this.fetchFromMp3Quran(
          sourceInfo.apiId,
          surahNumber,
        );
      } else {
        timestamps = await this.fetchFromQdc(sourceInfo.apiId, surahNumber);
      }

      if (timestamps.length === 0) return null;

      // Write to SQLite cache
      await timestampDatabaseService.writeTimestamps(
        rewayatId,
        surahNumber,
        timestamps,
        sourceInfo.source,
      );

      return timestamps;
    } catch (error) {
      console.warn(
        `[TimestampFetch] Failed to fetch timestamps for ${rewayatId} surah ${surahNumber}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Fetch from MP3Quran API and normalize to AyahTimestamp[].
   * API: GET /api/v3/ayat_timing?surah={N}&read={readId}
   * Returns times in seconds (float) — we convert to milliseconds.
   */
  private async fetchFromMp3Quran(
    readId: number,
    surahNumber: number,
  ): Promise<AyahTimestamp[]> {
    const url = `${MP3QURAN_BASE}?surah=${surahNumber}&read=${readId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`MP3Quran API error: ${response.status}`);
    }

    const data: Mp3QuranTimingResponse = await response.json();

    if (!data.ayat_timing || data.ayat_timing.length === 0) {
      return [];
    }

    return data.ayat_timing.map(t => {
      const from = Math.round(t.start_time * 1000);
      const to = Math.round(t.end_time * 1000);
      return {
        surahNumber,
        ayahNumber: t.ayah,
        timestampFrom: from,
        timestampTo: to,
        durationMs: to - from,
      };
    });
  }

  /**
   * Fetch from QDC API and normalize to AyahTimestamp[].
   * API: GET /api/qdc/audio/reciters/{id}/audio_files?chapter={N}&segments=true
   * Returns times already in milliseconds.
   */
  private async fetchFromQdc(
    reciterId: number,
    surahNumber: number,
  ): Promise<AyahTimestamp[]> {
    const url = `${QDC_BASE}/${reciterId}/audio_files?chapter=${surahNumber}&segments=true`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`QDC API error: ${response.status}`);
    }

    const data: QdcAudioFileResponse = await response.json();

    if (
      !data.audio_files ||
      data.audio_files.length === 0 ||
      !data.audio_files[0].verse_timings
    ) {
      return [];
    }

    return data.audio_files[0].verse_timings.map(t => {
      const ayahNumber = parseInt(t.verse_key.split(':')[1], 10);
      return {
        surahNumber,
        ayahNumber,
        timestampFrom: t.timestamp_from,
        timestampTo: t.timestamp_to,
        durationMs: t.timestamp_to - t.timestamp_from,
      };
    });
  }

  private findRewayat(rewayatId: string): Rewayat | undefined {
    for (const reciter of RECITERS) {
      const rw = reciter.rewayat.find(r => r.id === rewayatId);
      if (rw) return rw;
    }
    return undefined;
  }
}

export const timestampFetchService = new TimestampFetchService();
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: May still have errors from Task 4 leftovers in other files — that's fine. This file itself should be clean.

**Step 3: Commit**

```bash
git add services/timestamps/TimestampFetchService.ts
git commit -m "feat(timestamps): add TimestampFetchService for MP3Quran and QDC APIs"
```

---

## Task 6: Update TimestampService (Add Fetch-on-Miss)

**Files:**
- Modify: `services/timestamps/TimestampService.ts`

The service now tries local SQLite first, then fetches on-demand if not cached.

**Step 1: Rewrite TimestampService.ts**

```typescript
import {timestampDatabaseService} from './TimestampDatabaseService';
import {timestampFetchService} from './TimestampFetchService';
import type {AyahTimestamp} from '@/types/timestamps';

class TimestampService {
  private cache = new Map<string, AyahTimestamp[]>();

  async initialize(): Promise<void> {
    await timestampDatabaseService.initialize();
  }

  /**
   * Check if a rewayat has timestamp support (static check, no network).
   */
  hasTimestampSource(rewayatId: string): boolean {
    return timestampFetchService.getSourceForRewayat(rewayatId) !== null;
  }

  /**
   * Get timestamps for a surah. Checks:
   * 1. In-memory cache (instant)
   * 2. SQLite cache (fast, ~1ms)
   * 3. API fetch + cache (network, ~200ms)
   */
  async getTimestampsForSurah(
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[] | null> {
    const key = `${rewayatId}-${surahNumber}`;

    // 1. In-memory cache
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      // 2. SQLite cache
      const dbTimestamps = await timestampDatabaseService.getTimestampsForSurah(
        rewayatId,
        surahNumber,
      );

      if (dbTimestamps.length > 0) {
        this.cache.set(key, dbTimestamps);
        return dbTimestamps;
      }

      // 3. Fetch from API and cache
      const fetched = await timestampFetchService.fetchAndCache(
        rewayatId,
        surahNumber,
      );

      if (fetched) {
        this.cache.set(key, fetched);
        return fetched;
      }

      return null;
    } catch {
      return null;
    }
  }
}

export const timestampService = new TimestampService();
```

Key changes:
- Removed `hasTimestamps()` and `getMeta()` (no longer needed — registry is static)
- Added `hasTimestampSource()` for synchronous registry checks
- `getTimestampsForSurah()` now has 3-tier lookup: memory → SQLite → API fetch

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: Errors in timestampStore.ts (references `hasTimestamps`, `getAllMeta`). Fixed in Task 7.

**Step 3: Commit**

```bash
git add services/timestamps/TimestampService.ts
git commit -m "feat(timestamps): add 3-tier lookup — memory, SQLite, API fetch"
```

---

## Task 7: Update timestampStore (Static Registry)

**Files:**
- Modify: `store/timestampStore.ts`

The follow-along registry no longer reads from the DB. It's built from static `mp3quran_read_id` / `qdc_reciter_id` fields on each rewayat — instant, no async needed.

**Step 1: Rewrite timestampStore.ts**

```typescript
import {create} from 'zustand';
import type {AyahTimestamp, AyahTrackingState} from '@/types/timestamps';
import {timestampService} from '@/services/timestamps/TimestampService';
import {RECITERS} from '@/data/reciterData';

interface TimestampState {
  currentAyah: AyahTrackingState | null;
  currentSurahTimestamps: AyahTimestamp[] | null;
  currentTimestampKey: string | null;
  isLocked: boolean;

  // Follow Along registry
  supportedRewayatIds: Set<string>;
  supportedReciterIds: Set<string>;
  registryLoaded: boolean;
  followAlongEnabled: boolean;

  setCurrentAyah: (state: AyahTrackingState) => void;
  setIsLocked: (isLocked: boolean) => void;
  clearCurrentAyah: () => void;
  loadTimestampsForSurah: (
    rewayatId: string,
    surahNumber: number,
  ) => Promise<void>;
  clearCurrentTimestamps: () => void;
  loadFollowAlongRegistry: () => void;
  toggleFollowAlong: () => void;
}

export const useTimestampStore = create<TimestampState>()((set, get) => ({
  currentAyah: null,
  currentSurahTimestamps: null,
  currentTimestampKey: null,
  isLocked: true,

  // Follow Along registry defaults
  supportedRewayatIds: new Set<string>(),
  supportedReciterIds: new Set<string>(),
  registryLoaded: false,
  followAlongEnabled: true,

  setIsLocked: isLocked => set({isLocked}),

  setCurrentAyah: ayahState => set({currentAyah: ayahState}),

  clearCurrentAyah: () => set({currentAyah: null}),

  loadTimestampsForSurah: async (rewayatId, surahNumber) => {
    const key = `${rewayatId}-${surahNumber}`;
    if (get().currentTimestampKey === key) return;

    const timestamps = await timestampService.getTimestampsForSurah(
      rewayatId,
      surahNumber,
    );
    set({
      currentSurahTimestamps: timestamps,
      currentTimestampKey: key,
      currentAyah: null,
    });
  },

  clearCurrentTimestamps: () =>
    set({
      currentSurahTimestamps: null,
      currentTimestampKey: null,
      currentAyah: null,
    }),

  loadFollowAlongRegistry: () => {
    const rewayatIds = new Set<string>();
    const reciterIds = new Set<string>();

    for (const reciter of RECITERS) {
      for (const rewayat of reciter.rewayat) {
        if (rewayat.mp3quran_read_id || rewayat.qdc_reciter_id) {
          rewayatIds.add(rewayat.id);
          reciterIds.add(reciter.id);
        }
      }
    }

    console.log(
      `[FollowAlong] Registry loaded: ${rewayatIds.size} rewayat, ${reciterIds.size} reciters`,
    );

    set({
      supportedRewayatIds: rewayatIds,
      supportedReciterIds: reciterIds,
      registryLoaded: true,
    });
  },

  toggleFollowAlong: () =>
    set(state => ({followAlongEnabled: !state.followAlongEnabled})),
}));
```

Key changes:
- `loadFollowAlongRegistry` is now **synchronous** — builds from static RECITERS data
- No more DB dependency (`timestampDatabaseService` import removed)
- Registry checks `mp3quran_read_id || qdc_reciter_id` instead of querying `timestamp_meta`

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (or errors only in audioUtils files which we fix next)

**Step 3: Commit**

```bash
git add store/timestampStore.ts
git commit -m "feat(timestamps): build follow-along registry from static rewayat fields"
```

---

## Task 8: Update AppInitializer

**Files:**
- Modify: `services/AppInitializer.ts:316-324`

**Step 1: Update the timestamp initialization block**

Replace lines 316-324:

```typescript
/**
 * Timestamp Service (Priority 9)
 * Opens/creates local timestamp cache DB
 * Non-critical - app can function without ayah timestamps
 */
appInitializer.registerService({
  name: 'Timestamps',
  priority: 9,
  critical: false,
  initialize: async () => {
    await timestampService.initialize();
    useTimestampStore.getState().loadFollowAlongRegistry();
  },
});
```

Note: `loadFollowAlongRegistry()` is no longer async — no `await` needed.

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add services/AppInitializer.ts
git commit -m "feat(timestamps): update AppInitializer — no bundled DB, sync registry"
```

---

## Task 9: Delete URL Overrides from audioUtils.ts

**Files:**
- Modify: `utils/audioUtils.ts`

**Step 1: Delete the entire TIMESTAMP_AUDIO_OVERRIDES map and override logic**

Remove lines 5-153 (the entire `TIMESTAMP_AUDIO_OVERRIDES` constant) and the override check in `generateAudioUrl`.

The new `generateAudioUrl` should be:

```typescript
import {Reciter} from '@/data/reciterData';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {resolveFilePath} from '@/services/downloadService';

export function generateAudioUrl(
  reciter: Reciter,
  surahId: string,
  rewayatId?: string,
): string {
  const paddedSurahId = surahId.padStart(3, '0');

  const rewayat = rewayatId
    ? reciter.rewayat.find(r => r.id === rewayatId)
    : reciter.rewayat[0];

  if (!rewayat) {
    throw new Error('No rewayat found for reciter');
  }

  return `${rewayat.server}/${paddedSurahId}.mp3`;
}
```

The `generateSmartAudioUrl` function stays exactly as-is (it calls `generateAudioUrl` internally).

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Run prettier**

Run: `npx prettier --write utils/audioUtils.ts`

**Step 4: Commit**

```bash
git add utils/audioUtils.ts
git commit -m "refactor(timestamps): delete all TIMESTAMP_AUDIO_OVERRIDES from audioUtils"
```

---

## Task 10: Delete URL Overrides from mushafAudioUtils.ts

**Files:**
- Modify: `utils/mushafAudioUtils.ts`

**Step 1: Delete the TIMESTAMP_AUDIO_OVERRIDES map and simplify resolveMushafAudioUrl**

Remove lines 12-157 (the entire override map) and the override check in `resolveMushafAudioUrl`.

The new file should be:

```typescript
/**
 * Mushaf Audio Utilities
 *
 * Resolves audio URLs for mushaf playback.
 */

import {RECITERS, type Reciter} from '@/data/reciterData';

/**
 * Resolve the audio URL for a given rewayat and surah number.
 */
export function resolveMushafAudioUrl(
  rewayatId: string,
  surahNumber: number,
): string {
  const paddedSurah = surahNumber.toString().padStart(3, '0');

  const reciter = RECITERS.find(r => r.rewayat.some(rw => rw.id === rewayatId));
  if (reciter) {
    const rewayat = reciter.rewayat.find(rw => rw.id === rewayatId);
    if (rewayat) {
      return `${rewayat.server}/${paddedSurah}.mp3`;
    }
  }

  throw new Error(`Cannot resolve audio URL for rewayat ${rewayatId}`);
}

/**
 * Find the reciter and rewayat info for a given rewayat ID.
 */
export function findReciterForRewayat(rewayatId: string): {
  reciter: Reciter;
  rewayatName: string;
  style: string;
} | null {
  for (const reciter of RECITERS) {
    const rewayat = reciter.rewayat.find(rw => rw.id === rewayatId);
    if (rewayat) {
      return {
        reciter,
        rewayatName: rewayat.name,
        style: rewayat.style,
      };
    }
  }
  return null;
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Run prettier**

Run: `npx prettier --write utils/mushafAudioUtils.ts`

**Step 4: Commit**

```bash
git add utils/mushafAudioUtils.ts
git commit -m "refactor(timestamps): delete all TIMESTAMP_AUDIO_OVERRIDES from mushafAudioUtils"
```

---

## Task 11: Update QDC-Sourced Reciters' Audio Server URLs

**Files:**
- Modify: `data/reciters.json`

For reciters whose timestamps come from QDC, the audio must also come from quranicaudio.com. Update the `server` field for these 6 rewayat entries:

| Rewayat ID | Reciter | New server URL |
|---|---|---|
| `78a256f3-b1b8-4e1f-b593-d73a6b8dc64d` | Mohammed Jibreel | `https://download.quranicaudio.com/quran/muhammad_jibreel/complete` |
| `efeccedb-81c6-4ba5-b49a-f69fc723c46b` | Minshawi Mujawwad | `https://download.quranicaudio.com/qdc/siddiq_al-minshawi/mujawwad` |
| `db736d03-e7c3-4692-ac7c-588f09ed5ad0` | Mustafa Ismail | `https://download.quranicaudio.com/quran/mostafa_ismaeel` |
| `d375b45c-0c0f-48e1-a940-526bc1f68890` | Albanna | `https://download.quranicaudio.com/quran/mahmood_ali_albana` |
| `ad6b3383-0004-4bba-ab91-b4f584b3be9f` | Bandar Baleelah | `https://download.quranicaudio.com/quran/bandar_baleela/complete` |
| `243312ab-9884-4af2-a034-64774b0f2276` | Maher (mujawwad/1440) | `https://download.quranicaudio.com/qdc/maher_al_meaqli/year1440` |

**Step 1: Update server URLs in reciters.json**

For each of the 6 rewayat entries above, find the entry in `data/reciters.json` by its `id` field and update the `server` value to the new quranicaudio URL.

Also update Supabase `rewayat` table with matching SQL:
```sql
UPDATE rewayat SET server = 'https://download.quranicaudio.com/quran/muhammad_jibreel/complete' WHERE id = '78a256f3-b1b8-4e1f-b593-d73a6b8dc64d';
-- ... (repeat for all 6)
```

**Step 2: Verify URLs work**

```bash
# Test one URL
curl -sI "https://download.quranicaudio.com/quran/muhammad_jibreel/complete/001.mp3" | head -3
```

Expected: `HTTP/2 200` or `HTTP/2 302` (redirect to CDN)

**Step 3: Commit**

```bash
git add data/reciters.json
git commit -m "feat(timestamps): switch 6 QDC reciters to quranicaudio audio URLs"
```

---

## Task 12: Delete Bundled Database Assets

**Files:**
- Delete: `assets/data/timestamps.db`
- Delete: `assets/data/timestamps.db.gz` (if exists)

**Step 1: Check what exists**

```bash
ls -lh assets/data/timestamps*
```

**Step 2: Delete the files**

```bash
rm assets/data/timestamps.db
rm -f assets/data/timestamps.db.gz
```

**Step 3: Search for any remaining references to the bundled DB**

```bash
npx grep -r "timestamps.db" --include="*.ts" --include="*.tsx" --include="*.js"
```

If any references remain (besides the new `timestamps_v3.db` name), update them.

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add -A assets/data/
git commit -m "chore(timestamps): delete bundled timestamps.db (40MB savings)"
```

---

## Task 13: Clean Up Old timestamp_meta References

**Files:**
- Modify: `types/timestamps.ts` (remove `TimestampMeta`, `TimestampMetaRow`, `mapTimestampMetaRow`)

**Step 1: Search for any remaining usages of removed types**

```bash
npx grep -r "TimestampMeta\|timestamp_meta\|getAllMeta\|getMeta" --include="*.ts" --include="*.tsx"
```

**Step 2: Remove dead types from types/timestamps.ts**

Remove the `TimestampMeta` interface (lines 11-21), `TimestampMetaRow` interface (lines 33-43), and `mapTimestampMetaRow` function (lines 56-68). Keep `AyahTimestamp`, `AyahTrackingState`, `AyahTimestampRow`, `mapAyahTimestampRow`, and the new API types added in Task 3.

**Step 3: Fix any remaining import errors**

If any other files still import `TimestampMeta`, remove those imports.

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Run prettier**

Run: `npx prettier --write types/timestamps.ts`

**Step 6: Commit**

```bash
git add types/timestamps.ts
git commit -m "refactor(timestamps): remove dead TimestampMeta types"
```

---

## Task 14: Full Integration Verification

**Step 1: Run full type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

**Step 2: Run prettier on all changed files**

```bash
npx prettier --write \
  data/reciterData.ts \
  types/timestamps.ts \
  services/timestamps/TimestampDatabaseService.ts \
  services/timestamps/TimestampFetchService.ts \
  services/timestamps/TimestampService.ts \
  store/timestampStore.ts \
  utils/audioUtils.ts \
  utils/mushafAudioUtils.ts \
  services/AppInitializer.ts
```

**Step 3: Run linter**

```bash
npm run lint
```

Fix any issues.

**Step 4: Run tests**

```bash
npm test
```

Expected: All existing tests pass.

**Step 5: Manual smoke test**

1. Start the app: `npm run ios`
2. Play a surah from **Alafasy** (MP3Quran source) — verify follow-along highlighting works
3. Play a surah from **Mohammed Jibreel** (QDC source) — verify follow-along works with quranicaudio audio
4. Play a surah from a reciter **without** timestamps — verify no errors, follow-along badge hidden
5. Check the console for `[FollowAlong] Registry loaded: ~129 rewayat` log
6. Kill and relaunch — play same Alafasy surah again, verify it loads instantly from SQLite cache (no network fetch)

**Step 6: Final commit (if any lint/format fixes)**

```bash
git add -A
git commit -m "chore(timestamps): lint and format fixes"
```

---

## Task 15: Clean Up Temporary Files

**Step 1: Delete mapping script**

```bash
rm scripts/add-timestamp-ids.ts
```

**Step 2: Commit**

```bash
git add scripts/add-timestamp-ids.ts
git commit -m "chore: remove temporary timestamp mapping script"
```

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Bundle size impact | +40MB (timestamps.db) | 0 |
| Follow-along reciters | 34 | ~129 |
| URL overrides | 34 entries × 2 files | 0 |
| Startup cost | Copy 40MB DB | Create empty DB (~1ms) |
| Per-surah cost | SQLite read (~1ms) | SQLite read (~1ms), or API fetch (~200ms) + cache on first play |
| Network dependency | None (bundled) | First play of each surah per reciter (~17KB max) |
| Audio source hacks | 34 hardcoded overrides | 6 permanent server URL changes in reciters.json |

## Phase 2 (Deferred)

- Supabase timestamp mirror as fallback
- Forced alignment for Maher murattal + Mohammed Ayoub murattal 1
- Audio fallback to own servers (Cloudflare)
