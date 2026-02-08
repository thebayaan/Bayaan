# Ayah-Level Timestamps — Design Document

> Highlight the active ayah during playback, tap any ayah to seek, and play/repeat selected ayah ranges.

**Status:** Planning complete, ready for implementation
**GitHub Issue:** [#73](https://github.com/thebayaan/Bayaan/issues/73)
**Branch:** TBD (off `develop`)

---

## Overview

Bayaan currently plays audio at the surah level with no ayah awareness. This feature adds ayah-level timestamp data that enables:

1. **Active ayah highlighting** — the currently-playing ayah is visually highlighted in QuranView
2. **Tap-to-seek** — tap any ayah to jump the audio to that position
3. **Range playback** — select a range of ayahs (e.g., 2:255–260) and play/repeat just that selection
4. **Smart auto-scroll** — QuranView follows playback, pauses when user scrolls manually

### Data Sources

- **Current:** Pre-existing timestamp data from [Qul](https://qul.tarteel.ai) and [Quran.com](https://quran.com) covering ~68 recitations
- **Future:** ASR (automatic speech recognition) model will generate timestamps for all reciters — same schema, same system

---

## Source Data Analysis

### Schema

Each source reciter has a standalone SQLite database (`surah-recitation-{slug}.db`) with two tables:

```sql
-- Surah metadata (we ignore audio_url — Bayaan has its own URLs)
CREATE TABLE surah_list (
  surah_number INTEGER,
  audio_url TEXT,        -- quranicaudio.com URL (not used)
  duration INTEGER       -- surah duration in seconds
);

-- Ayah-level timestamps
CREATE TABLE segments (
  surah_number INTEGER,
  ayah_number INTEGER,
  duration_sec INTEGER,      -- ayah duration in seconds
  timestamp_from INTEGER,    -- start position in milliseconds
  timestamp_to INTEGER,      -- end position in milliseconds
  segments TEXT              -- JSON: word-level timing or empty []
);
```

### Key Characteristics

| Property | Value |
|----------|-------|
| Timestamp unit | Milliseconds |
| Rows per source (complete) | 6,236 (total ayahs in Quran) |
| Per-reciter file size | 164KB (ayah-only) to 1.9MB (with word segments) |
| Total dataset | ~135MB across all reciters |
| Reciter count | ~68 recitations (mostly distinct, some share reciters with different masahif) |

### Dual-Source Data

Some reciters have **two rows per ayah** from different sources:

| Source | Segments Column | Timing Accuracy |
|--------|----------------|-----------------|
| Qul | Always `[]` (empty) | Ayah-level only |
| Quran.com | `[[word_idx, start_ms, end_ms], ...]` | Word-level |

Example — Al-Fatihah 1:1 (Yasser ad-Dussary):
```
Qul:       timestamp_from=0,    timestamp_to=3285,  segments=[]
Quran.com: timestamp_from=280,  timestamp_to=3080,  segments=[[1,180,780],[2,800,1430],[3,1430,2330],[4,2330,3080]]
```

The Quran.com data starts at actual speech onset (280ms) rather than audio file start (0ms), and includes per-word timing for 4 words in Bismillah.

### Word Segments Format

```json
[[word_index, start_ms, end_ms], ...]
```

Example for "بسم الله الرحمن الرحيم" (4 words):
```json
[[1, 180, 780], [2, 800, 1430], [3, 1430, 2330], [4, 2330, 3080]]
```

Word segments are stored for future word-by-word highlighting but **not used in v1**.

### Bismillah Handling

| Surah | Behavior |
|-------|----------|
| 1 (Al-Fatihah) | Ayah 1 IS the Bismillah. Starts at 0ms. No special handling. |
| 9 (At-Tawbah) | No Bismillah. Ayah 1 starts at 0ms. |
| 2–8, 10–114 | Position 0 → first ayah's `timestamp_from` is the Bismillah region. `currentAyah` is null during this gap — no highlighting. Correct behavior. |

---

## Architecture

### High-Level Flow

```
                    ┌──────────────────────┐
                    │   Supabase Storage    │
                    │  timestamps/          │
                    │  ├── manifest.json    │
                    │  ├── {rewayatId}.json │
                    │  └── ...              │
                    └──────────┬───────────┘
                               │ HTTP GET (lazy, on first play)
                               ▼
                    ┌──────────────────────┐
                    │  TimestampService    │
                    │  (download + cache)   │
                    └──────────┬───────────┘
                               │ insert rows
                               ▼
                    ┌──────────────────────┐
                    │  timestamps.db       │
                    │  (SQLite, on device)  │
                    └──────────┬───────────┘
                               │ query on track change
                               ▼
                    ┌──────────────────────┐
                    │  timestampStore      │
                    │  (Zustand, in-memory)│
                    │  currentSurahTimestamps[]
                    └──────────┬───────────┘
                               │ 200ms poll
                               ▼
                    ┌──────────────────────┐
                    │  useAyahTracker      │
                    │  binary search →     │
                    │  setCurrentAyah()    │
                    └──────────┬───────────┘
                               │ verseKey string
                               ▼
                    ┌──────────────────────┐
                    │  QuranView           │
                    │  VerseItem isActive  │
                    │  auto-scroll         │
                    └──────────────────────┘
```

### Three-Layer Pattern (Existing Convention)

```
TimestampDatabaseService (SQLite)
        ↓
TimestampService (business logic + download + in-memory cache)
        ↓
timestampStore (Zustand — UI state, current ayah tracking)
```

Pattern reference: `services/uploads/UploadsDatabaseService.ts` → `services/uploads/UploadsService.ts` → `store/uploadsStore.ts`

### Storage Strategy

| Layer | What | Size |
|-------|------|------|
| Remote (Supabase) | Preprocessed JSON per rewayat + manifest | ~135MB total |
| Local (SQLite) | `timestamps.db` — consolidated, all downloaded reciters | Grows per reciter (~164KB–1.9MB each) |
| In-memory (Zustand) | Current surah's timestamps only | Max 286 entries (Al-Baqarah) |

### Download Triggers

1. **Lazy on first play** — when a user plays a reciter with timestamps available, download that reciter's data (~164KB–1.9MB) silently in background. Highlighting appears when ready.
2. **With offline downloads** — when user downloads surah audio for offline, also download timestamps for that rewayat if not already present.

---

## Data Preprocessing

### Purpose

Transform source SQLite databases into clean JSON files using Bayaan's schema with rewayat UUIDs as the primary key.

### Pipeline

```
Source DBs (surah-recitation-{slug}.db)
    + reciters.json (slug → rewayatId mapping)
    + timestamp-slug-overrides.json (manual fixes)
    ↓
scripts/preprocessTimestamps.ts
    ↓
Output: quran-audio/timestamps/{rewayatId}.json (one per rewayat)
      + quran-audio/timestamps/manifest.json
    ↓
Upload to Supabase Storage
```

### Deduplication Strategy

For reciters with dual-source data (Qul + Quran.com):
- **Prefer Quran.com** (has word-level segments, more precise boundaries)
- **Fallback to Qul** when Quran.com data is missing
- **Output one row per ayah** — no runtime source disambiguation

### Slug-to-Rewayat Mapping

1. Auto-match: normalize both slug and reciter name (lowercase, strip diacritics, hyphenate)
2. Manual overrides: `scripts/timestamp-slug-overrides.json` for edge cases
3. Output unmatched slugs for human review

### Output JSON Format (Compact)

```json
{
  "v": 1,
  "r": "rewayat-uuid",
  "s": "bandar-baleela",
  "a": [
    { "s": 1, "a": 1, "f": 0, "t": 4260, "d": 4260, "w": [] },
    { "s": 1, "a": 2, "f": 4260, "t": 9881, "d": 5621, "w": [] },
    ...
  ]
}
```

Keys: `v`=version, `r`=rewayatId, `s`=slug, `a`=ayahs array. Per ayah: `s`=surah, `a`=ayah, `f`=from(ms), `t`=to(ms), `d`=duration(ms), `w`=word segments.

### Manifest Format

```json
{
  "version": 1,
  "generatedAt": "2025-06-01T00:00:00Z",
  "entries": [
    {
      "rewayatId": "uuid",
      "slug": "bandar-baleela",
      "filename": "{rewayatId}.json",
      "version": 1,
      "ayahCount": 6236,
      "hasWordSegments": false,
      "fileSize": 168432
    },
    ...
  ]
}
```

---

## Types

New file: `types/timestamps.ts`

### Domain Types (camelCase)

```typescript
/** A single ayah's timing within a surah audio file */
interface AyahTimestamp {
  surahNumber: number;
  ayahNumber: number;
  timestampFrom: number;     // milliseconds from start of audio
  timestampTo: number;       // milliseconds
  durationMs: number;        // ayah duration in milliseconds
  segments: WordSegment[];   // word-level timing (may be empty)
}

/** Word-level timing within an ayah */
interface WordSegment {
  wordIndex: number;         // 1-indexed position in ayah
  startMs: number;
  endMs: number;
}

/** Metadata about a downloaded timestamp dataset */
interface TimestampMeta {
  rewayatId: string;         // Bayaan rewayat UUID
  slug: string;              // source slug
  version: number;           // schema version for future migrations
  totalAyahs: number;        // 6236 for complete
  hasWordSegments: boolean;
  downloadedAt: number;      // epoch ms
  fileSize: number;          // bytes
}

/** Range playback configuration */
interface AyahRange {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  repeatCount: number;       // 0 = play once, -1 = infinite loop
}

/** Current ayah tracking state */
interface AyahTrackingState {
  surahNumber: number;
  ayahNumber: number;
  verseKey: string;          // "2:255" format for QuranView lookup
  timestampFrom: number;
  timestampTo: number;
}
```

### Row Types (snake_case — direct SQLite mapping)

```typescript
interface TimestampMetaRow {
  rewayat_id: string;
  slug: string;
  version: number;
  total_ayahs: number;
  has_word_segments: number;   // 0 or 1
  downloaded_at: number;
  file_size: number;
}

interface AyahTimestampRow {
  rewayat_id: string;
  surah_number: number;
  ayah_number: number;
  timestamp_from: number;
  timestamp_to: number;
  duration_ms: number;
  segments: string;           // JSON string
}
```

Plus `mapTimestampMetaRow()` and `mapAyahTimestampRow()` mapping functions.

### Manifest Types

```typescript
interface TimestampManifestEntry {
  rewayatId: string;
  slug: string;
  filename: string;
  version: number;
  ayahCount: number;
  hasWordSegments: boolean;
  fileSize: number;
}

interface TimestampManifest {
  version: number;
  generatedAt: string;
  entries: TimestampManifestEntry[];
}
```

---

## Database Layer

New file: `services/timestamps/TimestampDatabaseService.ts`

### Schema (`timestamps.db`)

```sql
CREATE TABLE IF NOT EXISTS timestamp_meta (
  rewayat_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  total_ayahs INTEGER NOT NULL,
  has_word_segments INTEGER NOT NULL DEFAULT 0,
  downloaded_at INTEGER NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ayah_timestamps (
  rewayat_id TEXT NOT NULL,
  surah_number INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  timestamp_from INTEGER NOT NULL,
  timestamp_to INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  segments TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (rewayat_id, surah_number, ayah_number)
);

CREATE INDEX IF NOT EXISTS idx_timestamps_surah
  ON ayah_timestamps(rewayat_id, surah_number);
```

### Key Methods

```typescript
class TimestampDatabaseService {
  // Lifecycle
  async initialize(): Promise<void>;
  async close(): Promise<void>;

  // Meta operations
  async getMeta(rewayatId: string): Promise<TimestampMeta | null>;
  async getAllMeta(): Promise<TimestampMeta[]>;
  async upsertMeta(meta: TimestampMeta): Promise<void>;
  async deleteMeta(rewayatId: string): Promise<void>;

  // Timestamp operations (hot path)
  async getTimestampsForSurah(rewayatId: string, surahNumber: number): Promise<AyahTimestamp[]>;
  async getTimestampForAyah(rewayatId: string, surahNumber: number, ayahNumber: number): Promise<AyahTimestamp | null>;

  // Bulk operations
  async insertTimestamps(rewayatId: string, timestamps: AyahTimestamp[]): Promise<void>;  // transaction
  async deleteTimestamps(rewayatId: string): Promise<void>;

  // Quick checks
  async hasTimestamps(rewayatId: string): Promise<boolean>;
}
```

### Performance

- `getTimestampsForSurah` is the hot path (called on track change). With the `idx_timestamps_surah` index, returns max 286 rows (Al-Baqarah) in <1ms.
- `insertTimestamps` uses a single transaction with batch statements — same pattern as playlist item reordering.
- Register in `AppInitializer.ts` at **priority 7** (non-critical).

---

## Service Layer

New file: `services/timestamps/TimestampService.ts`

### Key Methods

```typescript
class TimestampService {
  // Manifest management
  async fetchManifest(forceRefresh?: boolean): Promise<TimestampManifest>;
  // → GET from Supabase Storage, cache in AsyncStorage with 7-day TTL

  // Availability checks
  async getAvailability(rewayatId: string): Promise<TimestampAvailability>;
  async isAvailableForDownload(rewayatId: string): Promise<boolean>;

  // Download
  async downloadTimestamps(rewayatId: string, onProgress?: (n: number) => void): Promise<void>;
  // → Fetch JSON from Supabase → parse → insert into timestamps.db → update meta

  // Queries (cached in-memory by "{rewayatId}-{surahNumber}")
  async getTimestampsForSurah(rewayatId: string, surahNumber: number): Promise<AyahTimestamp[] | null>;
  // → Returns null if not downloaded

  // Lazy download trigger
  async ensureTimestampsForTrack(track: Track): Promise<boolean>;
  // → Called when track starts playing. Returns true if timestamps ready.
  // → If not downloaded but available, triggers background download (non-blocking).
}
```

### Supabase URLs

```
Manifest:   quran-audio/timestamps/manifest.json
Per-reciter: quran-audio/timestamps/{rewayatId}.json
```

Base URL: `https://tncrklrswaounqmirayh.supabase.co/storage/v1/object/public/`

---

## Zustand Store

New file: `store/timestampStore.ts`

### State Shape

```typescript
interface TimestampState {
  // Current ayah tracking
  currentAyah: AyahTrackingState | null;

  // Current surah's timestamps (loaded into memory for playback)
  currentSurahTimestamps: AyahTimestamp[] | null;
  currentTimestampKey: string | null;   // "{rewayatId}-{surahNumber}"

  // Range playback
  activeRange: AyahRange | null;
  rangeCurrentRepeat: number;

  // Availability cache
  availabilityMap: Record<string, TimestampAvailability>;

  // Download state
  isDownloading: boolean;
  downloadProgress: number;
}
```

### Key Selectors (Minimal Re-renders)

```typescript
// For QuranView — only re-renders when the highlighted verse changes
const currentVerseKey = useTimestampStore(s => s.currentAyah?.verseKey);

// For range UI
const activeRange = useTimestampStore(s => s.activeRange);
```

### Actions

```typescript
// Ayah tracking
setCurrentAyah(state: AyahTrackingState): void;
clearCurrentAyah(): void;

// Timestamp loading
loadTimestampsForSurah(rewayatId: string, surahNumber: number): Promise<void>;
clearCurrentTimestamps(): void;

// Range playback
setActiveRange(range: AyahRange | null): void;
incrementRangeRepeat(): void;
clearRange(): void;

// Derived query (synchronous — operates on in-memory array)
findAyahAtPosition(positionMs: number): AyahTimestamp | null;
```

---

## Utility Functions

New file: `utils/timestampUtils.ts`

### Binary Search

```typescript
/**
 * Binary search for the ayah containing a given playback position.
 * Array must be sorted by timestampFrom (ascending).
 * Returns null if position is before the first ayah (e.g., Bismillah region).
 */
function binarySearchAyah(timestamps: AyahTimestamp[], positionMs: number): AyahTimestamp | null;
```

### Direct Lookup

```typescript
/**
 * Find a specific ayah's timestamp entry.
 * Uses direct index (ayah 1 → index 0) with fallback linear scan.
 * Array is small (max 286) so linear scan is fine as fallback.
 */
function findAyahTimestamp(timestamps: AyahTimestamp[], ayahNumber: number): AyahTimestamp | null;
```

---

## Playback Integration

### Position Tracker — `hooks/useAyahTracker.ts` (new file)

Core loop running at 200ms intervals:

```
Every 200ms (when playing + timestamps loaded):
  1. Read expoAudioService.getCurrentTime()     // sync, near-free
  2. Convert to milliseconds
  3. Binary search currentSurahTimestamps        // O(log 286) ≈ 8 comparisons
  4. If ayah changed → setCurrentAyah()          // at most 1 update per transition
  5. If activeRange → enforce boundary
```

**Guards:**
- Only runs when `playback.state === 'playing'` and `currentSurahTimestamps` is not null
- Store update guarded by `lastAyahRef` — only fires when ayah number actually changes
- Interval cleaned up on track change or unmount

**Why 200ms?** Many ayahs are 2-5 seconds long. At 200ms, we get 10-25 checks per ayah — smooth enough for highlighting. The CPU cost is negligible (one native property read + one binary search on a tiny array).

### Timestamp Loader — `hooks/useTimestampLoader.ts` (new file)

Watches `queue.currentIndex` / current track:

```
On track change:
  1. Clear previous ayah state and range
  2. Extract rewayatId + surahNumber from current track
  3. Load timestamps from service (cache → DB → null)
  4. If null but available remotely → trigger background download
  5. When download completes → reload into store → tracker picks up
```

### Mount Point

Both hooks are mounted in `components/player/v2/PlayerContent/index.tsx` at the top of the component.

### Range Boundary Enforcement

When `activeRange` is set and the 200ms poll detects position past `endAyah.timestampTo`:

- If `repeatCount === -1` (infinite) or `rangeCurrentRepeat < repeatCount`:
  → Seek to `startAyah.timestampFrom`, increment repeat counter
- Otherwise:
  → Pause playback, clear range

---

## UI Changes

### Ayah Highlighting

**File:** `components/player/v2/PlayerContent/QuranView/VerseItem.tsx`

- Add `isActive?: boolean` prop
- When active: apply `backgroundColor: Color(textColor).alpha(0.12)` — clean background tint, no borders or accents
- Change `TouchableOpacity` → `Pressable` (codebase convention)
- Add `onLongPress?: () => void` prop for range selection

**File:** `components/player/v2/PlayerContent/QuranView/index.tsx`

- Subscribe to `useTimestampStore(s => s.currentAyah?.verseKey)`
- Pass `isActive={item.verse_key === currentVerseKey}` to each VerseItem
- VerseItem is already `memo`'d — only the 2 affected items re-render per transition (old active → inactive, new → active)

### Smart Auto-Scroll

**Behavior:**
1. **Default:** auto-scrolls to keep active ayah visible at ~30% from top of list
2. **User scrolls:** detect via `onScrollBeginDrag` → pause auto-follow
3. **Re-center button:** small floating button appears when follow is paused, tapping it resumes following and scrolls to current ayah
4. **Track change:** resets follow mode to ON

**Implementation:** `isFollowing` ref (not state — avoids re-renders). Set to `true` on track change, `false` on drag, `true` on re-center tap. Auto-scroll effect checks `isFollowing.current` before scrolling.

### Tap-to-Seek

**File:** `components/player/v2/PlayerContent/index.tsx`

Replace the existing `handleVersePress` no-op (currently just `console.log`) with:

```typescript
const handleVersePress = useCallback(async (verseKey: string) => {
  const [, ayahStr] = verseKey.split(':');
  const ayahNumber = parseInt(ayahStr, 10);

  const timestamps = useTimestampStore.getState().currentSurahTimestamps;
  if (!timestamps) return; // No timestamps — graceful degradation

  const ts = findAyahTimestamp(timestamps, ayahNumber);
  if (!ts) return;

  await playerActions.seekTo(ts.timestampFrom / 1000); // ms → seconds
  useTimestampStore.getState().setCurrentAyah({ /* instant feedback */ });
}, []);
```

Uses `usePlayerActions().seekTo()` (not `useUnifiedPlayer`) to avoid excess re-renders.

### Range Selection UI

**New file:** `components/sheets/AyahRangeSheet.tsx`

Action sheet with:
- Start ayah (pre-filled from long-pressed verse or current ayah)
- End ayah (picker, defaults to same as start for single-ayah repeat)
- Repeat count selector (1x, 3x, 5x, infinite)
- "Play Range" button → sets `activeRange` in store, seeks to start

**Two entry points for discoverability:**
1. Long-press on any VerseItem → opens sheet with that verse as start
2. Dedicated "select range" button in ControlButtons toolbar → opens sheet with current ayah as start

**Active range indicator:** Small pill in ControlButtons area showing "2:255–260 [2/3]" during range playback.

**Registration:** Add to `components/sheets/sheets.tsx`.

---

## Download Integration

### Manifest

- Bundle a copy of `manifest.json` with the app (~10KB) for offline availability checking
- On launch, check for remote manifest updates (7-day TTL in AsyncStorage)
- Manifest tells the app which rewayat IDs have timestamp data available

### Lazy Download (First Play)

```
Track starts playing
  → useTimestampLoader checks: timestamps in local DB?
    → YES: load into store, enable tracking
    → NO: check manifest — available remotely?
      → YES: download JSON in background (~164KB–1.9MB)
              → parse → insert into timestamps.db (transaction)
              → update store → highlighting begins
      → NO: do nothing (feature invisible)
```

No loading indicator in v1 — highlighting silently appears when ready.

### Offline Download Piggyback

When a user downloads a surah for offline playback (via `downloadStore.ts`), check if timestamps are available for that rewayat and not yet downloaded. If so, trigger `timestampService.downloadTimestamps()` non-blocking.

---

## Performance Analysis

### Position Polling (200ms)

| Operation | Cost |
|-----------|------|
| `expoAudioService.getCurrentTime()` | Near-free (reads native property) |
| `binarySearchAyah()` on 286 items | ~8 comparisons, microseconds |
| Store update | Only when ayah changes (~1-2x per ayah) |

**Total:** Negligible JS thread impact. No frame drops.

### Re-render Scope

When `currentVerseKey` changes:
- LegendList with `recycleItems={true}` only re-renders visible items
- VerseItem is `memo`'d — only 2 items re-render per transition (old active, new active)
- Each VerseItem re-render is lightweight (just a background color change)

### Data Loading

| Event | Query | Time |
|-------|-------|------|
| Track change | `SELECT ... WHERE rewayat_id=? AND surah_number=?` | <1ms (indexed) |
| First download | HTTP GET ~164KB–1.9MB | 1-5s on typical connection |
| DB insert | Transaction with batch statements | <50ms for 6,236 rows |

### Memory

| What | Max Size |
|------|----------|
| In-memory surah timestamps | 286 entries (Al-Baqarah) × ~40 bytes ≈ 12KB |
| Manifest cache | ~10KB |
| Availability map | ~68 entries × 50 bytes ≈ 4KB |

---

## Files Summary

### New Files (10)

| File | Purpose |
|------|---------|
| `types/timestamps.ts` | All type definitions and mapping functions |
| `services/timestamps/TimestampDatabaseService.ts` | SQLite layer (singleton, WAL, mutex) |
| `services/timestamps/TimestampService.ts` | Business logic, download, in-memory cache |
| `store/timestampStore.ts` | Zustand store — tracking, range, availability |
| `utils/timestampUtils.ts` | Binary search, ayah lookup helpers |
| `hooks/useAyahTracker.ts` | 200ms position tracker |
| `hooks/useTimestampLoader.ts` | Track change → load timestamps |
| `scripts/preprocessTimestamps.ts` | Data preprocessing pipeline |
| `scripts/timestamp-slug-overrides.json` | Manual slug-to-rewayat mappings |
| `components/sheets/AyahRangeSheet.tsx` | Range selection action sheet |

### Modified Files (7)

| File | Change |
|------|--------|
| `services/AppInitializer.ts` | Register TimestampDatabaseService at priority 7 |
| `components/player/v2/PlayerContent/index.tsx` | Mount hooks, implement tap-to-seek and long-press |
| `components/player/v2/PlayerContent/QuranView/index.tsx` | `isActive` prop, smart auto-scroll, re-center button |
| `components/player/v2/PlayerContent/QuranView/VerseItem.tsx` | Highlight styling, `Pressable`, `onLongPress` |
| `components/sheets/sheets.tsx` | Register AyahRangeSheet |
| `components/player/v2/PlayerContent/ControlButtons/index.tsx` | Range indicator pill, select-range button |
| `services/player/store/downloadStore.ts` | Piggyback timestamp download on audio download |

### Patterns to Reuse

| Pattern | Reference File |
|---------|---------------|
| SQLite singleton + WAL + mutex | `services/uploads/UploadsDatabaseService.ts` |
| Three-layer DB → Service → Store | `services/uploads/` + `store/uploadsStore.ts` |
| Row mapping (snake→camel) | `types/uploads.ts` |
| AppInitializer registration | `services/AppInitializer.ts` |
| Action sheet registration | `components/sheets/sheets.tsx` |
| Non-subscribing actions hook | `hooks/usePlayerActions.ts` |
| seekTo | `services/audio/ExpoAudioService.ts` |
| Position reading | `expoAudioService.getCurrentTime()` (sync) |

---

## Implementation Phases

### Phase 1: Foundation (Types + DB + Service + Store)
No risk to existing features. All new files.

### Phase 2: Preprocessing Script + Supabase Upload
Local script, not shipped with app. Produces data for Supabase.

### Phase 3: Playback Integration
New hooks. Mounts in PlayerContent. No visual changes yet — just populates store.

### Phase 4: Highlighting + Smart Auto-Scroll
First visible feature. Modifies QuranView and VerseItem.

### Phase 5: Tap-to-Seek
Replaces existing no-op. Small, focused change.

### Phase 6: Range Playback
New sheet + toolbar button. Most complex UI work. Can be deferred.

### Phase 7: Download Integration
Polish. Piggyback on existing download flow.

**Phases 1-5 deliver the core experience. Phase 6 is power-user. Phase 7 is polish.**

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Reciter has no timestamps | Feature invisible. No highlighting, no seek. QuranView works as today. |
| User upload (no rewayatId) | Feature invisible. |
| Different recording edition | Timestamps may drift slightly. Best-effort — acceptable. |
| Short ayahs (2-3s) | 200ms polling gives 10-15 checks. Sufficient precision. |
| Rapid track skipping | useEffect cleanup ensures only latest track loads. |
| Download during playback | Non-blocking. DB transaction. Store updates when complete. |
| Offline with no timestamps | No download attempted. Feature invisible. |
| Multiple rewayat for same reciter | Timestamps keyed by rewayatId. Each rewayat independent. |

---

## Future Enhancements (Not in v1)

- **Word-by-word highlighting** — data already stored in `segments` column
- **ASR-generated timestamps** — plug into same system via preprocessing pipeline
- **Timestamp accuracy feedback** — let users report misaligned timestamps
- **Cross-surah range** — play ayahs spanning multiple surahs
- **Bookmark ayah position** — save specific ayah for quick return
- **Share ayah audio clip** — extract and share audio for specific ayahs

---

## Testing & Verification

1. **Unit tests:** `binarySearchAyah()` with edge cases — position before first ayah, between ayahs, past last ayah, empty array, single-ayah surah
2. **Highlighting:** Play surah with known timestamps → verify VerseItem highlights transition correctly
3. **Auto-scroll:** Verify scroll follows, pauses on user drag, re-center button works
4. **Tap-to-seek:** Tap ayah mid-surah → verify audio jumps to correct position
5. **Range playback:** Long-press ayah 5, set end to 10, repeat 2x → verify loop and pause
6. **Graceful degradation:** Play reciter without timestamps → verify no errors, no highlighting
7. **Lazy download:** Play timestamped reciter for first time → verify silent download, highlighting begins
8. **Performance:** Monitor JS thread FPS with highlighting active → should stay above 55fps
