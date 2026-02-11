# Digital Khatt Rendering

This document explains how the Uthmani Mushaf (Digital Khatt) is rendered in Bayaan, from bundled data to final Skia drawing.

## High-Level Flow

1. `MushafViewer` detects Uthmani mode and initializes `digitalKhattDataService`.
2. `DigitalKhattDataService` loads:
   - `digital-khatt-v2.db` for all word texts
   - `digital-khatt-15-lines.db` for page/line layout metadata
3. `UthmaniPageView` renders:
   - `SkiaPage` for ayah + basmallah lines
   - surah headers as overlay `Text` using `SURAH_HEADERS` font
4. `SkiaPage` computes per-line justification via `JustService`.
5. `SkiaLine` shapes and paints each line using Skia `Paragraph`, applying OpenType features per character.

## Data Layer

### `DigitalKhattDataService`

This service is the source of truth for Digital Khatt page content:

- `getPageLines(pageNum)` returns 15-line page structure and line types.
- `getLineText(line)` reconstructs line text by joining word IDs from `first_word_id..last_word_id`.
- Builds `surahStartPages` and `pageToSurah` mappings from `surah_name` lines.

Line types in DB:

- `surah_name`: title row (not drawn by Skia line engine)
- `basmallah`: basmallah row
- `ayah`: normal Quran text row

## Text Analysis Layer

### `QuranTextService`

This service prepares each line for shaping/justification:

- `getLineText(page, lineIndex)`: fetches cached line text.
- `analyzeText(page, lineIndex)`: tokenizes words, records word start/end indices, and classifies spaces:
  - `SpaceType.Simple`
  - `SpaceType.Aya` (before ayah marker context)
- `getLineInfo(page, lineIndex)`: maps line type + special width ratios for specific Madani pages.
- `isLastBase(text, index)`: checks if a character is the last base Arabic letter in the word (ignores marks).

## Justification and Kashida Layer

### `JustService`

`JustService` performs line width fitting in this order:

1. Measure words and full line width with `DigitalKhatt` font.
2. If line is short:
   - Stretch spaces first (`simple` and `ayah` with different maxima).
   - Apply kashida/alternate feature lookups (`cv01`, `cv02`, `cv03`, `cv10`, `cv11`..`cv18`) to widen glyph shapes.
   - If needed, distribute final leftover width back into spaces.
3. If line is long:
   - Shrink by reducing `fontSizeRatio`.

The output for each line:

- `fontFeatures`: `Map<charIndex, SkTextFontFeatures[]>`
- `simpleSpacing`
- `ayaSpacing`
- `fontSizeRatio`

Results are cached in AsyncStorage per `fontSizeLineWidthRatio` key (`dk_layout_*`).

## Rendering Layer (Skia)

### `SkiaPage`

- Loads `DigitalKhattV2.otf` through `useFonts`.
- Computes page scale from device width and Digital Khatt reference constants.
- Retrieves cached line layout (`JustService.getLayoutFromStorage`) or computes on demand (`getPageLayout`).
- Renders a Skia `Canvas` and maps each renderable line to `SkiaLine`.

### `SkiaLine`

For each line:

- Builds a Skia `Paragraph` in RTL direction.
- Iterates each character and applies per-char `fontFeatures` from `JustResultByLine`.
- Injects per-space letter spacing based on `simpleSpacing` or `ayaSpacing`.
- Centers surah/basmallah style lines where required; justifies ayah lines to page margins.
- Draws with `<Paragraph ... />`.

## Why Surah Headers Are Not in Skia Lines

`surah_name` lines are intentionally skipped in `SkiaPage` and rendered as overlay React Native `Text` with `SURAH_HEADERS` glyph font. This keeps title ornament rendering separate from ayah shaping logic.

## What This Means

Digital Khatt rendering in Bayaan is not static text drawing. It is a shaping pipeline that:

- reconstructs canonical line text from SQLite word/layout databases,
- analyzes each line's linguistic structure (words/base letters/spaces),
- computes feature-level glyph alternates for kashida-style expansion,
- and paints final lines with per-character OpenType control in Skia.

---

## `finalIsolAlternates` Explained

In `JustificationService`:

```ts
const finalIsolAlternates = 'ىصضسشفقبتثنكيئ';
```

This is a whitelist of letters that have special final/isolated alternate behavior in the Digital Khatt font and should be protected in one kashida path.

Where it is used:

- Inside `generalKashidaLookup.condition(...)`
- Only for the matched `k5` character
- If that character:
  1. is in `finalIsolAlternates`, and
  2. is the last base letter in the word (`isLastBase(...)`)
  then the lookup returns `false` and skips applying that kashida action.

Practical effect:

- Prevents stretching this specific class of letters when they are at the word end (final/isolated position).
- Avoids visually incorrect or overly stretched terminal glyph forms.

So the constant is effectively a "do-not-apply-this-kashida-on-final-form-for-these-letters" guard list.
