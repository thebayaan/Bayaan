// @ai-generated
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {RewayahVerseUnits} from '@/services/mushaf/RewayahVerseUnits';
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService';
import {hasTextData, type RewayahId} from '@/services/rewayah/RewayahIdentity';
import {REWAYAH_WORDS_RETRY_INTERVAL_MS} from '@/hooks/useRewayahWords';

/**
 * - 'ready': `units` holds the rewayah's verse units;
 * - 'loading': its words are loading or its units are being built (also
 *   briefly before either starts);
 * - 'error': its words failed to load, its units were refused, or startup
 *   failed to load the main cache they are read with: show no rewayah verse
 *   numbers (never Hafs numbers under the rewayah's name), and offer
 *   `retry`;
 * - 'unavailable': no words DB is bundled for it (or no rewayah given).
 */
export type RewayahVerseUnitsStatus =
  | 'ready'
  | 'loading'
  | 'error'
  | 'unavailable';

export interface RewayahVerseUnitsResult {
  units: RewayahVerseUnits | null;
  status: RewayahVerseUnitsStatus;
  /**
   * Tries again what failed ('error'): the words' load, startup's load of
   * the main cache, or the build of units that were refused.
   */
  retry: () => void;
}

// A failure is tried again when a surface showing that rewayah mounts (the
// player reopened, a row scrolled into view), at most once per rewayah per
// interval, as useRewayahWords does: rows mounting together or a reader
// scrolling do not repeat a load or a build that keeps failing. retry()
// tries at once.
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

/**
 * Tries again what failed for `rewayah`: its words or startup's main cache,
 * else its units.
 */
function retryVerseUnits(rewayah: RewayahId): void {
  const dk = digitalKhattDataService;
  const wordsReady = dk.getRewayahLoadState(rewayah) === 'ready';
  if (wordsReady && dk.initialized) {
    // The words are in memory: the units were refused. Build them again.
    rewayahVerseUnitsService.retry(rewayah);
    return;
  }
  // Its words failed to load; or they are in memory but startup failed to
  // load the main cache their units are read with: load that again.
  const target = wordsReady ? dk.rewayah : rewayah;
  dk.ensureRewayahLoaded(target, {retry: true}).catch(err => {
    console.warn(`[useRewayahVerseUnits] Loading ${target} failed:`, err);
  });
}

const noRetry = (): void => undefined;

const UNAVAILABLE: RewayahVerseUnitsResult = {
  units: null,
  status: 'unavailable',
  retry: noRetry,
};

/**
 * Verse units of `rewayah` (its own verses and numbering), for components.
 * Subscribes to the data service's cache version and to the units service's
 * version, loads the rewayah's words on demand whenever they are 'idle'
 * (also after a mushaf switch evicted them), and requests the units once the
 * words are in memory. Never builds during a render: the units service
 * builds them after interactions, in chunks, and the hook renders them when
 * that build ends ('loading' meanwhile).
 *
 * A failure ('error': the words failed to load, or the units were refused)
 * is tried again when the surface mounts (see claimAutoRetry) and by
 * `retry`; never in a loop on later cache changes.
 *
 * Like useRewayahWords, it retains the rewayah while mounted, so its words
 * are never evicted under it. The data service keeps only one idle side
 * copy: without the retain, two surfaces showing two rewayat other than the
 * mushaf's (Bookmarks list rows saved in Warsh and in al-Bazzi on a Hafs
 * mushaf) would evict each other's words on every load and load them again
 * on the next cache change, for as long as they stay mounted.
 */
export function useRewayahVerseUnits(
  rewayah: RewayahId | null,
): RewayahVerseUnitsResult {
  const cacheVersion = useSyncExternalStore(
    digitalKhattDataService.subscribeCacheChanges,
    digitalKhattDataService.getCacheVersion,
  );
  // Changes when a build ends (units accepted or refused).
  const unitsVersion = useSyncExternalStore(
    rewayahVerseUnitsService.subscribe,
    rewayahVerseUnitsService.getVersion,
  );
  const hasData = rewayah !== null && hasTextData(rewayah);

  // Retained from mount, before the load below lands, until unmount or
  // another rewayah: no other surface's load can evict it meanwhile.
  useEffect(() => {
    if (!rewayah || !hasData) return;
    return digitalKhattDataService.retainRewayah(rewayah);
  }, [rewayah, hasData]);

  // The rewayah this mounted surface last asked for: a failure is tried
  // again only on the first run for a rewayah (mount or a new rewayah).
  const askedForRef = useRef<RewayahId | null>(null);

  useEffect(() => {
    if (!rewayah || !hasData) return;
    const firstRun = askedForRef.current !== rewayah;
    askedForRef.current = rewayah;
    const status = rewayahVerseUnitsService.getStatus(rewayah);
    if (status === 'error') {
      if (firstRun && claimAutoRetry(rewayah)) retryVerseUnits(rewayah);
      return;
    }
    if (status !== 'idle') return;
    const load = digitalKhattDataService.getRewayahLoadState(rewayah);
    if (load === 'ready') {
      // Built after interactions, in chunks; the end of the build re-renders.
      rewayahVerseUnitsService.request(rewayah);
      return;
    }
    if (load !== 'idle') return;
    let cancelled = false;
    // Completion or failure bumps the cache version, which re-renders.
    digitalKhattDataService.ensureRewayahLoaded(rewayah).catch(err => {
      if (!cancelled) {
        console.warn(`[useRewayahVerseUnits] Loading ${rewayah} failed:`, err);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [rewayah, hasData, cacheVersion, unitsVersion]);

  const retry = useCallback(() => {
    if (rewayah && hasTextData(rewayah)) retryVerseUnits(rewayah);
  }, [rewayah]);

  return useMemo<RewayahVerseUnitsResult>(() => {
    if (!rewayah || !hasData) return UNAVAILABLE;
    // Reads what is built; never builds (this runs during a render).
    const units = rewayahVerseUnitsService.peek(rewayah);
    if (units) return {units, status: 'ready', retry};
    const status = rewayahVerseUnitsService.getStatus(rewayah);
    if (status === 'error' || status === 'unavailable') {
      return {units: null, status, retry};
    }
    return {units: null, status: 'loading', retry};
    // cacheVersion and unitsVersion are the reactivity signals of the two
    // services' caches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewayah, hasData, cacheVersion, unitsVersion, retry]);
}
