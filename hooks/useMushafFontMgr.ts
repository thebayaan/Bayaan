// @ai-start
// The Mushaf font manager for render code.
//
// MushafPreloadService loads the fonts and owns the retry after a failure, so
// this hook loads nothing. It returns the service's provider, and it renders
// its caller again when the service notifies. The value is null until the
// fonts load. During a retry of the preload it stays the provider that loaded.
//
// Callers used to call `useFonts`, which runs on every mount (Rules of Hooks)
// and reads the font files again. SkiaPage mounts once for each page.

import {useSyncExternalStore} from 'react';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';
import {mushafPreloadService} from '@/services/mushaf/MushafPreloadService';

function subscribe(listener: () => void): () => void {
  return mushafPreloadService.subscribe(listener);
}

function getFontMgr(): SkTypefaceFontProvider | null {
  return mushafPreloadService.fontMgr;
}

// The snapshot is the provider, so a notification that does not change it
// does not render the caller again.
export function useMushafFontMgr(): SkTypefaceFontProvider | null {
  return useSyncExternalStore(subscribe, getFontMgr, getFontMgr);
}
// @ai-end
