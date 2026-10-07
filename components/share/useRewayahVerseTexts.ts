// @ai-generated
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  isHafsTextFailed,
  readLoadedVerseTexts,
  unavailableResult,
  watchRewayahText,
  type VerseTextsResult,
} from './rewayahVerseText';

export type UseRewayahVerseTextsResult = VerseTextsResult & {
  /** Start another load attempt after an 'unavailable' result. */
  retry: () => void;
};

/**
 * Reactive verse texts for `rewayah` (one entry per key), for previews and
 * share sheets. Subscribes to the data service's cache-change signal, so the
 * component re-renders when a side cache finishes loading, and starts that
 * load itself. 'loading' until the words are in memory; 'unavailable' when a
 * non-Hafs load fails or times out. A Hafs request falls back to the bundled
 * Hafs JSON instead, at once when the Hafs words already failed to load.
 * Never returns another rewayah's text.
 */
export function useRewayahVerseTexts(
  verseKeys: readonly string[],
  rewayah: RewayahId,
): UseRewayahVerseTextsResult {
  const cacheVersion = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    digitalKhattDataService.getCacheVersion,
  );

  // Callers often pass a fresh array each render; key everything on content.
  const keysSignature = verseKeys.join(',');
  const keys = useMemo(
    () => (keysSignature ? keysSignature.split(',') : []),
    [keysSignature],
  );
  const requestKey = `${rewayah}|${keysSignature}`;

  const [failedRequest, setFailedRequest] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadTick, setLoadTick] = useState(0);

  // cacheVersion and loadTick are the reactivity signals for the data
  // service's in-memory maps and load states, which are not React state.
  const texts = useMemo(
    () => readLoadedVerseTexts(keys, rewayah),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, rewayah, cacheVersion, loadTick],
  );
  const hafsFailed = useMemo(
    () => texts === null && isHafsTextFailed(rewayah),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [texts, rewayah, cacheVersion],
  );
  const waiting = texts === null && !hafsFailed;

  useEffect(() => {
    if (!waiting) return;
    return watchRewayahText(rewayah, ok => {
      if (ok) setLoadTick(t => t + 1);
      else setFailedRequest(requestKey);
    });
  }, [waiting, rewayah, requestKey, attempt]);

  const retry = useCallback(() => {
    setFailedRequest(null);
    setAttempt(a => a + 1);
  }, []);

  return useMemo((): UseRewayahVerseTextsResult => {
    if (texts) return {status: 'ready', rewayah, texts, retry};
    if (hafsFailed || failedRequest === requestKey) {
      return {...unavailableResult(keys, rewayah), retry};
    }
    return {status: 'loading', rewayah, retry};
  }, [texts, hafsFailed, failedRequest, requestKey, keys, rewayah, retry]);
}
