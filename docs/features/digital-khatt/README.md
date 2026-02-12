# Digital Khatt Documentation Hub

This folder is the implementation source of truth for Bayaan's Uthmani Mushaf renderer (Digital Khatt path).

If you are a new developer (or an AI agent), read these files in order:

1. `architecture.md` - system boundaries, ownership, and lifecycle
2. `data-pipeline.md` - SQLite assets, in-memory models, and page/surah mapping
3. `rendering-pipeline.md` - page/line rendering flow from React to Skia
4. `justification-engine.md` - Kashida/feature expansion logic in `JustificationService`
5. `debugging-playbook.md` - symptom-based troubleshooting and instrumentation
6. `development-guide.md` - safe change workflow, performance constraints, and checklists

## TL;DR

- Uthmani pages are rendered with Skia (`SkiaPage` + `SkiaLine`) using `DigitalKhattV2.otf`.
- Text and page layout come from two bundled SQLite assets loaded by `DigitalKhattDataService`.
- Per-line justification is computed by `JustService`:
  - tiny space adjustments,
  - then OpenType feature expansion (`cv01`, `cv02`, `cv03`, `cv10`..`cv18`, `basm`),
  - then final spacing fill,
  - or font-size shrink if line overflows.
- Results are cached in AsyncStorage keys prefixed with `dk_layout_`.
- `surah_name` rows are intentionally not Skia-rendered; they are RN `Text` overlays using `SURAH_HEADERS`.

## Primary Source Files

- `components/mushaf/main.tsx`
- `components/mushaf/skia/SkiaPage.tsx`
- `components/mushaf/skia/SkiaLine.tsx`
- `services/mushaf/DigitalKhattDataService.ts`
- `services/mushaf/QuranTextService.ts`
- `services/mushaf/JustificationService.ts`
- `services/AppInitializer.ts`

## Responsibilities at a Glance

- `DigitalKhattDataService`: loads and serves words/layout data.
- `QuranTextService`: provides line text, line metadata, tokenization, and base-letter analysis.
- `JustService`: computes per-line width fit and char-level OpenType features.
- `SkiaPage`: page-level orchestration and cache lookup.
- `SkiaLine`: paragraph construction and final draw instructions.

## Non-Goals (Important)

- This system does not render surah ornaments in Skia.
- This system does not do ayah-level playback sync/highlighting yet.
- This system does not fetch network data for Mushaf rendering.

