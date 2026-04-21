# Digital Khatt Development Guide

This guide explains how to safely make changes to Digital Khatt and avoid regressions.

## Before You Edit

Read in this order:

1. `README.md`
2. `architecture.md`
3. `justification-engine.md`

Then identify your change category:

- Data-level change (DB assets, line metadata)
- Text-analysis change (space rules, base letters)
- Justification change (lookup/features/conditions)
- Rendering change (scale, margins, placement)

## Change Surface Map

### Data changes

Files:

- `services/mushaf/DigitalKhattDataService.ts`
- `data/mushaf/digitalkhatt/*.db`

Risk:

- page text corruption or missing lines

Validation:

- initialization succeeds
- words and layout counts stable
- page-to-surah mapping still valid

### Text-analysis changes

Files:

- `services/mushaf/QuranTextService.ts`

Risk:

- wrong space classification
- wrong base-letter terminal detection

Validation:

- check line tokenization for representative lines
- verify aya/simple spacing behavior visually

### Justification changes

Files:

- `services/mushaf/JustificationService.ts`

Risk:

- calligraphy regressions, width overshoot, per-page visual drift

Validation:

- clear cached layouts
- compare before/after on reference pages
- verify no overflow and no excessive compression

### Rendering changes

Files:

- `components/mushaf/skia/SkiaPage.tsx`
- `components/mushaf/skia/SkiaLine.tsx`
- `components/mushaf/main.tsx` (surah overlays)

Risk:

- misalignment, clipping, wrong centering

Validation:

- test compact and non-compact devices
- test both dark/light text colors
- verify surah header y-alignment with line slots

## Required Validation Workflow

After any non-trivial change:

1. Run formatter on changed files.
2. Type-check (`npx tsc --noEmit`).
3. Clear Digital Khatt layout cache (`JustService.removeLayouts()`).
4. Launch app and inspect regression pages:
   - 1, 2, 600, 602, 603, 604
5. Compare:
   - inter-word spacing consistency
   - terminal glyph forms
   - centered basmallah/surah behavior
6. Re-open a previously visited page to verify warm-cache behavior.

## Suggested PR Checklist

- [ ] explains why change is needed
- [ ] lists touched subsystem (`data`, `analysis`, `justify`, `render`)
- [ ] includes screenshots before/after (same device)
- [ ] confirms cache reset was done during validation
- [ ] confirms tested pages: `1`, `2`, `600`, `602`, `603`, `604`
- [ ] confirms no new TypeScript/lint issues

## Common Extension Tasks

### Add a new guarded lookup in `JustService`

1. Add regex and named groups.
2. Add `actions` for each group.
3. Add `matchingCondition`/`condition` guards if needed.
4. Insert in the correct order in `stretchLine()`.
5. Validate with cache cleared and side-by-side screenshots.

### Tune line width behavior for special pages

1. Update `madinaLineWidths` in `QuranTextService`.
2. Verify affected page/line pairs.
3. Validate no unintended change on neighboring lines/pages.

### Change top/bottom/page paddings

1. Update constants in `SkiaPage.tsx` and ensure overlay path in `main.tsx` still aligns.
2. Validate both compact and regular-height devices.

## Performance Guardrails

- avoid introducing allocations in per-character loops unless necessary.
- keep `SkiaLine` memo dependencies stable.
- do not force recompute layout on every render.
- rely on persistent cache for repeated page views.
- if adding logs in hot paths, guard behind debug flags and remove before merge.

## Cache Semantics (Do Not Miss)

Layout cache key is derived from `fontSizeLineWidthRatio`.

Implications:

- small geometry changes can generate new cache buckets
- old buckets remain unless removed
- stale caches can mask code changes during manual testing

When in doubt, clear all `dk_layout_*` keys before judging output.

## AI Agent Handoff Notes

If an AI agent is asked to edit Digital Khatt:

1. read this folder fully before editing.
2. never guess lookup order; verify in `JustificationService`.
3. include explicit cache-reset step in testing notes.
4. provide impacted-page list in final summary.
5. treat visual regressions as high severity even if type checks pass.

