// @ai-generated
import {useEffect, useMemo, useSyncExternalStore} from 'react';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {RewayahVerseUnits} from '@/services/mushaf/RewayahVerseUnits';
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService';
import {hasTextData, type RewayahId} from '@/services/rewayah/RewayahIdentity';

/**
 * - 'ready': `units` holds the rewayah's verse units;
 * - 'loading': its words are loading (also briefly before the first load);
 * - 'error': its words failed to load or its units were refused: show no
 *   rewayah verse numbers (never Hafs numbers under the rewayah's name);
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
}

const UNAVAILABLE: RewayahVerseUnitsResult = {
  units: null,
  status: 'unavailable',
};

/**
 * Verse units of `rewayah` (its own verses and numbering), for components.
 * Same reactivity as useRewayahWords: subscribes to the data service's
 * cache version, loads the rewayah's words on demand whenever they are
 * 'idle' (also after a mushaf switch evicted them), and never retries a
 * failed load in a loop.
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
  const hasData = rewayah !== null && hasTextData(rewayah);

  // Retained from mount, before the load below lands, until unmount or
  // another rewayah: no other surface's load can evict it meanwhile.
  useEffect(() => {
    if (!rewayah || !hasData) return;
    return digitalKhattDataService.retainRewayah(rewayah);
  }, [rewayah, hasData]);

  useEffect(() => {
    if (!rewayah || !hasData) return;
    if (digitalKhattDataService.getRewayahLoadState(rewayah) !== 'idle') {
      return;
    }
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
  }, [rewayah, hasData, cacheVersion]);

  return useMemo<RewayahVerseUnitsResult>(() => {
    if (!rewayah || !hasData) return UNAVAILABLE;
    const units = rewayahVerseUnitsService.get(rewayah);
    if (units) return {units, status: 'ready'};
    const status = rewayahVerseUnitsService.getStatus(rewayah);
    if (status === 'error' || status === 'unavailable') {
      return {units: null, status};
    }
    return {units: null, status: 'loading'};
    // cacheVersion is the reactivity signal for the data service's caches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewayah, hasData, cacheVersion]);
}
