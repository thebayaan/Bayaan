# RFC-013: branding.initialPlayerVerseKey — anchor the PlayerSheet ayah list on a fork-supplied verse

| Field   | Value                                                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status  | Accepted                                                                                                                                                    |
| Date    | 2026-05-23                                                                                                                                                  |
| Author  | Omar Zarka (Qariah fork)                                                                                                                                    |
| Related | RFC-007 (multi-tenant config seam, merged), RFC-008 (listen-tab top component slot, merged), RFC-010 (catalog version endpoint, merged), RFC-011 (in flight) |

> Combined doc + code PR — opt-in seam with default-`undefined` no-op preserves today's Bayaan behavior verbatim.

---

## Summary

Add an optional `branding.initialPlayerVerseKey?: (track: Track) => string | undefined` hook that lets a fork tell the PlayerSheet's ayah list (`components/player/v2/PlayerContent/QuranView/index.tsx`) where to anchor the scroll on mount and on subsequent surah changes. Returning `undefined` (the default) keeps today's "scroll to top of surah" behavior byte-identical.

The motivating use case is fork-supplied **range-restricted recitations** — audio tracks that cover only a subset of a surah (e.g. ayahs 197–202 of Al-Baqarah). When such a track plays, today's QuranView still scrolls to ayah 1, so the visible ayah list is ~196 ayahs misaligned from the audio that's actually playing. The fork knows the partial range; the hook gives it a place to express it.

The PR also lands a small **2-`requestAnimationFrame` deferral** on imperative `scrollToIndex` calls — needed for the new hook to work on in-app surah switches (FlashList v2 silently no-ops `scrollToIndex` calls made before the new `data` has finished laying out, with no `onScrollToIndexFailed` escape hatch like FlatList). The same defer pattern shores up the existing active-ayah autoscroll effect when it fires close to a track change, so it's a small reliability bonus for the default Bayaan code path too.

---

## Motivation

The destination is *already* a single component — `QuranView` is shared by every PlayerSheet open path in both Bayaan and forks. Today the surah-change effect at L205–211 reads:

```typescript
useEffect(() => {
  if (listRef.current) {
    listRef.current.scrollToOffset({offset: 0, animated: false});
  }
  setIsLocked(true);
}, [currentSurah, setIsLocked]);
```

This is correct for the common case (full-surah recitation: audio starts at ayah 1, list starts at ayah 1). It breaks for forks that ship tracks where the audio's first ayah is not the surah's first ayah.

The Qariah fork shipped 326 such tracks across 54 reciters (Sprint-19 off-sprint catalog patch, 2026-05-18). Each carries a `range: {from, to}` in catalog metadata. Without the hook this RFC proposes, every Qariah fork user opening one of these tracks sees an ayah list scrolled to ayah 1 while listening to audio reciting ayahs 197–202 — a real, actively-shipped UX defect.

A Qariah-only fix in the shared `QuranView` file is doable, but it puts a permanent ~50 LOC divergence in a hot file that already takes upstream churn well. Lifting the seam to `branding` retires the divergence and gives any other fork (or Bayaan itself, if it ever adopts range-restricted recitations like an "ayahs of the Mufassal" curated set) the same capability with zero per-fork QuranView edits.

---

## Design

### The hook

```typescript
// config/branding.d.ts
import type {Track} from '@/types/audio';

export interface Branding {
  /**
   * RFC-013 — optional hook returning the verse_key (e.g. `"2:197"`) the
   * PlayerSheet ayah list should anchor on for the currently-playing
   * track. Called on cold-mount of QuranView and on every currentSurah
   * change thereafter. Returning `undefined` (the default) keeps the
   * current scroll-to-top-of-surah behavior verbatim.
   *
   * Used by forks that ship range-restricted recitations (audio tracks
   * covering only a subset of a surah). The hook returns the start of
   * that subset; QuranView handles the rest (initial-scroll position +
   * deferred imperative scroll on subsequent surah changes).
   *
   * If the returned verse_key isn't found in the current surah's verses,
   * QuranView silently falls back to scrolling to the top — same
   * behavior as today.
   *
   * @example
   * // Qariah fork — partial recitations come from catalog metadata
   * initialPlayerVerseKey: (track) => {
   *   const meta = getSurahMetadata(track.reciterId, track.rewayatId, track.surahId);
   *   return meta?.range ? `${track.surahId}:${meta.range.from}` : undefined;
   * }
   */
  initialPlayerVerseKey?: (track: Track) => string | undefined;
}
```

`Track` is the existing `types/audio.ts` interface — already carries `reciterId`, `rewayatId?`, `surahId?`, plus `userRecitationId` / `uploadCategory` for forks whose seeking logic depends on user-upload metadata.

### QuranView changes

Three additive edits inside `components/player/v2/PlayerContent/QuranView/index.tsx`:

1. **Subscribe to the current track** via two granular `usePlayerStore` selectors. Granular selectors avoid re-rendering QuranView on every player tick.

2. **Memoize `initialScrollIndex`** by calling `branding.initialPlayerVerseKey(track)` (if defined) and resolving the returned verse_key to its index in `verses`. Returns `undefined` for the default path (hook absent, hook returns `undefined`, or verse_key not found in the current surah).

3. **Rewrite the surah-change effect** to defer `scrollToIndex` two animation frames when an initial verse_key is in play. The default branch (no hook → no initial verse_key → `scrollToOffset({offset: 0})`) stays exactly as today.

The FlashList itself gains one new prop:

```diff
       <FlashList
         ref={listRef}
+        initialScrollIndex={initialScrollIndex}
         …
```

`initialScrollIndex` on FlashList is consumed once at construction during the initial layout pass — that's the right primitive for cold-mount and avoids any race with imperative scrolling. For subsequent in-app surah switches where FlashList stays mounted, the 2-rAF deferred path takes over.

### Why two requestAnimationFrames

FlashList v2's `scrollToIndex` returns a Promise that resolves to no-op when the target index hasn't been laid out yet. Unlike `FlatList`, FlashList v2 has no `onScrollToIndexFailed` callback to catch the miss and retry. Empirically, calling `scrollToIndex` synchronously inside a `useEffect` that fires on the same render cycle as a `data` prop change resolves to a no-op every time.

Two `requestAnimationFrame` calls reliably bridge:
- The first rAF runs after React commits the re-render.
- The second rAF runs after FlashList's `RecyclerView` layout manager has measured the new cells.

A single rAF works most of the time but races against fast Arabic-glyph cell measurement on lower-end devices; two rAFs are the smallest reliable defer in the Qariah testing matrix (iPhone 17 Pro sim + Pixel 7 emulator).

### What does NOT change

- The default Bayaan behavior — no `initialPlayerVerseKey` defined → branding default surfaces `undefined` → QuranView falls through to today's `scrollToOffset({offset: 0})`. No behavioral diff on the default path.
- The active-ayah autoscroll effect (L213–225). It already has the `try/catch` escape hatch and works fine because it fires after the user has been on the track for some time (FlashList is well-measured by then).
- Track type, player store, expanding the PlayerSheet, sheet-mode transitions — all untouched.

---

## Alternatives considered

### Per-fork QuranView override

Each fork patches `QuranView/index.tsx` directly. Works (it's what Qariah is shipping today as `4aa0dc3` on `sprint-23-qariah-upstream-rfc-absorption`). Loses to the multi-tenant-first principle from RFC-007: a ~50-LOC divergence in a hot upstream file accumulates merge-conflict cost on every weekly sync, and any other fork wanting the same capability has to re-derive the implementation.

### Declarative range-config on the catalog

Add `Reciter.rewayat[].surah_metadata?: SurahMetadata[]` upstream and have QuranView read it directly. Considered and rejected because the catalog shape upstream is forks' business (Qariah ships custom-curated reciters with custom metadata; Bayaan's catalog has none of those reciters). Lifting the data shape upstream forces Bayaan to take on schema fields it doesn't populate. The hook keeps the data flow fork-internal and only the *behavioral seam* upstream.

### Imperative API instead of a hook

`playerStore.setInitialVerseKey(key)` called by the fork at track-load time. Considered and rejected because the call site is fork-internal (the fork's `play()` invocation), and threading the value through the store adds state that QuranView has to reconcile with `currentSurah` changes. The hook is stateless — QuranView re-derives on every surah change from the track that's currently playing.

### Generalize to "initial scroll target" beyond verse_key

`(track) => {verseKey?: string, page?: number, offset?: number}`. Overkill for v1 — verse_key is the only granularity the PlayerSheet ayah list cares about. If a future RFC needs page/offset granularity (e.g. for the Mushaf-style PlayerContent), that hook gets its own seam.

---

## Migration plan

1. **Land this RFC + code together** (single PR). Bayaan ships `initialPlayerVerseKey: undefined` — zero behavior change for the default app.
2. **Forks adopt** by defining the hook against whatever catalog metadata they ship. Qariah's implementation:
   ```typescript
   import {getSurahMetadataSync} from '@/services/dataService';
   initialPlayerVerseKey: (track) => {
     if (!track.surahId || !track.reciterId) return undefined;
     const surahNum = parseInt(track.surahId, 10);
     if (Number.isNaN(surahNum)) return undefined;
     const meta = getSurahMetadataSync(track.reciterId, track.rewayatId, surahNum);
     if (!meta || meta.is_full || !meta.range) return undefined;
     return `${track.surahId}:${meta.range.from}`;
   }
   ```
3. **Qariah retires its `QuranView/index.tsx` divergence** (the `4aa0dc3` commit on `sprint-23-qariah-upstream-rfc-absorption`) once this lands, reverting that file to upstream.

---

## Open questions

1. **Hook timing on currentSurah-only changes (no track change).** If the user manually swipes the surah-tabs at the top of the PlayerSheet to view a different surah than the playing track, the hook still fires with the playing track — which may not have metadata for the swiped-to surah. Recommended behavior: `initialPlayerVerseKey` returns `undefined` for surahs the track doesn't cover → falls through to scroll-to-top, matching today's UX. The Qariah implementation example above does this naturally because `getSurahMetadataSync` returns `undefined` for surahs not in the reciter's metadata.

2. **Memoization granularity.** The example wraps the hook call in `useMemo([trackReciterId, trackRewayatId, currentSurah, verses])`. A naive implementation could just call the hook inline — but that re-runs the catalog lookup on every render. Recommend documenting the memoization shape in JSDoc rather than enforcing it at the seam.

3. **Should the hook receive `verses` too?** Considered and rejected — the hook's responsibility is "what verse_key", not "what index". QuranView owns the verse_key → index resolution; that decouples fork hooks from changes to the EnhancedVerse shape.

4. **Animated vs not.** Initial mount is `animated: false` (no perceptible jump). In-app surah switches use `animated: false` too — animating a scroll across hundreds of ayahs is jarring. Document the chosen non-animated default; forks don't get to override (would be over-design for the v1 hook).

---

## Risks

- **The 2-rAF defer is empirical.** No published FlashList v2 guidance prescribes it; it's the smallest defer that worked across the Qariah test matrix. If FlashList v2 introduces an `onScrollToIndexFailed`-equivalent in a future release, switch to that — the current path falls through to `scrollToOffset({offset: 0})` on exception, so the worst case stays predictable.
- **Hook-undefined performance.** A no-op hook returning `undefined` still gets called on every surah change. Cost is one function call + one falsy check per surah switch — negligible. The `usePlayerStore` selectors that feed the hook are granular, so they don't add re-renders.
- **Tablet split-view.** `parentContentWidth` already feeds the FlashList width; no interaction with `initialScrollIndex`. Smoke-tested on iPad sim.

---

## Acceptance for this combined doc + code PR

- The RFC text reflects the shipped hook signature + the QuranView edits in this same PR.
- `npm run typecheck` clean.
- `node node_modules/prettier/bin/prettier.cjs --check .` clean (Prettier 3 indent rules).
- Default Bayaan path (`initialPlayerVerseKey: undefined`) is byte-identical to today — the diff in `QuranView/index.tsx` only adds the gated code path, leaves the `else { scrollToOffset({offset:0}) }` branch verbatim.
- A fork sets the hook to a function returning a known verse_key → PlayerSheet anchors on that ayah on cold-mount and after in-app surah switches.

---

## Future work (out of scope here)

- **Migrate the existing active-ayah autoscroll (L213–225) to the 2-rAF defer pattern** as a small reliability tweak. Currently relies on the implicit fact that the autoscroll fires "long after" track-load — but if a fork ever wires the autoscroll on the first audio tick of a fresh track, it can hit the same FlashList-not-yet-measured race. Punt to a follow-up chore PR rather than bundling here.
- **Mushaf-style PlayerContent (`MushafPageView`) initial-page anchor**. Same shape, different target (`initialPlayerPage?: (track) => number | undefined`). When/if a fork needs page-granularity anchoring, that's its own RFC.
