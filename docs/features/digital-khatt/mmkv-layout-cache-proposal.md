# MMKV-Based Full Mushaf Layout Precomputation

**Status:** Implemented
**Last updated:** 2026-02-11
**Implementation files:**
- `services/mushaf/MushafLayoutCacheService.ts` — singleton service, MMKV read/write, precomputation
- `services/mushaf/JustificationService.ts` — `getCachedPageLayout()` checks in-memory then MMKV
- `components/mushaf/skia/SkiaPage.tsx` — simplified layout resolution (no async, no pre-warming)
- `components/mushaf/main.tsx` — simplified surah navigation (no precompute call)
- `services/AppInitializer.ts` — registers cache service at priority 8

---

## Summary

All 604 Uthmani page layouts are precomputed once per font family (DigitalKhattV1, DigitalKhattV2) and stored in MMKV. Every subsequent page access is a synchronous MMKV read (~0.01-0.1ms) + JSON parse (~0.5-1ms). No computation on the render path after first launch.

## Architecture

### MMKV Key Schema

```
"dk:{fontFamily}:{pageNumber}"     → JSON string of JustResultByLine[]
"dk_complete:{fontFamily}"         → "true" when all 604 pages stored
"dk_schema_version"                → number for cache invalidation
```

### Cache Layers (checked in order by `getCachedPageLayout`)

1. **In-memory `pageLayoutsCache`** — Map, ~0.001ms
2. **MMKV** — synchronous read, ~1ms (on MMKV hit, also populates in-memory cache)
3. **On-demand compute** — `JustService.getPageLayout()`, 20-100ms (first-launch fallback only)

### Precomputation Flow

`MushafLayoutCacheService.initialize()` (called by AppInitializer, priority 8, non-critical):

1. Check `dk_complete:{activeFontFamily}` in MMKV
2. If incomplete, create `SkTypefaceFontProvider` outside React via Skia API
3. Loop pages 1-604, compute via `JustService.getPageLayout()`, write each to MMKV
4. Yield every 10 pages (`setTimeout(0)`) to avoid blocking UI
5. Set completion flag, then repeat for the other font family

### Font Provider Creation Outside React

```typescript
const uri = Image.resolveAssetSource(require('@/data/mushaf/...otf')).uri;
const data = await Skia.Data.fromURI(uri);
const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
const fontMgr = Skia.TypefaceFontProvider.Make();
fontMgr.registerFont(typeface, fontFamily);
```

### Serialization

Uses exported `replacer`/`reviver` from `JustificationService.ts` to handle `Map` serialization in JSON.

## What Was Removed

- `SkiaPage`: module-level `sharedFontMgr`/`sharedFontFamily`/`sharedFontSizeLineWidthRatio`, `precomputePageLayout()` export, `justResultsPageRef`, pre-warming effect, async storage fallback
- `JustificationService`: `saveAllLayouts`, `saveLayoutToStorage`, `getLayoutFromStorage`, `prewarmPageRange`, `removeLayouts`, `storageMisses` set, `cachedLayouts` map, AsyncStorage import
- `main.tsx`: `precomputePageLayout` import and call in `navigateToSurah`

## Performance

| Metric | Before | After |
|--------|--------|-------|
| Per-page cache read (memory) | ~0.001ms | ~0.001ms |
| Per-page cache read (storage) | 5-15ms (AsyncStorage, async) | ~1ms (MMKV, sync) |
| Cold-start first page | 20-100ms | <1ms (after first launch) |
| Surah jump (far) | ~10ms | <1ms |
| First launch overhead | None | ~15-45s background |
| Total storage | ~300KB-1.2MB | ~300KB-1.2MB |
