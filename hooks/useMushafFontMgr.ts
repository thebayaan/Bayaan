// Single source of truth for the Mushaf font manager in render code.
//
// Before: each Skia-rendering component called `useFonts(...)` with the
// surah-name TTFs as a "fallback" alongside reading the preloaded
// `mushafPreloadService.fontMgr`. The useFonts call ran on every mount
// even when the preload service was already initialized, and at first-
// render many <SurahDivider> instances would mount simultaneously and
// contend for typeface creation — surfacing as "Couldn't create typeface
// for SurahNameV4" exceptions captured by Sentry.
//
// This hook is the real fix. It reads `mushafPreloadService.fontMgr`
// synchronously and subscribes to preload completion so callers re-render
// when the preload finishes. AppInitializer awaits `mushafPreloadService
// .initialize()` before splash hides, so in practice the snapshot is
// already non-null on first render; the subscription is for the brief
// window between Skia component mount and preload completion when
// AppInitializer hasn't blocked yet (e.g. fast-mounted modals).
//
// Fallback path (Osman review HIGH): if the preload pipeline fails
// (DK init reject, Skia font load reject, all typefaces returning null
// even after the service's sequential retry), this hook falls through
// to a per-component `useFonts(...)` covering the Mushaf-critical font
// families. That fallback re-introduces the original parallel-typeface
// race, but it is bounded to the catastrophic case where the service's
// own retry already failed — every prior layer of recovery has been
// exhausted. The alternative is a permanently-blank Mushaf, which is
// the user-facing regression we must not ship.
//
// Happy path: `loadError === false`, the per-component `useFonts` call
// is still invoked (Rules of Hooks: it must run unconditionally) but its
// result is discarded. The cost is identical to the pre-fix
// `useFonts` cycle for that component — but the system as a whole
// avoids the multi-component contention that caused the original Sentry
// noise because the service's primary `fontMgr` is preferred.
//
// Migration plan: 14 additional components still read
// `mushafPreloadService.fontMgr` directly at render time without
// subscribing. They risk a stale-null render if they mount before
// preload completes (sheets opened via deep links, etc.). Migration is
// tracked in a follow-up PR: see
// `chore: migrate remaining 14 fontMgr consumers to useMushafFontMgr hook`.

import {useSyncExternalStore} from 'react';
import {
  useFonts,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';

// Mushaf-critical subset of `FONT_ASSETS` in `MushafPreloadService`. UI
// fonts (Manrope) are intentionally excluded — they're loaded by the
// app-wide font loader, not the Mushaf preload service, so the fallback
// path doesn't need to re-load them. Updating this list does NOT need to
// mirror every `FONT_ASSETS` addition; only the Mushaf-rendering families.
const FALLBACK_FONT_SOURCES = {
  DigitalKhattV1: [require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf')],
  DigitalKhattV2: [require('@/data/mushaf/digitalkhatt/DigitalKhattFont.otf')],
  DigitalKhattIndoPak: [
    require('@/data/mushaf/indopak/DigitalKhattIndoPak.otf'),
  ],
  QuranCommon: [require('@/data/mushaf/quran-common.ttf')],
  SurahNameV4: [require('@/data/mushaf/surah-name-v4.ttf')],
  SurahNameQCF: [require('@/data/mushaf/surah-name-qcf.ttf')],
};

export function useMushafFontMgr(): SkTypefaceFontProvider | null {
  // Single subscription per hook instance (Osman review MEDIUM). The
  // previous shape called `useSyncExternalStore` twice — once for
  // `fontMgr`, once for `loadError` — so each `_notify()` scheduled two
  // re-renders per subscribing component per state transition. Under
  // Hermes legacy rendering with 13+ subscribers across the Mushaf tree
  // that's a double cold-start render storm at the worst moment.
  //
  // Now: one subscription, snapshot is a primitive boolean `isReady`
  // (`true` once preload terminated as 'ready' OR 'failed'). Primitive
  // snapshot means default identity comparison correctly short-circuits
  // unchanged renders without needing a custom comparator. `fontMgr` and
  // `loadError` are then derived from the service's current state at
  // render time — both flip together inside `_notify`, so reading them
  // post-isReady-flip is consistent.
  const isReady = useSyncExternalStore(
    listener => mushafPreloadService.subscribe(listener),
    () => mushafPreloadService.initialized,
    () => mushafPreloadService.initialized,
  );
  const preloadFontMgr = isReady ? mushafPreloadService.fontMgr : null;
  const loadError = isReady && mushafPreloadService.loadError;

  // Rules of Hooks: `useFonts` must be called unconditionally on every
  // render. The result is only consumed when the preload truly has nothing
  // to offer (failed AND `fontMgr === null`), so the happy path's behavior
  // is unchanged.
  const fallbackFontMgr = useFonts(FALLBACK_FONT_SOURCES);

  if (loadError && !preloadFontMgr) {
    return fallbackFontMgr;
  }
  return preloadFontMgr;
}
