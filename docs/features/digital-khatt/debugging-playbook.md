# Digital Khatt Debugging Playbook

Use this guide when Digital Khatt rendering is blank, misaligned, slow, or visually incorrect.

## Fast Triage (2 minutes)

1. Confirm mode:
   - ensure you are in Uthmani path (not Indopak).
2. Confirm data init:
   - look for `DigitalKhattDataService` success logs.
3. Confirm font load:
   - `SkiaPage` should leave loading state.
4. Confirm layout cache:
   - stale `dk_layout_*` entries can keep old behavior.
5. Confirm line types:
   - `surah_name` lines are expected overlays, not Skia text lines.

## Symptom -> Likely Cause

### Blank Uthmani page (spinner never ends)

Likely causes:

- `digitalKhattDataService.initialize()` failed
- `DigitalKhatt` font failed to load in `SkiaPage`
- `JustService` layout resolution not completing

Checks:

- console for `[DigitalKhattDataService] Initialization failed:`
- ensure DB assets exist in `data/mushaf/digitalkhatt/`
- add temporary log in `SkiaPage` effect before/after cache fetch and computation

### Ayah lines render but surah headers missing

Likely causes:

- `SURAH_HEADERS` font not loaded
- missing glyph mapping in `SURAH_HEADERS.json`

Checks:

- `loadSurahHeaderFont()` success path in `components/mushaf/main.tsx`
- verify key `surah-${surahNumber}` exists in `SURAH_HEADERS.json`

### Text overlaps or drifts horizontally

Likely causes:

- bad `xPos` branch in `SkiaLine`
- wrong page width/margin scale
- incorrect line width ratio override

Checks:

- log `currLineWidth`, `pageWidth`, `margin`, `xPos`
- inspect `quranTextService.getLineInfo(page,line).lineWidthRatio`

### Last word in line looks malformed

Likely causes:

- final-form guard in `generalKashidaLookup` changed
- `matchingCondition()` regression

Checks:

- inspect `finalIsolAlternates`
- confirm `quranTextService.isLastBase()` behavior for affected word

### Only some pages are wrong

Likely causes:

- page-specific `madinaLineWidths` override mismatch
- data mismatch in layout DB for those pages

Checks:

- inspect page 1/2 and tail-page ratios in `QuranTextService`
- inspect corresponding rows in `dk_layout.db` `pages` table

### Changes to justification code have no effect

Likely causes:

- cached layouts still being reused

Actions:

1. call `JustService.removeLayouts()`
2. restart app
3. verify `getLayoutFromStorage` returns undefined on first load

## Instrumentation Snippets

Use temporary logs and remove after debugging.

### `SkiaPage` cache path

```ts
console.log('[DK] computeLayout start', { pageNumber, fontSizeLineWidthRatio });
const cached = await JustService.getLayoutFromStorage(fontSizeLineWidthRatio);
console.log('[DK] cache hit?', Boolean(cached && cached[pageNumber - 1]));
```

### `JustService` line summary

```ts
console.log('[DK Justify]', {
  pageNumber: this.pageNumber,
  lineIndex: this.lineIndex,
  desiredWidth,
  currentLineWidth,
  diff: desiredWidth - currentLineWidth,
});
```

### `SkiaLine` placement

```ts
console.log('[DK Line]', {
  pageNumber,
  lineIndex,
  lineType: lineInfo.lineType,
  currLineWidth,
  pageWidth,
  xPos,
});
```

## SQLite Validation Steps

When debugging data issues:

1. Confirm runtime DB has expected tables (`words`, `pages`).
2. Confirm row counts are plausible.
3. Check a failing page:
   - all 15 line rows present (or expected count for that asset)
   - `first_word_id/last_word_id` valid
4. Validate a failing line's words reconstruct as expected.

## Cache and State Reset Procedure

Use this order:

1. call `JustService.removeLayouts()`
2. clear app data if necessary (simulator/device)
3. restart app
4. navigate to Mushaf page again

Reason:

- line layout persistence is keyed by ratio, so small geometry differences can create multiple cached generations.

## Performance Profiling Checklist

- first-load page time (no cache)
- warm-load page time (cache hit)
- horizontal page swipe smoothness
- memory growth while paging many screens
- CPU spikes during first render of uncached pages

If first-load is too slow:

- precompute via `JustService.saveAllLayouts(...)` in controlled flow
- consider prewarming key page ranges
- avoid unnecessary re-renders of `SkiaLine`

## "Do Not Do This" List

- do not tweak lookup order blindly.
- do not change regex without validating named groups still align with actions.
- do not ship with debug logs in render hot paths.
- do not trust visual checks on one page only; test multiple difficult pages.

## Regression Test Pages

Always verify at least:

- pages `1`, `2` (special opening layout)
- pages `600`, `602`, `603`, `604` (special width ratios)
- one mid-Mushaf dense text page (for kashida pressure)
- one page with multiple surah headers (overlay alignment)

