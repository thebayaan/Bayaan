// @ai-generated
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import {
  readingsAt,
  wordReadingsService,
} from '@/services/mushaf/WordReadingsService';
import {
  dkPositionsForWbwWord,
  type WordReadings,
} from '@/services/mushaf/wordReadingsFormat';
import {REWAYAH_WORDS_RETRY_INTERVAL_MS} from '@/hooks/useRewayahWords';

/**
 * - 'loading': the verse's readings are being read (also briefly before);
 * - 'ready': `readings` of the word, over its Hafs DK positions `dkPositions`
 *   (two for the word-by-word بَعْدَ مَا);
 * - 'error': the index could not be read, belongs to another data build, or
 *   the word's row is malformed: show no readings (never guessed ones) and
 *   offer `retry`.
 */
export type WordReadingsResult =
  | {status: 'loading'}
  | {
      status: 'ready';
      readings: WordReadings;
      dkPositions: readonly number[];
    }
  | {status: 'error'; retry: () => void};

// A failure is tried again when a word of that verse is shown anew, at most
// once per verse per interval (as useRewayahVerseUnits does), so stepping
// through the words of a verse does not repeat a read that keeps failing.
const lastAutoRetryAt = new Map<string, number>();

function claimAutoRetry(verseKey: string): boolean {
  const now = Date.now();
  const last = lastAutoRetryAt.get(verseKey);
  if (last !== undefined && now - last < REWAYAH_WORDS_RETRY_INTERVAL_MS) {
    return false;
  }
  lastAutoRetryAt.set(verseKey, now);
  return true;
}

/**
 * How the 8 rewayat read the word at word-by-word position `wbwPosition` of
 * Hafs verse `verseKey`. Requests the verse once (one query, cached by
 * WordReadingsService) and re-renders when it lands; never reads during a
 * render.
 */
export function useWordReadings(
  verseKey: string,
  wbwPosition: number,
): WordReadingsResult {
  const version = useSyncExternalStore(
    wordReadingsService.subscribe,
    wordReadingsService.getVersion,
  );
  // The verse this mounted component last asked for: a failure is tried
  // again only on the first run for a verse.
  const askedForRef = useRef<string | null>(null);

  useEffect(() => {
    const firstRun = askedForRef.current !== verseKey;
    askedForRef.current = verseKey;
    const status = wordReadingsService.getStatus(verseKey);
    if (status === 'idle') {
      wordReadingsService.request(verseKey);
    } else if (status === 'error' && firstRun && claimAutoRetry(verseKey)) {
      wordReadingsService.retry(verseKey);
    }
  }, [verseKey, version]);

  const retry = useCallback(() => {
    wordReadingsService.retry(verseKey);
  }, [verseKey]);

  return useMemo<WordReadingsResult>(() => {
    const dkPositions = dkPositionsForWbwWord(verseKey, wbwPosition);
    // Reads what is loaded; never loads (this runs during a render).
    const verse = wordReadingsService.peek(verseKey);
    if (verse) {
      try {
        return {
          status: 'ready',
          readings: readingsAt(verse, dkPositions),
          dkPositions,
        };
      } catch {
        return {status: 'error', retry};
      }
    }
    if (wordReadingsService.getStatus(verseKey) === 'error') {
      return {status: 'error', retry};
    }
    return {status: 'loading'};
    // version is the reactivity signal of the service's cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseKey, wbwPosition, version, retry]);
}
