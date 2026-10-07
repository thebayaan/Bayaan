import type {AyahTimestamp} from '@/types/timestamps';
import {getRegisteredTimingNumbering} from '@/utils/timestampNumbering';

export {getTrackedVerseKeys} from '@/utils/timestampNumbering';

/**
 * O(log n) binary search for the ayah containing a given playback position.
 * Array must be sorted by timestampFrom (ascending) — DB query returns this naturally.
 * Returns null if position is before the first ayah (e.g., Bismillah region).
 * The returned entry carries the timing set's own ayah number; translate it
 * with the surah's TimingNumbering before using it as a Hafs verse.
 */
export function binarySearchAyah(
  timestamps: AyahTimestamp[],
  positionMs: number,
): AyahTimestamp | null {
  if (timestamps.length === 0) return null;

  // Before first ayah (bismillah region)
  if (positionMs < timestamps[0].timestampFrom) return null;

  let low = 0;
  let high = timestamps.length - 1;
  let result: AyahTimestamp | null = null;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (timestamps[mid].timestampFrom <= positionMs) {
      result = timestamps[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

/**
 * Timing entry where playback of HAFS ayah `ayahNumber` starts (the ayah of a
 * mushaf / verse-list verse key).
 *
 * When the follow-along tracker has registered a numbering for this exact
 * array (rewayah-numbered timings), the lookup goes through it: the first
 * timing entry whose recitation contains the Hafs verse. While that numbering
 * is still resolving, or when it could not be established for the surah,
 * returns null rather than an entry for a different verse. Otherwise the
 * entries are Hafs-numbered: direct lookup by ayah number.
 */
export function findAyahTimestamp(
  timestamps: AyahTimestamp[],
  ayahNumber: number,
): AyahTimestamp | null {
  const numbering = getRegisteredTimingNumbering(timestamps);
  if (numbering === 'pending') return null;
  if (numbering && numbering.mode !== 'hafs') {
    return numbering.startEntryForHafsAyah(ayahNumber);
  }

  // Fast path: direct index access (most surahs have consecutive ayahs starting at 1)
  const index = ayahNumber - 1;
  if (
    index >= 0 &&
    index < timestamps.length &&
    timestamps[index].ayahNumber === ayahNumber
  ) {
    return timestamps[index];
  }

  // Fallback: linear scan (array is small, max 286)
  return timestamps.find(t => t.ayahNumber === ayahNumber) ?? null;
}
