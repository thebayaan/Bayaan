import {
  useCallback, // @ai
  useEffect,
  useMemo,
  useRef, // @ai
  useSyncExternalStore,
} from 'react';
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
  // @ai-start
  /** Asks for the rewayah's words again (after 'error'); a no-op if loaded. */
  retry: () => void;
  // @ai-end
}

const EMPTY_WORDS: DKWordInfo[] = [];

// @ai-start
// A failed load is asked for again when a surface showing that rewayah
// mounts (the player reopened, a row scrolled into view), at most once per
// rewayah per interval, so rows mounting together or a reader scrolling do
// not repeat a load that keeps failing (e.g. no storage left). retry()
// asks at once.
export const REWAYAH_WORDS_RETRY_INTERVAL_MS = 10000;
const lastAutoRetryAt = new Map<RewayahId, number>();

function claimAutoRetry(rewayah: RewayahId): boolean {
  const now = Date.now();
  const last = lastAutoRetryAt.get(rewayah);
  if (last !== undefined && now - last < REWAYAH_WORDS_RETRY_INTERVAL_MS) {
    return false;
  }
  lastAutoRetryAt.set(rewayah, now);
  return true;
}
// @ai-end

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
// never evicted by later switches. A failed load is asked for again when the
// surface mounts (see REWAYAH_WORDS_RETRY_INTERVAL_MS) or on retry().
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

  // The rewayah this mounted surface last asked for: a failed load is asked
  // for again only on the first run for a rewayah (mount or a new rewayah),
  // never on the cache changes that follow.
  const askedForRef = useRef<RewayahId | null>(null);
  // @ai-end

  useEffect(() => {
    if (!verseKey || !rewayahHasData) return;
    // @ai-start
    const firstRun = askedForRef.current !== rewayah;
    askedForRef.current = rewayah;
    const state = digitalKhattDataService.getRewayahLoadState(rewayah);
    const retryFailed =
      state === 'error' && firstRun && claimAutoRetry(rewayah);
    if (state !== 'idle' && !retryFailed) return;
    // @ai-end
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

  // @ai-start
  const retry = useCallback(() => {
    if (!hasTextData(rewayah)) return;
    digitalKhattDataService.ensureRewayahLoaded(rewayah).catch(err => {
      console.warn(`[useRewayahWords] Loading ${rewayah} failed:`, err);
    });
  }, [rewayah]);
  // @ai-end

  return useMemo<RewayahWordsResult>(() => {
    if (!verseKey) return {words: EMPTY_WORDS, status: 'ready', retry};
    if (!rewayahHasData) {
      return {words: EMPTY_WORDS, status: 'unavailable', retry};
    }

    // null = this rewayah's words are not in memory; [] = loaded, and this
    // verse key genuinely has no words in its DB.
    const words = digitalKhattDataService.tryGetVerseWords(verseKey, rewayah);
    if (words) return {words, status: 'ready', retry};
    const status: RewayahWordsStatus =
      digitalKhattDataService.getRewayahLoadState(rewayah) === 'error'
        ? 'error'
        : 'loading';
    return {words: EMPTY_WORDS, status, retry};
    // cacheVersion is intentionally a dep — it's the reactivity signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseKey, rewayah, rewayahHasData, cacheVersion, retry]);
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
