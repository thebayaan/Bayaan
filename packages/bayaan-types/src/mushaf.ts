/**
 * Ayah timing data for verse-by-verse follow-along.
 *
 * Times are millisecond offsets from the beginning of a recitation track.
 */
export interface AyahTimestamp {
  ayahNumber: number;
  timestampFromMs: number;
  timestampToMs: number;
}
