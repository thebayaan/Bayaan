# Ayah-Level Timestamps

> Highlight the active ayah during playback, with auto-scroll and tap-to-seek support.

**Status:** v1 implemented (highlighting + auto-scroll), testing in progress
**GitHub Issue:** [#73](https://github.com/thebayaan/Bayaan/issues/73)
**Branch:** `feature/ayah-timestamps`

---

## What's Implemented

1. **Active ayah highlighting** — the currently-playing ayah gets a background tint in QuranView
2. **Smart auto-scroll** — QuranView follows playback; pauses when user scrolls manually; re-center FAB button appears to resume
3. **Seek-to-ayah utility** — `seekToAyah()` function ready in PlayerContent for future UI binding (e.g. double-tap, button)
4. **Bundled timestamp database** — 274K+ ayah timing rows for 34 reciters, zero network dependency

### Not Yet Implemented

- Tap-to-seek UI interaction (seekToAyah is wired but not bound to a gesture yet)
- Range playback (repeat ayah ranges)
- Word-by-word highlighting (data exists in `segments` column)
- Adding the 10 unmatched reciters (need Supabase inserts)

---

## Architecture

### Bundled DB Approach

The original design doc assumed lazy downloading from Supabase. We instead bundle the entire database with the app for zero-latency, zero-network operation.

```
assets/data/timestamps.db.gz  (25MB, committed to git)
    ↓ npm postinstall: gzip -dkf
assets/data/timestamps.db     (117MB, .gitignore'd, generated locally)
    ↓ metro.config.js: .db in assetExts
    ↓ app.config.js: expo-asset plugin embeds in native binary
    ↓ Runtime: TimestampDatabaseService copies from asset to documentDirectory (first launch only)
    ↓ expo-sqlite opens from documentDirectory
```

### Data Flow

```
TimestampDatabaseService (SQLite singleton)
    ↓ query on track change
TimestampService (in-memory cache layer)
    ↓ cache by "{rewayatId}-{surahNumber}"
timestampStore (Zustand — currentAyah, currentSurahTimestamps)
    ↓ subscribed by hooks
useTimestampLoader (watches current track → loads timestamps)
useAyahTracker (200ms poll → binary search → setCurrentAyah)
    ↓ verseKey string
QuranView (isActive prop on VerseItem, auto-scroll)
```

### Database Schema

Source: `/Users/osmansaeday/theBayaan/quran-timestamps/output/timestamps.db` (117MB)

```sql
CREATE TABLE timestamp_meta (
    rewayat_id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'qurancom',
    audio_source TEXT NOT NULL DEFAULT 'quranicaudio',
    version INTEGER NOT NULL DEFAULT 1,
    total_ayahs INTEGER NOT NULL,
    has_word_segments INTEGER NOT NULL DEFAULT 0,
    audio_url_pattern TEXT,
    url_padding TEXT NOT NULL DEFAULT 'padded'
);

CREATE TABLE ayah_timestamps (
    rewayat_id TEXT NOT NULL,
    surah_number INTEGER NOT NULL,
    ayah_number INTEGER NOT NULL,
    timestamp_from INTEGER NOT NULL,  -- milliseconds
    timestamp_to INTEGER NOT NULL,    -- milliseconds
    duration_ms INTEGER NOT NULL,
    segments TEXT NOT NULL DEFAULT '[]',  -- JSON: [[word_idx, start_ms, end_ms], ...]
    PRIMARY KEY (rewayat_id, surah_number, ayah_number)
);
CREATE INDEX idx_timestamps_surah ON ayah_timestamps(rewayat_id, surah_number);
```

---

## Files

### New Files (7)

| File | Purpose |
|------|---------|
| `types/timestamps.ts` | Domain types, row types, mapping functions |
| `utils/timestampUtils.ts` | `binarySearchAyah()` O(log n), `findAyahTimestamp()` direct lookup |
| `services/timestamps/TimestampDatabaseService.ts` | SQLite singleton — copies bundled asset, opens DB |
| `services/timestamps/TimestampService.ts` | Caching layer over DB service |
| `store/timestampStore.ts` | Zustand store — currentAyah, currentSurahTimestamps |
| `hooks/useTimestampLoader.ts` | Loads timestamps on track change |
| `hooks/useAyahTracker.ts` | 200ms poll → binary search → updates currentAyah |

### Modified Files (8)

| File | Change |
|------|--------|
| `metro.config.js` | Added `.db` to `assetExts` |
| `app.config.js` | Configured expo-asset plugin to embed `timestamps.db` |
| `package.json` | Chained `gzip -dkf` in postinstall; added `expo-file-system` |
| `.gitignore` | Added `assets/data/timestamps.db` (decompressed, not committed) |
| `services/AppInitializer.ts` | Registered Timestamps service at priority 8 (non-critical) |
| `components/player/v2/PlayerContent/QuranView/VerseItem.tsx` | `isActive` prop, active background highlight, padding/borderRadius |
| `components/player/v2/PlayerContent/QuranView/index.tsx` | Passes `isActive`, auto-scroll effect, scroll-drag detection, re-center FAB |
| `components/player/v2/PlayerContent/index.tsx` | Mounts `useTimestampLoader` + `useAyahTracker`, `seekToAyah()` utility |
| `utils/audioUtils.ts` | **TEMPORARY** quranicaudio.com URL overrides for testing |

---

## Audio Source Mismatch (Known Issue)

The timestamp data was generated from **quranicaudio.com** recordings. The app normally plays from **mp3quran.net**. These are different recordings, so timestamps don't align with mp3quran audio.

### Current Workaround

`utils/audioUtils.ts` contains a `TIMESTAMP_AUDIO_OVERRIDES` map that redirects 34 reciters to quranicaudio.com URLs. This is **temporary for testing**.

### Known Issues with quranicaudio.com Audio

Some quranicaudio files have unnatural cuts between ayahs — the audio is spliced rather than naturally paused. This affects some reciters more than others.

### Permanent Solutions (Pick One)

1. **Re-generate timestamps** against mp3quran.net audio files using ASR alignment
2. **Permanently switch** to quranicaudio.com as the audio source (if quality is acceptable)
3. **Offer both sources** as selectable options per reciter

---

## Reciter Coverage

34 of 44 timestamp rewayat IDs match existing app reciters. Those with word-level segments (for future word-by-word highlighting) are marked:

| Reciter | Style | Word Segments |
|---------|-------|:---:|
| Abdulbasit Abdulsamad | Mujawwad | yes |
| Abdulbasit Abdulsamad | Murattal | yes |
| Abdulmohsen Al-Qasim | | |
| Abdullah Basfer | | |
| Abdullah Al-Mattrod | | |
| Abdulrahman Alsudaes | Murattal | yes |
| Abu Bakr Al Shatri | Murattal | yes |
| Ahmad Al Nufais | Tarteel | yes |
| Ahmad Nauina | | |
| Ahmad Al-Ajmy | | |
| Akram Alalaqmi | | |
| Ali Hajjaj Alsouasi | | |
| Ali Jaber | | |
| Bandar Balilah | | |
| Fares Abbad | | |
| Hani Arrifai | Murattal | yes |
| Khalid Al-Jileel | Murattal | yes |
| Khalifa Altunaiji | Murattal | yes |
| Mahmoud Khalil Al-Hussary | Murattal | yes |
| Maher Al Meaqli | Year 1440 | |
| Mahmoud Ali Albanna | | |
| Mishary Alafasi | Murattal | yes |
| Mohammad Al-Tablaway | | |
| Mustafa Ismail | | |
| Mohammed Jibreel | | |
| Nasser Alqatami | | |
| Saad Al-Ghamdi | | |
| Sahl Yassin | | |
| Slaah Bukhatir | | |
| Salah Albudair | | |
| Saud Al-Shuraim | Murattal | yes |
| Mohammed Siddiq Al-Minshawi | Mujawwad | yes |
| Mohammed Siddiq Al-Minshawi | Murattal | yes |
| Yasser Al-Dosari | | yes |

10 unmatched reciters in timestamp DB need Supabase inserts to add to app (deferred).

---

## Performance

| Operation | Cost |
|-----------|------|
| First launch: asset copy | ~1-2s for 117MB (one-time native file copy) |
| Track change: DB query | <1ms (indexed by rewayat_id + surah_number) |
| 200ms poll: position read | Near-free (sync `player.currentTime`) |
| 200ms poll: binary search | ~8 comparisons on max 286 items |
| Ayah transition: re-render | 2 VerseItems (old active + new active) |
| Memory: surah timestamps | Max 286 entries × ~50 bytes = 14KB |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Reciter has no timestamps | Feature invisible — no highlight, no errors |
| User upload (no rewayatId) | Feature invisible |
| Position in bismillah region | `binarySearchAyah` returns null → no highlight |
| Rapid track skipping | useEffect cleanup ensures only latest track loads |
| App killed mid-playback | Timestamps re-load on next track change |
| DB already copied | `FileSystem.getInfoAsync` check skips copy |
