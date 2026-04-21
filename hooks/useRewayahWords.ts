import {useEffect, useMemo, useSyncExternalStore} from 'react';
import {
  digitalKhattDataService,
  type DKWordInfo,
} from '@/services/mushaf/DigitalKhattDataService';
import {hasTextData, type RewayahId} from '@/services/rewayah/RewayahIdentity';

// Return shape for useRewayahWords/useRewayahText. `status` distinguishes
// "we're still loading the DB" from "we don't ship DK data for this rewayah"
// so UI can render the right state instead of a silent Hafs fallback.
export interface RewayahWordsResult {
  words: DKWordInfo[];
  status: 'loading' | 'ready' | 'unavailable';
}

const EMPTY_WORDS: DKWordInfo[] = [];
const UNAVAILABLE: RewayahWordsResult = {
  words: EMPTY_WORDS,
  status: 'unavailable',
};

// Single access point for reading Arabic words from DigitalKhattDataService.
//
// Subscribes to the service's cache-version counter via useSyncExternalStore,
// so the component re-renders whenever the main cache is rebuilt or a side
// cache for the requested rewayah becomes ready. No more stale-useMemo bugs
// from the older useReducer+bump pattern — if the cache changes, consumers
// see it on the next commit.
//
// Triggers ensureRewayahLoaded on demand for non-active rewayat (e.g. the
// player rendering a track in a different rewayah from the mushaf setting).
// Silently returns {status: 'unavailable'} for rewayat without bundled DK
// data — callers should not pass these to the render path, but the hook
// degrades gracefully rather than throwing.
export function useRewayahWords(
  verseKey: string | null,
  rewayah: RewayahId,
): RewayahWordsResult {
  const cacheVersion = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    digitalKhattDataService.getCacheVersion,
  );

  const rewayahHasData = hasTextData(rewayah);

  // Kick off a side-cache load the first time we see a rewayah that isn't
  // the active one. ensureRewayahLoaded is idempotent (de-dupes in-flight
  // loads via sideLoading); completion fires notifyCacheChange which
  // cascades through useSyncExternalStore to re-render this component.
  useEffect(() => {
    if (!verseKey || !rewayahHasData) return;
    if (rewayah === digitalKhattDataService.rewayah) return;
    let cancelled = false;
    digitalKhattDataService.ensureRewayahLoaded(rewayah).catch(err => {
      if (!cancelled) {
        console.warn(`[useRewayahWords] Side-load failed for ${rewayah}:`, err);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [verseKey, rewayah, rewayahHasData]);

  return useMemo<RewayahWordsResult>(() => {
    if (!verseKey) return {words: EMPTY_WORDS, status: 'ready'};
    if (!rewayahHasData) return UNAVAILABLE;

    const words = digitalKhattDataService.getVerseWords(verseKey, rewayah);
    if (words.length > 0) return {words, status: 'ready'};
    // Empty array can mean two things:
    //   - cache not populated yet (initial boot or side-cache warming), or
    //   - verseKey genuinely has no words in this rewayah's DB.
    // Treat "service not initialized" as loading; otherwise ready-but-empty.
    const status: 'loading' | 'ready' = digitalKhattDataService.initialized
      ? 'ready'
      : 'loading';
    return {words, status};
    // cacheVersion is intentionally a dep — it's the reactivity signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseKey, rewayah, rewayahHasData, cacheVersion]);
}

// Convenience: joined text. Same reactivity as useRewayahWords.
export function useRewayahText(
  verseKey: string | null,
  rewayah: RewayahId,
): {text: string; status: 'loading' | 'ready' | 'unavailable'} {
  const {words, status} = useRewayahWords(verseKey, rewayah);
  const text = useMemo(
    () => (status === 'ready' ? words.map(w => w.text).join(' ') : ''),
    [words, status],
  );
  return {text, status};
}
