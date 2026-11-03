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
// even after the service's sequential retry), this hook gives every
// caller one shared provider covering the Mushaf-critical font families.
// The alternative is a permanently-blank Mushaf, which is the user-facing
// regression we must not ship.
//
// @ai
// Happy path: the hook loads no fonts. `useFonts` cannot do this: Rules of
// Hooks make it run on every mount, and each run reads the font files
// again and disposes nothing. SkiaPage mounts once per page, so those
// discarded copies (8.8 MB per mount) were the main memory growth of the
// reader. The shared load below runs only after the preload failed,
// one font at a time, so it cannot bring back the parallel-typeface race.
//
// Migration plan: 14 additional components still read
// `mushafPreloadService.fontMgr` directly at render time without
// subscribing. They risk a stale-null render if they mount before
// preload completes (sheets opened via deep links, etc.). Migration is
// tracked in a follow-up PR: see
// `chore: migrate remaining 14 fontMgr consumers to useMushafFontMgr hook`.

import {useSyncExternalStore} from 'react';
import {Image} from 'react-native';
import {Skia, type SkTypefaceFontProvider} from '@shopify/react-native-skia';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';

// Mushaf-critical subset of `FONT_ASSETS` in `MushafPreloadService`. UI
// fonts (Manrope) are intentionally excluded — they're loaded by the
// app-wide font loader, not the Mushaf preload service, so the fallback
// path doesn't need to re-load them. Updating this list does NOT need to
// mirror every `FONT_ASSETS` addition; only the Mushaf-rendering families.
const FALLBACK_FONT_SOURCES: Record<string, number> = {
  DigitalKhattV1: require('@/data/mushaf/legacy/DigitalKhattQuranicV1.otf'),
  DigitalKhattV2: require('@/data/mushaf/digitalkhatt/DigitalKhattFont.otf'),
  DigitalKhattIndoPak: require('@/data/mushaf/indopak/DigitalKhattIndoPak.otf'),
  QuranCommon: require('@/data/mushaf/quran-common.ttf'),
  SurahNameV4: require('@/data/mushaf/surah-name-v4.ttf'),
  SurahNameQCF: require('@/data/mushaf/surah-name-qcf.ttf'),
};

// @ai-start
let fallbackFontMgr: SkTypefaceFontProvider | null = null;
let fallbackLoading = false;
const fallbackListeners = new Set<() => void>();

async function ensureFallbackFontMgr(): Promise<void> {
  if (
    fallbackFontMgr ||
    fallbackLoading ||
    !mushafPreloadService.loadError ||
    mushafPreloadService.fontMgr
  ) {
    return;
  }
  fallbackLoading = true;
  try {
    const fontMgr = Skia.TypefaceFontProvider.Make();
    for (const [family, asset] of Object.entries(FALLBACK_FONT_SOURCES)) {
      const source = Image.resolveAssetSource(asset);
      if (!source) {
        throw new Error(`Unresolvable font asset ${family}`);
      }
      const data = await Skia.Data.fromURI(source.uri);
      const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (!typeface) {
        throw new Error(`Couldn't create typeface for ${family}`);
      }
      fontMgr.registerFont(typeface, family);
    }
    fallbackFontMgr = fontMgr;
  } catch (error) {
    // The next mount tries again: a failed read can be transient.
    console.warn('[useMushafFontMgr] Fallback font load failed:', error);
  } finally {
    fallbackLoading = false;
  }
  if (fallbackFontMgr) {
    for (const listener of fallbackListeners) listener();
  }
}

function subscribe(listener: () => void): () => void {
  const unsubscribe = mushafPreloadService.subscribe(() => {
    ensureFallbackFontMgr();
    listener();
  });
  fallbackListeners.add(listener);
  // A component that mounts after the failure gets no notification.
  ensureFallbackFontMgr();
  return () => {
    unsubscribe();
    fallbackListeners.delete(listener);
  };
}

function getFontMgr(): SkTypefaceFontProvider | null {
  if (!mushafPreloadService.initialized) return null;
  return mushafPreloadService.fontMgr ?? fallbackFontMgr;
}

// Single subscription per hook instance (Osman review MEDIUM): the snapshot
// is the provider, so a notification that does not change it does not
// re-render the caller.
export function useMushafFontMgr(): SkTypefaceFontProvider | null {
  return useSyncExternalStore(subscribe, getFontMgr, getFontMgr);
}
// @ai-end
