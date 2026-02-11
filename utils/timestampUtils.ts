import type {AyahTimestamp} from '@/types/timestamps';

/**
 * O(log n) binary search for the ayah containing a given playback position.
 * Array must be sorted by timestampFrom (ascending) — DB query returns this naturally.
 * Returns null if position is before the first ayah (e.g., Bismillah region).
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
 * Direct lookup by ayah number.
 * Uses index (ayah 1 → index 0) with linear fallback.
 */
export function findAyahTimestamp(
  timestamps: AyahTimestamp[],
  ayahNumber: number,
): AyahTimestamp | null {
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
