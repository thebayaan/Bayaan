import {useEffect, useMemo, useSyncExternalStore} from 'react';
import {
  digitalKhattDataService,
  type DKWordInfo,
} from '@/services/mushaf/DigitalKhattDataService';
import {hasTextData, type RewayahId} from '@/services/rewayah/RewayahIdentity';

// `status` distinguishes "still loading" from "we don't ship DK data for
// this rewayah" from "loading failed", so UI can render the right state
// instead of empty text or a silent Hafs fallback. `words` is non-empty only
// when status is 'ready'.
export type RewayahWordsStatus = 'loading' | 'ready' | 'unavailable' | 'error';

// Return shape for useRewayahWords/useRewayahText.
export interface RewayahWordsResult {
  words: DKWordInfo[];
  status: RewayahWordsStatus;
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
// cache for the requested rewayah becomes ready (or fails). If the cache
// changes, consumers see it on the next commit.
//
// Loads on demand: whenever the requested rewayah's words are neither in
// memory nor on the way ('idle'), it calls ensureRewayahLoaded. That check
// re-runs on every cache change, because a mushaf switch can move the
// rewayah this consumer shows out of the main cache (the player keeps
// showing a track's rewayah while the mushaf moves on) without any prop of
// this hook changing. A failed load stays 'error' (no retry loop); an
// explicit ensureRewayahLoaded or switchRewayah call retries.
// @ai-start
// While it shows a verse, the hook retains the rewayah, so its side copy is
// never evicted by later switches.
// @ai-end
//
// Returns {status: 'unavailable'} for rewayat without bundled DK data, so
// callers can show "text not available" rather than another rewayah's text.
export function useRewayahWords(
  verseKey: string | null,
  rewayah: RewayahId,
): RewayahWordsResult {
  const cacheVersion = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    digitalKhattDataService.getCacheVersion,
  );

  const rewayahHasData = hasTextData(rewayah);

  // @ai-start
  const showsVerse = verseKey !== null;
  useEffect(() => {
    if (!showsVerse || !rewayahHasData) return;
    return digitalKhattDataService.retainRewayah(rewayah);
  }, [showsVerse, rewayah, rewayahHasData]);
  // @ai-end

  useEffect(() => {
    if (!verseKey || !rewayahHasData) return;
    if (digitalKhattDataService.getRewayahLoadState(rewayah) !== 'idle') {
      return;
    }
    let cancelled = false;
    // Completion (or failure) bumps the cache version, which re-renders this
    // component through useSyncExternalStore.
    digitalKhattDataService.ensureRewayahLoaded(rewayah).catch(err => {
      if (!cancelled) {
        console.warn(`[useRewayahWords] Loading ${rewayah} failed:`, err);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [verseKey, rewayah, rewayahHasData, cacheVersion]);

  return useMemo<RewayahWordsResult>(() => {
    if (!verseKey) return {words: EMPTY_WORDS, status: 'ready'};
    if (!rewayahHasData) return UNAVAILABLE;

    // null = this rewayah's words are not in memory; [] = loaded, and this
    // verse key genuinely has no words in its DB.
    const words = digitalKhattDataService.tryGetVerseWords(verseKey, rewayah);
    if (words) return {words, status: 'ready'};
    const status: RewayahWordsStatus =
      digitalKhattDataService.getRewayahLoadState(rewayah) === 'error'
        ? 'error'
        : 'loading';
    return {words: EMPTY_WORDS, status};
    // cacheVersion is intentionally a dep — it's the reactivity signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseKey, rewayah, rewayahHasData, cacheVersion]);
}

// Convenience: joined text. Same reactivity as useRewayahWords. Blank word
// slots ('' text) contribute neither text nor a separator.
export function useRewayahText(
  verseKey: string | null,
  rewayah: RewayahId,
): {text: string; status: RewayahWordsStatus} {
  const {words, status} = useRewayahWords(verseKey, rewayah);
  const text = useMemo(
    () =>
      status === 'ready'
        ? words
            .map(w => w.text)
            .filter(t => t !== '')
            .join(' ')
        : '',
    [words, status],
  );
  return {text, status};
}
