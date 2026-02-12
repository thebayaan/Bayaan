# Proposal: MMKV-Based Full Mushaf Layout Precomputation

**Status:** Proposed (not implemented)
**Last updated:** 2026-02-11
**Related files:**
- `services/mushaf/JustificationService.ts` — layout computation + current caching
- `components/mushaf/skia/SkiaPage.tsx` — page rendering + `precomputePageLayout()`
- `components/mushaf/main.tsx` — pager + surah navigation
- `services/AppInitializer.ts` — app startup orchestrator

---

## Problem Statement

The mushaf renders 604 Uthmani pages using Skia. Each page requires **justification computation** — a synchronous, CPU-bound process that measures word widths via Skia paragraph shaping and applies kashida stretching through multiple regex-based OpenType feature lookups.

**Current per-page computation cost: ~20-100ms** (device-dependent).

The current caching strategy (added Feb 2026) mitigates this through:
1. In-memory `pageLayoutsCache` (Map) — instant for same-session revisits
2. `precomputePageLayout()` — computes target page before surah jumps
3. `prewarmPageRange()` — pre-computes 2 adjacent pages after each render
4. AsyncStorage persistence — survives app restarts (but has size/parse issues)

**What's still not instant:**
- First visit to any page in a new app session (~20-100ms computation)
- Far surah jumps where adjacent pre-warming hasn't reached (~10ms perceived lag)
- After a font version switch (V1/V2), all pages need recomputation
- AsyncStorage has a 6MB default limit on Android — full 604-page serialization may exceed this

**The goal:** Every single page access is <1ms, always, with zero computation on the render path.

---

## Proposed Solution

Precompute all 604 pages once (per font version), store the results in MMKV (memory-mapped key-value store), and read on demand. The computation happens in the background on first launch. Every subsequent page access is a synchronous MMKV read (~0.01-0.1ms) + small JSON parse (~0.5-1ms).

### Why MMKV over other storage options

| Storage | Read speed | Size limit | Sync API | Notes |
|---------|-----------|------------|----------|-------|
| **In-memory Map** | ~0.001ms | RAM only | Yes | Current approach. Lost on app restart. |
| **AsyncStorage** | ~5-15ms | 6MB (Android) | No (async) | Current persistence layer. Too slow, too small. |
| **SQLite** | ~2-5ms | Unlimited | No (async in expo-sqlite) | Good but async API adds complexity. |
| **MMKV** | ~0.01-0.1ms | Unlimited | **Yes** | Memory-mapped files. Reads as fast as memory. |

MMKV wins because:
- **Synchronous reads** — can be called directly in `useState` initializers and render paths, no useEffect needed
- **Memory-mapped I/O** — the OS pages data in/out of memory automatically, reads are near-instant
- **No size limits** — 604 pages of layout data is fine
- **Battle-tested** — used by WeChat (1B+ users), widely adopted in React Native via `react-native-mmkv`

---

## Architecture Design

### Storage Schema

One MMKV key per page per font version:

```
Key format:   "dk_layout:{fontFamily}:{pageNumber}"
Value format: JSON string of JustResultByLine[]
Example key:  "dk_layout:DigitalKhattV2:42"
```

Plus metadata keys:

```
"dk_layout_version:{fontFamily}" → schema version number (for cache invalidation)
"dk_layout_complete:{fontFamily}" → "true" when all 604 pages are computed
```

Per-page keys (not one giant blob) because:
- Each page can be read independently (~1KB per page vs ~600KB monolith)
- Partial precomputation is usable — page 1 is available as soon as it's computed
- Individual pages can be invalidated without rewriting everything
- MMKV handles many small keys efficiently

### Serialization

`JustResultByLine[]` contains `Map<number, SkTextFontFeatures[]>` which needs custom serialization. The existing `replacer`/`reviver` functions in JustificationService.ts handle this (Maps → `{dataType: "Map", value: [...entries]}`).

Per-page JSON size estimate: ~500 bytes - 2KB depending on how many kashida features were applied. Total for 604 pages: **~300KB - 1.2MB**. Trivial for MMKV.

### Data Flow

#### First launch (or after font change)

```
AppInitializer
  └─> MushafLayoutService.ensureLayoutsComputed(fontFamily)
        ├─ Check: MMKV.getString("dk_layout_complete:DigitalKhattV2") === "true"?
        │   └─ Yes → done, all pages available
        │   └─ No  → start background computation
        │
        └─ Background computation (non-blocking):
             ├─ Create SkTypefaceFontProvider manually (not via useFonts hook)
             ├─ for page = 1..604:
             │    ├─ JustService.getPageLayout(page, ratio, fontMgr, fontFamily)
             │    ├─ MMKV.set("dk_layout:DigitalKhattV2:{page}", JSON.stringify(result, replacer))
             │    └─ Also populate in-memory pageLayoutsCache
             ├─ MMKV.set("dk_layout_complete:DigitalKhattV2", "true")
             └─ Done. ~15-45 seconds total, user doesn't notice.
```

#### Every subsequent page access

```
SkiaPage mount (pageNumber = N)
  └─> Check in-memory pageLayoutsCache → hit? Use it. (~0.001ms)
  └─> Miss? MMKV.getString("dk_layout:DigitalKhattV2:N") → parse → use it. (~1ms)
  └─> Miss? Compute on demand (fallback, should rarely happen). (~20-100ms)
```

#### Surah jump (e.g., page 52 → page 543)

```
navigateToSurah(surahId)
  └─> targetPage = surahStartPages[surahId]
  └─> Check in-memory cache or MMKV → guaranteed hit after first launch
  └─> scrollToIndex (instant, page already in cache)
```

### The fontMgr Problem

The biggest technical hurdle. Currently, `SkTypefaceFontProvider` is created by the `useFonts` React hook inside `SkiaPage`. Background precomputation in `AppInitializer` runs outside React.

**Solution:** Create the font provider manually using Skia's API:

```typescript
import { Skia } from '@shopify/react-native-skia';

// Load font data (these are already bundled assets)
const v2FontData = Skia.Data.fromURI(
  Asset.fromModule(require('@/data/mushaf/digitalkhatt/DigitalKhattV2.otf')).uri
);

const fontMgr = Skia.TypefaceFontProvider.Make();
fontMgr.registerFont(v2FontData, 'DigitalKhattV2');
```

This needs validation — the exact API may differ slightly. The key point is that `SkTypefaceFontProvider` can be created outside of React; `useFonts` is just a convenience wrapper.

---

## Implementation Plan

### New dependency

```bash
npm install react-native-mmkv
```

Requires a dev client rebuild (native module). Not compatible with Expo Go.

### New file: `services/mushaf/MushafLayoutCacheService.ts`

Responsibilities:
- Initialize MMKV instance
- Read/write per-page layouts
- Check completion status
- Invalidate cache on font change or schema version bump
- Background precomputation orchestration

### Changes to existing files

**`services/mushaf/JustificationService.ts`:**
- Add `getPageLayoutFromMMKV(fontSizeLineWidthRatio, pageNumber, fontFamily)` — sync read from MMKV
- Modify `getCachedPageLayout` to check MMKV as a middle layer between in-memory and computation
- Keep existing `saveAllLayouts` / `getLayoutFromStorage` as fallbacks

**`components/mushaf/skia/SkiaPage.tsx`:**
- `useState` initializer: check in-memory → MMKV → null (all synchronous)
- Remove async `getLayoutFromStorage` call in the effect (MMKV read is sync, no need)
- `precomputePageLayout` becomes a simple cache lookup, never computes
- `prewarmPageRange` can be removed (all pages are pre-warmed from MMKV)

**`services/AppInitializer.ts`:**
- Register `MushafLayoutCacheService` as a non-critical background service
- Runs after critical services (audio, player) are initialized
- Does not block app startup

**`components/mushaf/main.tsx`:**
- `navigateToSurah` simplifies — no `precomputePageLayout` call needed, cache is always warm

### Cache invalidation triggers

- Font version switch (V1 ↔ V2): check if target font's layouts are complete, recompute if not
- App update that changes font files: bump schema version in code, triggers full recomputation
- Manual clear: `MushafLayoutCacheService.clearAll()` for debugging

---

## Pros and Cons

### Pros

- **Every page access <1ms** — no computation on the render path, ever
- **Synchronous API** — no async/await, no useEffect chains, simpler code
- **Survives app restarts** — memory-mapped persistence is automatic
- **Small storage footprint** — ~300KB-1.2MB total, negligible
- **Simplifies SkiaPage** — removes computing state, async effects, pre-warming logic
- **Eliminates edge cases** — no race conditions from async cache loads, no stale data from cancelled effects

### Cons

- **New native dependency** — `react-native-mmkv` requires dev client rebuild, not Expo Go compatible (but the app already uses expo-sqlite which has the same constraint)
- **First launch cost** — ~15-45 seconds of background computation. User can use the app during this, but the mushaf may still need on-demand computation for the first few pages until background catches up
- **Two font versions** — if precomputing both V1 and V2, doubles computation time (~30-90 seconds first launch) and storage (~600KB-2.4MB). Alternative: only precompute active font, recompute on switch
- **Font file changes** — any update to DigitalKhattV1.otf or DigitalKhattV2.otf requires full cache invalidation and recomputation. Need a versioning strategy.
- **Manual fontMgr creation** — creating `SkTypefaceFontProvider` outside React needs validation. If Skia's API doesn't support this cleanly, the precomputation must happen inside a headless React component

---

## Is It Worth It?

**Current state (Feb 2026):** Page transitions are already near-instant. Swiping is covered by pre-warming. Surah jumps are covered by synchronous precomputation. The only remaining lag is ~10ms on far jumps and ~20-100ms on cold-start first page access.

**MMKV state:** Truly zero-lag everywhere, simpler code, but adds a dependency and first-launch computation.

**Recommendation:** Ship current approach. Revisit MMKV if:
- Users report mushaf lag (unlikely given current performance)
- The pre-warming / precompute logic becomes a maintenance burden
- You're already adding MMKV for another feature (e.g., player state, settings)

If you do implement it, the per-page key approach means you can do it incrementally — start storing pages to MMKV alongside the current system, switch reads over once validated, then remove the old AsyncStorage path.

---

## Quick Reference: Key Numbers

| Metric | Current | With MMKV |
|--------|---------|-----------|
| Per-page computation | 20-100ms | 0ms (precomputed) |
| Per-page cache read (memory) | ~0.001ms | ~0.001ms |
| Per-page cache read (storage) | 5-15ms (AsyncStorage, async) | ~1ms (MMKV, sync) |
| First launch overhead | None | ~15-45s background |
| Total storage | ~300KB-1.2MB (may exceed AsyncStorage limit) | ~300KB-1.2MB (fine) |
| Surah jump (far) | ~10ms | <1ms |
| Cold-start first page | ~20-100ms | <1ms |
