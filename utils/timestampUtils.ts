import type {AyahTimestamp} from '@/types/timestamps';
import {
  getRegisteredTimingNumbering,
  type MappedAyahTrackingState, // @ai
} from '@/utils/timestampNumbering';

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

// @ai-start
/** "Play from here" while the verse numbering of the surah is being resolved. */
export const PLAY_FROM_HERE_PENDING = {
  title: 'Preparing verse timing',
  message: 'Try again in a moment.',
} as const;

/** "Play from here" where no verse of the timing set can be found. */
export const PLAY_FROM_HERE_UNAVAILABLE = {
  title: "Can't start at this verse",
  message:
    "This reciter's timings for this surah can't be matched to its verses.",
} as const;

export type PlayFromHereTarget =
  | {
      status: 'ready';
      /** Timing entry to seek to (its start). */
      entry: AyahTimestamp;
      /** Follow-along state to publish: every Hafs verse the entry recites. */
      tracking: MappedAyahTrackingState;
    }
  | {status: 'pending' | 'unavailable'; title: string; message: string};

/**
 * Where the main player's "Play from here" on Hafs verse `hafsVerseKey`
 * starts, or why it cannot start, so the caller can tell the user instead of
 * doing nothing: 'pending' while the surah's timings or their verse numbering
 * are still loading, 'unavailable' when the numbering could not be
 * established for the surah or the timings have no entry for the verse.
 * Hafs-numbered timings resolve exactly as findAyahTimestamp always did.
 */
export function getPlayFromHereTarget(
  timestamps: AyahTimestamp[] | null | undefined,
  hafsVerseKey: string,
): PlayFromHereTarget {
  if (!timestamps) return {status: 'pending', ...PLAY_FROM_HERE_PENDING};
  const numbering = getRegisteredTimingNumbering(timestamps);
  if (numbering === 'pending') {
    return {status: 'pending', ...PLAY_FROM_HERE_PENDING};
  }
  if (numbering && numbering.mode === 'disabled') {
    return {status: 'unavailable', ...PLAY_FROM_HERE_UNAVAILABLE};
  }
  const [surahStr, ayahStr] = hafsVerseKey.split(':');
  const hafsAyah = parseInt(ayahStr, 10);
  const entry = Number.isNaN(hafsAyah)
    ? null
    : findAyahTimestamp(timestamps, hafsAyah);
  if (!entry) return {status: 'unavailable', ...PLAY_FROM_HERE_UNAVAILABLE};

  const surah = entry.surahNumber || parseInt(surahStr, 10);
  const keys =
    numbering && numbering.mode === 'riwayah'
      ? numbering.hafsKeysForEntry(entry.ayahNumber)
      : [`${surah}:${entry.ayahNumber}`];
  const verseKeys = keys.length > 0 ? keys : [hafsVerseKey];
  const primary = verseKeys[0];
  return {
    status: 'ready',
    entry,
    tracking: {
      surahNumber: entry.surahNumber,
      ayahNumber: parseInt(primary.split(':')[1], 10),
      verseKey: primary,
      timestampFrom: entry.timestampFrom,
      timestampTo: entry.timestampTo,
      verseKeys,
      reciterVerseKey: `${entry.surahNumber}:${entry.ayahNumber}`,
    },
  };
}
// @ai-end
