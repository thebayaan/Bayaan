// @ai-generated
/**
 * Verse units for the audio surfaces (follow-along bands, playing verse
 * labels, Play from here / Repeat / Range), read without loading anything.
 *
 * The audio code computes bands and labels from the timing numbering and the
 * bundled verse maps (utils/timestampNumbering.ts). The verse units agree
 * with those maps whenever they are accepted (RewayahVerseUnitsService
 * refuses units that disagree with the bundled map), and the all-DB audio
 * test proves both give the same bands on every verse of every words DB.
 * A non-Hafs rewayah's own verse numbers are shown only while its verse units
 * are READY: refused units (data that breaks the slot model or disagrees
 * with its verse map) and units not in memory give no band and no verse
 * number, never Hafs numbers under the rewayah's name (verse-units contract
 * 2.1). Hafs needs no units: its units are the Hafs verses.
 *
 * The services are required lazily, so the player store and its tests load
 * the DigitalKhatt data service only when a non-Hafs rewayah asks for units
 * (tests mock this module).
 */

import type {RewayahVerseUnits} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

interface VerseUnitsSource {
  get(rewayah: RewayahId): RewayahVerseUnits | null;
}

interface CacheChangeSource {
  subscribeCacheChanges(listener: () => void): () => void;
}

/**
 * The verse units of `rewayah` when they are ready (its words are in memory
 * and the units were accepted), else null. Never loads words; the first call
 * for a loaded rewayah builds its units (tens of milliseconds, once per data
 * version).
 */
export function readyVerseUnits(rewayah: RewayahId): RewayahVerseUnits | null {
  try {
    const {rewayahVerseUnitsService} =
      require('@/services/mushaf/RewayahVerseUnitsService') as {
        rewayahVerseUnitsService: VerseUnitsSource;
      };
    return rewayahVerseUnitsService.get(rewayah);
  } catch (error) {
    console.warn('[playbackVerseUnits] Verse units unavailable:', error);
    return null;
  }
}

/**
 * True when audio surfaces may show `rewayah`'s own verse numbers and bands:
 * Hafs always, another rewayah only while its verse units are ready.
 */
export function canShowRewayahVerses(rewayah: RewayahId): boolean {
  return rewayah === 'hafs' || readyVerseUnits(rewayah) !== null;
}

/**
 * Calls `listener` whenever the words in memory change, i.e. whenever a
 * rewayah's verse units may have become ready or gone. Returns the
 * unsubscribe function (a no-op when the data service cannot load).
 */
export function subscribeVerseUnitsChanges(listener: () => void): () => void {
  try {
    const {digitalKhattDataService} =
      require('@/services/mushaf/DigitalKhattDataService') as {
        digitalKhattDataService: CacheChangeSource;
      };
    return digitalKhattDataService.subscribeCacheChanges(listener);
  } catch (error) {
    console.warn('[playbackVerseUnits] Cannot follow the words cache:', error);
    return () => undefined;
  }
}
