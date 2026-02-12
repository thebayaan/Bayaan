# Digital Khatt Rendering Pipeline

This document traces one page render from `MushafViewer` to final Skia draw calls.

## End-to-End Flow

1. `MushafViewer` selects Uthmani mode.
2. `UthmaniPageView` mounts for the target page.
3. `SkiaPage` loads `DigitalKhatt` font and retrieves page lines.
4. `SkiaPage` resolves per-line `JustResultByLine[]`:
   - check in-memory cache, then MMKV (both synchronous), or
   - compute on demand via `JustService.getPageLayout` (first-launch fallback only).
5. `SkiaPage` maps each non-`surah_name` line to `SkiaLine`.
6. `SkiaLine` builds a `Paragraph`:
   - text direction RTL
   - per-char OpenType features from justification map
   - per-space letterSpacing based on space type
7. `SkiaLine` computes x-position (centered vs justified) and renders `<Paragraph />`.
8. `UthmaniPageView` overlays surah header text (RN `Text` with `SURAH_HEADERS` font).

## Layout Caching Architecture (MMKV)

All 604 page layouts are precomputed once per font family and stored in MMKV (`react-native-mmkv`), a memory-mapped key-value store with synchronous reads (~0.01-0.1ms).

### Cache layers (checked in order)

1. **In-memory `pageLayoutsCache`** — `Map<string, Map<number, JustResultByLine[]>>`, fastest (~0.001ms)
2. **MMKV** — synchronous disk read via `MushafLayoutCacheService` (~1ms including JSON parse)
3. **On-demand compute** — `JustService.getPageLayout()` (~20-100ms, only on first launch before MMKV is populated)

### Key schema

```
"dk:{fontFamily}:{pageNumber}"     → JSON string of JustResultByLine[]
"dk_complete:{fontFamily}"         → "true" when all 604 pages stored
"dk_schema_version"                → number for cache invalidation
```

### Precomputation flow

`MushafLayoutCacheService` (registered in `AppInitializer` at priority 8, non-critical):

1. On app startup, checks if `dk_complete:{activeFontFamily}` is `"true"`
2. If not, creates a `SkTypefaceFontProvider` outside React via `Skia.TypefaceFontProvider.Make()`
3. Loops pages 1-604, computing each via `JustService.getPageLayout()` and writing to MMKV
4. Yields to the event loop every 10 pages to avoid blocking UI
5. After active font completes, precomputes the other font family
6. On subsequent app launches, all pages are available instantly from MMKV

### Files

- `services/mushaf/MushafLayoutCacheService.ts` — singleton, MMKV read/write, precomputation orchestration
- `services/mushaf/JustificationService.ts` — `getCachedPageLayout()` checks in-memory then MMKV
- `services/AppInitializer.ts` — registers cache service at priority 8

## `SkiaPage` Responsibilities

File: `components/mushaf/skia/SkiaPage.tsx`

### Font loading and Uthmani variant selection

- Uses `useFonts` from Skia for both:
  - `DigitalKhattV1: DigitalKhattQuranicV1.otf`
  - `DigitalKhattV2: DigitalKhattV2.otf`
- Active family is selected from Mushaf settings:
  - `uthmaniFont === 'v1' ? 'DigitalKhattV1' : 'DigitalKhattV2'`
- rendering waits until font manager exists

### Geometry and scaling

- derives content area from screen dimensions and fixed paddings
- computes:
  - `scale = CONTENT_WIDTH / PAGE_WIDTH`
  - `margin = MARGIN * scale`
  - `lineWidth = CONTENT_WIDTH - 2 * margin`
  - `fontSize = FONTSIZE * scale * 0.9`
  - `fontSizeLineWidthRatio = fontSize / lineWidth`

`fontSizeLineWidthRatio` is the cache identity for layout persistence.

### Layout resolution strategy

1. `useState` initializer calls `getCachedPageLayout()` — synchronous check of in-memory then MMKV
2. `useEffect` fallback: if no cached result and `fontMgr` is ready, compute on-demand (first launch only)

No async storage, no pre-warming, no module-level shared state.

### Line mapping behavior

- page lines are from `digitalKhattDataService.getPageLines(pageNumber)`
- skips lines where `line_type === 'surah_name'`
- computes line vertical slots via:
  - `interLine = CONTENT_HEIGHT / pageLines.length`
- applies line-width-ratio centering compensation:
  - `lineMargin += (lineWidth - lineWidth * ratio) / 2` for ratio != 1

## `SkiaLine` Responsibilities

File: `components/mushaf/skia/SkiaLine.tsx`

### Paragraph setup

- `TextDirection.RTL`
- `TextHeightBehavior.DisableAll`
- base style:
  - font family `DigitalKhatt`
  - font size `justResult.fontSizeRatio * fontSize`
  - text color from theme

Special case:

- if line is basmallah (`lineType === 2`) and page is not 1/2:
  - adds font feature `{name: 'basm', value: 1}`

### Character loop, tajweed coloring, and feature injection

For each word, for each character:

- lookup `justResult.fontFeatures.get(indexInLine)`
- lookup `charToRule?.get(indexInLine)` for tajweed rule color
- if features exist:
  - push style with `fontFeatures`
  - add one character
  - pop style
- if tajweed rule exists and has a color in `constants/tajweedColors.ts`:
  - apply `charStyle.color = Skia.Color(tajweedColors[rule])`
- else add character with base style

This is how line-level justification is translated into glyph-level shaping changes.

### Tajweed map handoff (`SkiaPage` -> `SkiaLine`)

`SkiaPage` computes one char-to-rule map per line:

- if `showTajweed` is off or indexed tajweed data is unavailable -> no map
- otherwise `getLineTajweedMap(pageNumber, lineIndex, indexedTajweedData)`
- map value is passed to `SkiaLine` as `charToRule`

`getLineTajweedMap` bridges:

1. Digital Khatt line words (`first_word_id..last_word_id`)
2. each word's verse metadata (`verseKey`, `wordPositionInVerse`)
3. indexed tajweed segments for that verse
4. per-segment rule -> per-character index mapping

### Space handling

After each word, if a trailing space exists:

- check `lineTextInfo.spaces.get(wordEnd + 1)`
- set `letterSpacing` from:
  - `justResult.ayaSpacing` for Aya space
  - `justResult.simpleSpacing` for Simple space
- values are normalized by `scale` relative to `SPACEWIDTH`

### Positioning (x-axis)

- `maxWidth = pageWidth * 2`
- paragraph is laid out to `maxWidth`
- x-position uses negative offset to right-align RTL content inside wide layout box

Modes:

- centered:
  - surah names (lineType 1) and basmallah (except page 1/2)
- justified:
  - all other ayah lines

## Why `maxWidth = pageWidth * 2`

Using a wider paragraph layout box makes RTL alignment behavior predictable in Skia and supports negative x-offset alignment strategy without clipping line geometry.

## Surah Header Overlay Path

File: `components/mushaf/main.tsx` (`UthmaniPageView`)

- iterates page lines
- for `surah_name` only:
  - maps surah number to glyph string from `SURAH_HEADERS.json`
  - draws RN `Text` using `SURAH_HEADERS` font
  - uses same interline math so overlay aligns with Skia line slots

## Verse Selection and Highlight Pipeline

This is the long-press flow used by Uthmani/Digital Khatt pages.

### End-to-end interaction flow

1. `SkiaPage` installs `Gesture.LongPress().minDuration(400)`.
2. On press start (worklet), `runOnJS(handleLongPress)(event.x, event.y)`.
3. `handleLongPress` converts screen coordinates into canvas coordinates by removing page paddings.
4. It resolves `lineIndex` via `findLineAtY(canvasY)` using line slot boundaries.
5. It gets that line's `SkParagraph` and x-offset from `paragraphMapRef`.
6. It converts to paragraph-local coordinates and calls:
   - `paragraph.getGlyphPositionAtCoordinate(paragraphX, paragraphY)`
7. It resolves the verse by character index:
   - `mushafVerseMapService.findVerseAtCharIndex(page, lineIndex, charIndex)`
8. If found:
   - haptic feedback
   - persist selection in Zustand (`selectedVerseKey`, `selectedPageNumber`)
   - open `mushaf-verse-actions` sheet with verse payload
9. `SkiaPage` computes per-line highlight ranges for the selected verse:
   - `mushafVerseMapService.getVerseSegmentsForPage(page, selectedVerseKey)`
10. `SkiaLine` applies `highlightColor` for character indices inside the selected range.

### How `MushafVerseMapService` resolves verse boundaries

For each `(page, line)`:

- reads DK line metadata from `DigitalKhattDataService`
- reconstructs tokenized line info from `QuranTextService.analyzeText(...)`
- walks words in `first_word_id..last_word_id`
- groups contiguous words that share the same `verseKey`
- stores each group as:
  - `startCharIndex`, `endCharIndex`
  - `firstWordId`, `lastWordId`
  - `surahNumber`, `ayahNumber`, `verseKey`

`findVerseAtCharIndex` then returns the segment whose char interval contains the hit index.

### Worked Example (single-line selection)

Assume:

- line text (simplified): `"A B C D"`
- computed word spans:
  - `A`: chars `0..0`, verse `2:255`
  - `B`: chars `2..2`, verse `2:255`
  - `C`: chars `4..4`, verse `2:256`
  - `D`: chars `6..6`, verse `2:256`

`MushafVerseMapService` builds segments:

- `2:255` => `start=0`, `end=2` (A+B including spacing boundary behavior from tokenization)
- `2:256` => `start=4`, `end=6` (C+D)

If long-press resolves `charIndex=5`, selection resolves to `2:256`.

Highlight pass asks for all `2:256` segments on the page, then `SkiaLine` colors chars in those ranges with `highlightColor`.

## Render-Time Performance Notes

- `SkiaPage` and `SkiaLine` are wrapped with `React.memo`.
- expensive per-line paragraph creation is in `useMemo`.
- avoid changing prop identity unnecessarily for `justResult` and geometry props.
- MMKV precomputed layouts guarantee <1ms page access after first launch.

## What to Inspect for Visual Misalignment

- `PAGE_PADDING_*` constants in `SkiaPage.tsx`
- `fontSize` scale factor (`* 0.9`)
- `interLine` derivation based on page line count
- `lineWidthRatio` adjustment path
- x-position formula in `SkiaLine` (centered vs justified branches)
