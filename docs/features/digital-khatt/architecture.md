# Digital Khatt Architecture

This document explains where Digital Khatt fits in the app, how it initializes, and which modules own each part of the rendering pipeline.

## Scope

Digital Khatt applies only to the Uthmani Mushaf mode (`arabicFontFamily !== 'Indopak'`).

Main entrypoint:

- `components/mushaf/main.tsx`

Core implementation:

- `services/mushaf/DigitalKhattDataService.ts`
- `services/mushaf/QuranTextService.ts`
- `services/mushaf/JustificationService.ts`
- `components/mushaf/skia/SkiaPage.tsx`
- `components/mushaf/skia/SkiaLine.tsx`

## Runtime Topology

At runtime, the stack is:

1. `MushafViewer` decides Uthmani vs Indopak.
2. In Uthmani mode, `UthmaniPageView` renders:
   - `SkiaPage` for ayah + basmallah rows
   - RN `Text` overlay for surah headers (`surah_name` rows)
3. `SkiaPage` obtains page lines from `DigitalKhattDataService`.
4. `SkiaPage` fetches per-line justification from `JustService` cache or computes it.
5. Each line is drawn by `SkiaLine` as a Skia `Paragraph` with per-char feature overrides.

## Initialization Lifecycle

Digital Khatt data is initialized in two places:

- App-wide preload:
  - `services/AppInitializer.ts` registers "DigitalKhatt Data" (priority 5, non-critical).
- Feature-level guard:
  - `components/mushaf/main.tsx` also calls `digitalKhattDataService.initialize()` when entering Uthmani mode if needed.

Why both:

- App initializer improves warm startup for Mushaf.
- Local guard ensures Mushaf still works if app initializer is skipped/partial.

## Data Ownership

- SQLite assets are bundled in `data/mushaf/digitalkhatt/`.
- `DigitalKhattDataService` owns:
  - word map: `Map<number, string>`
  - page line map: `Map<number, DKLine[]>`
  - surah mappings:
    - `surahStartPages`
    - `pageToSurah`

`QuranTextService` is pure derivation over `DigitalKhattDataService`:

- caches line text and tokenization
- classifies spaces (Simple/Aya)
- computes line metadata (`lineType`, `lineWidthRatio`, `isCentered`)

## Rendering Ownership

- `SkiaPage` owns page-level dimensions, scale, and layout retrieval strategy.
- `SkiaLine` owns paragraph construction and x/y placement.
- `JustService` owns width-fitting and OpenType feature decisions.

This split is deliberate:

- UI components do not encode shaping rules.
- shaping/justification code is reusable and testable independent of React rendering.

## Why Surah Headers Are Overlays

`surah_name` rows are skipped by Skia and drawn with RN `Text` using `SURAH_HEADERS` font.

Rationale:

- ornamental surah glyphs are a separate visual system from ayah shaping
- keeps justification engine focused only on Quran body text and basmallah behavior

## Cache Layers

There are three caching layers:

1. `DigitalKhattDataService` in-memory maps for words/layout.
2. `QuranTextService` in-memory caches for line text and line tokenization.
3. `JustService` cache:
   - in-memory static map: `cachedLayouts`
   - persisted AsyncStorage entries keyed by `dk_layout_${fontSizeLineWidthRatio}`.

## Threading and Async Model

- DB imports and reads are async (Expo SQLite).
- justification in `SkiaPage` runs in React effect (async boundary with cancellation flag).
- Skia paragraph shaping occurs synchronously inside render-time memoization (`useMemo` in `SkiaLine`).

## System Invariants

These assumptions must hold for correct rendering:

- `digitalKhattDataService.initialize()` has completed before requesting page text.
- layout DB rows are ordered by `(page_number, line_number)`.
- word IDs in line rows are contiguous and valid (`first_word_id..last_word_id`).
- page line count is non-zero for valid pages.
- `DigitalKhatt` font is loaded before `SkiaPage` computes/uses layout.

## Known Design Trade-offs

- `SkiaPage` computes line spacing as `CONTENT_HEIGHT / pageLines.length` (actual line count driven by DB rows).
- space-stretch limits in `JustService` are tiny, so most expansion comes from feature-level stretching (kashida-like alternates).
- some line width ratios are hardcoded in `QuranTextService` for specific pages and lines.

## Where to Change What

- Change data import behavior -> `DigitalKhattDataService.ts`
- Change space classification/tokenization -> `QuranTextService.ts`
- Change kashida/feature logic -> `JustificationService.ts`
- Change layout scaling/padding -> `SkiaPage.tsx`
- Change per-char draw behavior -> `SkiaLine.tsx`
- Change surah header overlay behavior -> `components/mushaf/main.tsx`

