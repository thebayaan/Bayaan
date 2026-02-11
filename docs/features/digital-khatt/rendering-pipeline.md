# Digital Khatt Rendering Pipeline

This document traces one page render from `MushafViewer` to final Skia draw calls.

## End-to-End Flow

1. `MushafViewer` selects Uthmani mode.
2. `UthmaniPageView` mounts for the target page.
3. `SkiaPage` loads `DigitalKhatt` font and retrieves page lines.
4. `SkiaPage` resolves per-line `JustResultByLine[]`:
   - load cached layout from AsyncStorage/memory, or
   - compute on demand via `JustService.getPageLayout`.
5. `SkiaPage` maps each non-`surah_name` line to `SkiaLine`.
6. `SkiaLine` builds a `Paragraph`:
   - text direction RTL
   - per-char OpenType features from justification map
   - per-space letterSpacing based on space type
7. `SkiaLine` computes x-position (centered vs justified) and renders `<Paragraph />`.
8. `UthmaniPageView` overlays surah header text (RN `Text` with `SURAH_HEADERS` font).

## `SkiaPage` Responsibilities

File: `components/mushaf/skia/SkiaPage.tsx`

### Font loading

- Uses `useFonts` from Skia for:
  - `DigitalKhatt: DigitalKhattV2.otf`
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

Effect workflow:

1. call `JustService.getLayoutFromStorage(fontSizeLineWidthRatio)`
2. if layout exists for this page -> use cached page result
3. else call `JustService.getPageLayout(...)` and set local state

Cancellation guard avoids state updates on unmount/page switch.

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

### Character loop and feature injection

For each word, for each character:

- lookup `justResult.fontFeatures.get(indexInLine)`
- if features exist:
  - push style with `fontFeatures`
  - add one character
  - pop style
- else add character with base style

This is how line-level justification is translated into glyph-level shaping changes.

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

## Render-Time Performance Notes

- `SkiaPage` and `SkiaLine` are wrapped with `React.memo`.
- expensive per-line paragraph creation is in `useMemo`.
- avoid changing prop identity unnecessarily for `justResult` and geometry props.
- precomputed layouts (AsyncStorage + memory) are critical for smooth page transitions.

## What to Inspect for Visual Misalignment

- `PAGE_PADDING_*` constants in `SkiaPage.tsx`
- `fontSize` scale factor (`* 0.9`)
- `interLine` derivation based on page line count
- `lineWidthRatio` adjustment path
- x-position formula in `SkiaLine` (centered vs justified branches)

