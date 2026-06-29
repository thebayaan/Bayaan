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
4. **R2-mirrored timestamp JSON**: ayah timing for ~114 reciters (113 mp3quran + Bandar Baleelah from QDC), fetched direct from CDN

### Not Yet Implemented

- Tap-to-seek UI interaction (seekToAyah is wired but not bound to a gesture yet)
- Range playback (repeat ayah ranges)
- Word-by-word highlighting (data exists in `segments` column)
- Adding remaining reciters not yet mirrored to R2

---

## Architecture

### R2 CDN Approach

Timestamps are fetched direct from Cloudflare R2 (`cdn.thebayaan.com/timestamps/{rewayat_id}/{NNN}.json`). No bundled DB, no backend round-trip. This matches how audio is served (also R2-mirrored from mp3quran), so timestamps and audio are always in sync.

### Data Flow

```
R2 CDN (cdn.thebayaan.com/timestamps/{rewayat_id}/{NNN}.json)
    ↓ fetch on track change (if rewayat has_timestamps + surah in timestamps_surah_list)
TimestampFetchService (in-memory cache layer)
    ↓ cache by "{rewayatId}-{surahNumber}"
timestampStore (Zustand — currentAyah, currentSurahTimestamps)
    ↓ subscribed by hooks
useTimestampLoader (watches current track → loads timestamps)
useAyahTracker (200ms poll → binary search → setCurrentAyah)
    ↓ verseKey string
QuranView (isActive prop on VerseItem, auto-scroll)
```

### JSON Shape

Each file at `cdn.thebayaan.com/timestamps/{rewayat_id}/{NNN}.json` is an `AyahTimestamp[]`:

```ts
interface AyahTimestamp {
  surahNumber: number;
  ayahNumber: number;
  timestampFrom: number; // milliseconds
  timestampTo: number;   // milliseconds
  durationMs: number;
}
```

Source of truth: `types/timestamps.ts`. The shape matches exactly what the mirror script writes and what the mobile client reads, so no transformation is needed at read time.

---

## Files

### New Files (7)

| File | Purpose |
|------|---------|
| `types/timestamps.ts` | Domain types, row types, mapping functions |
| `utils/timestampUtils.ts` | `binarySearchAyah()` O(log n), `findAyahTimestamp()` direct lookup |
| `services/timestamps/TimestampFetchService.ts` | Fetches AyahTimestamp[] from R2 CDN, in-memory cache |
| `store/timestampStore.ts` | Zustand store — currentAyah, currentSurahTimestamps |
| `hooks/useTimestampLoader.ts` | Loads timestamps on track change |
| `hooks/useAyahTracker.ts` | 200ms poll → binary search → updates currentAyah |

### Modified Files (8)

| File | Change |
|------|--------|
| `services/AppInitializer.ts` | Registered Timestamps service at priority 8 (non-critical) |
| `components/player/v2/PlayerContent/QuranView/VerseItem.tsx` | `isActive` prop, active background highlight, padding/borderRadius |
| `components/player/v2/PlayerContent/QuranView/index.tsx` | Passes `isActive`, auto-scroll effect, scroll-drag detection, re-center FAB |
| `components/player/v2/PlayerContent/index.tsx` | Mounts `useTimestampLoader` + `useAyahTracker`, `seekToAyah()` utility |
| `utils/audioUtils.ts` | Audio URL helpers (quranicaudio overrides removed) |

---

## Data Source

Timestamps are mirrored to Cloudflare R2 at `cdn.thebayaan.com/timestamps/{rewayat_id}/{NNN}.json` as `AyahTimestamp[]` JSON. The mobile client fetches direct from the CDN (matching the audio model: no backend round-trip). See `docs/superpowers/plans/2026-05-23-timestamps-r2-mirror.md` for the migration details.

Coverage is gated by two fields on each rewayat:
- `has_timestamps: boolean`: whether any surah has timestamps on R2
- `timestamps_surah_list: number[]`: exactly which surahs are covered

The client uses these to avoid 404 probing.

To add timestamps for a new reciter, run `npm run mirror:timestamps -- --rewayat=<id>` then `npm run apply:timestamps-coverage`.

---

## Reciter Coverage

Reciters with word-level segments (for future word-by-word highlighting) are marked. This table reflects the original v1 set; current coverage is broader (check `timestamps_surah_list` on each rewayat for live data):

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

Coverage continues to expand as new reciters are mirrored to R2.

---

## Performance

| Operation | Cost |
|-----------|------|
| Track change: R2 fetch | ~50-200ms (CDN edge, cached after first fetch) |
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
| Surah already fetched | In-memory cache hit, no network request |
