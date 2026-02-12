# Digital Khatt Data Pipeline

This document describes exactly how Digital Khatt text/layout data is loaded, transformed, and consumed.

## Source Assets

Bundled databases:

- `data/mushaf/digitalkhatt/digital-khatt-v2.db` (word text)
- `data/mushaf/digitalkhatt/digital-khatt-15-lines.db` (page line layout)

Runtime DB file names in Expo SQLite:

- `dk_words.db`
- `dk_layout.db`

The runtime DBs are imported from bundled assets when required tables are missing.

## `DigitalKhattDataService` Load Strategy

File: `services/mushaf/DigitalKhattDataService.ts`

### Initialization contract

- `initialize()` is idempotent:
  - returns immediately if already initialized
  - shares in-flight promise via `_initializing`
- `_doInit()` calls `Promise.all([loadWords(), loadLayout()])`

### Table existence fallback

For each runtime DB:

1. open DB
2. check table existence via `sqlite_master`
3. if missing:
   - close DB
   - delete runtime DB
   - import from asset
   - re-open DB

This handles first install, invalid DB files, and migration-like corruption cases.

## Data Structures in Memory

### `wordsById`

- type: `Map<number, string>`
- filled from `SELECT id, text FROM words;`
- used to reconstruct line text from word ID ranges

### `pageLines`

- type: `Map<number, DKLine[]>`
- filled from `SELECT * FROM pages ORDER BY page_number, line_number;`
- each `DKLine` includes:
  - `line_type`: `surah_name | basmallah | ayah`
  - `is_centered`
  - `first_word_id`, `last_word_id`
  - `surah_number`

### Surah mappings

Derived during layout load:

- `surahStartPages`: first page where each surah appears
- `pageToSurah`: surah owning each page (filled from start page to next start - 1)

## Text Reconstruction

Function: `getLineText(line: DKLine): string`

- returns empty string for `surah_name`
- for `ayah` and `basmallah`:
  - iterate `first_word_id..last_word_id`
  - collect `wordsById.get(i)`
  - join with single spaces

Important:

- rendering code expects these spaces to exist; spacing/justification logic depends on them.

## `QuranTextService` Derivations

File: `services/mushaf/QuranTextService.ts`

`QuranTextService` transforms raw line text into rendering metadata and caches results.

### Cached APIs

- `getLineText(pageNumber, lineIndex)`
- `analyzeText(pageNumber, lineIndex)`

Caches:

- `lineTextCache: Map<string, string>`
- `lineTextInfoCache: Map<string, LineTextInfo>`
- key format: `${pageNumber}:${lineIndex}`

### Line metadata API

`getLineInfo(pageNumber, lineIndex)` returns:

- `lineType`:
  - 0 = ayah
  - 1 = surah_name
  - 2 = basmallah
- `lineWidthRatio`
- `isCentered`

`lineWidthRatio` comes from hardcoded `madinaLineWidths` overrides for specific page/line pairs.

### Space classification

In `analyzeText`, spaces are classified into:

- `SpaceType.Simple`
- `SpaceType.Aya`

Aya-space rule:

- space after Arabic-Indic digit (`U+0660..U+0669`) OR
- space before verse marker (`U+06DD`)

Outputs:

- `ayaSpaceIndexes: number[]`
- `simpleSpaceIndexes: number[]`
- `spaces: Map<number, SpaceType>`
- `wordInfos: WordInfo[]`

### Base letters and joins

`QuranTextService` maintains a `bases` set for Arabic base letters used by:

- `isLastBase(text, index)` (checks if char is terminal base in word)
- `nbBases(text)` (used by justification logic for heuristics)

## Data Consumers

- `SkiaPage`:
  - reads `digitalKhattDataService.getPageLines(pageNumber)`
- `JustService`:
  - reads line text + analysis through `QuranTextService`
- `MushafViewer`:
  - reads `getPageToSurah()` and `getSurahStartPages()` for navigation UI

## Failure Modes and Signals

Common failures:

- DB import failed -> init error log from `DigitalKhattDataService`
- missing rows/empty lines -> blank page areas
- corrupted word IDs -> malformed line text (missing words)

Logs to watch:

- `[DigitalKhattDataService] Initialization failed:`
- `[DigitalKhattDataService] Loaded X words`
- `[DigitalKhattDataService] Loaded layout for Y pages`

## Validation Checklist for Data Changes

When replacing DB assets:

1. `words` table exists and IDs are stable.
2. `pages` table exists and has expected columns.
3. all pages have expected line rows.
4. each line has valid `first_word_id <= last_word_id`.
5. `surah_name` rows carry correct `surah_number`.
6. pages 1..604 resolve in `pageToSurah`.
7. page 1/2 and 600+ special line ratio pages still render as expected.

