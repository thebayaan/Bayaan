# Continuous Scroll Mushaf — Design Document

**Date:** 2026-03-04
**Status:** Approved

## Summary

Replace the current horizontal page-swipe mushaf with a single continuous vertical scroll experience. One scroll from the first ayah of Al-Fatiha to the last ayah of An-Nas. Two sub-modes: Mushaf Scroll (Skia pages stitched seamlessly) and Verse Scroll (flowing text that adapts based on translation toggle).

## Mode Architecture

Continuous scroll is the only reading experience. No page-swipe mode exists.

### Two Sub-Modes

| Mode | Content | Translation | Verse Interaction |
|------|---------|-------------|-------------------|
| **Mushaf Scroll** | 604 Skia pages stitched vertically | No | Long-press drag to select range |
| **Verse Scroll** | 6,236 verses as continuous list | Adapts layout | Tap to select single verse |

### Verse Scroll Layout Adapts Based on Translation Toggle

- **Translation OFF (Inline Flow):** Arabic text flows as continuous RTL paragraphs. Verse-end markers (۝ with Arabic numeral) appear inline. Surah dividers are the only structural breaks. No page numbers. Clean reading experience.
- **Translation ON (Stacked Cards):** Each verse is a VerseItem card (verse number + Arabic + translation + optional transliteration). Surah dividers between surahs. Ultra-subtle page number markers at mushaf page boundaries.

### Settings Store Change

Replace `viewMode: 'mushaf' | 'reading'` with `scrollMode: 'mushaf' | 'verse'`. Mode is selected in mushaf settings (accessible from within the mushaf screen).

## Navigation

All navigation is page-aware. The page concept is an internal coordinate system.

1. User picks a target (surah from search, verse from bookmark, last read, etc.)
2. System resolves to a verse key (e.g., `'2:142'`)
3. **Mushaf scroll:** verse key → page number → FlashList index (page item) → `scrollToIndex`
4. **Verse scroll:** verse key → FlashList index (verse/chunk item) → `scrollToIndex`

### Last Read

Single verse key stored (e.g., `'2:142'`). On resume, scrolls to that verse regardless of mode. No separate "mushaf last read" vs "scroll last read" — one source of truth.

### Recent Reads (Chains)

Same concept as current — array of verse keys instead of page numbers. Jump to any recent read scrolls to that verse.

## Visual Design

### Mushaf Scroll Mode

Zero visual breaks between pages. Skia canvases rendered flush — no page numbers, no dividers between pages, no card boundaries, no spacing. One continuous river of mushaf text.

The only visual breaks are surah headers (ornamental dividers already rendered within the Skia text as part of the mushaf layout).

### Verse Scroll — Translation OFF (Inline Flow)

Arabic text flows as continuous RTL paragraphs within page-sized chunks. Verse-end markers (۝١) appear inline within the text. Surah dividers appear between surahs. No page numbers.

### Verse Scroll — Translation ON (Stacked Cards)

Each verse is a VerseItem component card. Surah dividers between surahs. Ultra-subtle page number markers at mushaf page boundaries:
- Style: `· 42 ·` centered
- Font: `Manrope-Regular`, `ms(10)`
- Color: `Color(theme.colors.text).alpha(0.15)`
- Spacing: ~8pt padding above and below (whisper-thin)

### Header Bar

```
← Back   Al-Baqarah · p.5     ⚙
         Juz 1
```

- Dynamically updates surah name + page number of topmost visible verse
- Juz indicator in secondary text
- Settings gear opens mushaf settings
- Search icon opens MushafSearchView
- Hides/shows on tap (immersive mode, same as current)

### Immersive Mode

Tap anywhere to toggle header + player bar visibility. Same behavior as current.

## Playback Integration

### Auto-Scroll

- During ayah-by-ayah playback, scroll smoothly follows the current verse
- Playing verse positioned ~30% from top of screen
- If user manually scrolls away, auto-scroll re-engages after 3 seconds of no touch

### Verse Highlighting

- **Mushaf scroll:** Subtle background overlay on Skia canvas (same as current)
- **Verse scroll (inline):** Background highlight on the current verse text within paragraph
- **Verse scroll (stacked):** Highlighted border/background on verse card

## Technical Architecture

### Rendering Engine: FlashList

Single vertical FlashList replaces the current horizontal FlatList. Virtualization handles all modes efficiently.

### FlashList Item Types Per Mode

**Mushaf Scroll:**

| Type | Count | Height |
|------|-------|--------|
| `mushaf-page` | 604 | Fixed (canvas height) |

**Verse Scroll (translation OFF):**

| Type | Count | Height |
|------|-------|--------|
| `surah-divider` | 114 | ~60pt |
| `paragraph-chunk` | ~604 | Variable (wrapped text) |

Each `paragraph-chunk` contains one mushaf page's worth of verses rendered as a flowing RTL paragraph with inline verse markers.

**Verse Scroll (translation ON):**

| Type | Count | Height |
|------|-------|--------|
| `surah-divider` | 114 | ~60pt |
| `verse-item` | 6,236 | Variable |
| `page-marker` | ~604 | ~24pt |

### Position Tracking

- `onViewableItemsChanged` detects topmost visible item
- Map item → verse key → page number → surah name
- Update header display (debounced 200ms)
- Save last-read verse key to store on blur/background

### Position Sync Between Modes

When switching modes, track the currently visible verse key and scroll to that verse in the new mode.

### Performance

- `estimatedItemSize`: calibrated per mode
- `windowSize={7}` (render ±3.5 screens)
- `maxToRenderPerBatch={3}`
- Skia canvases wrapped in `React.memo`
- MushafLayoutCacheService provides pre-computed heights for mushaf pages

## Key Files to Modify/Create

### Modify
- `components/mushaf/main.tsx` — Replace horizontal FlatList with vertical FlashList, mode switching logic
- `store/mushafSettingsStore.ts` — Replace `viewMode` with `scrollMode`
- `components/mushaf/MushafSearchView.tsx` — Navigation resolves to verse key + scroll position
- `hooks/useMushafAutoPageTurn.ts` → Rename/refactor to `useMushafAutoScroll.ts`
- `components/MushafSettingsContent.tsx` — Update mode toggle UI

### Create
- `components/mushaf/continuous/ContinuousMushafScroll.tsx` — Main vertical FlashList wrapper
- `components/mushaf/continuous/ParagraphChunk.tsx` — Inline flow paragraph block
- `components/mushaf/continuous/PageMarker.tsx` — Subtle page number marker
- `utils/continuousScrollData.ts` — Build FlashList data arrays for each mode
