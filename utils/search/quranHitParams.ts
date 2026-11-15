// @ai-generated
/**
 * The /mushaf params of a Quran search hit, and the reading of its `words`
 * param. A hit names its verse and its matched Digital Khatt slots, never a
 * page: the reader opens the page of the first matched slot once the Mushaf
 * data is ready (hooks/useMushafOpenTarget.ts), as it does for a saved verse.
 * No imports, so the Search tab and the verse sheet stay free of the reader.
 */

// A type alias (not an interface) so it is assignable to expo-router params.
export type QuranHitOpenParams = {
  surah: string;
  ayah: string;
  /** The first matched slot ('S:A:W'): the shown rewayah selects its verse. */
  anchor: string;
  /** The matched slots to flash, sorted and comma-separated ('3,4'). */
  words: string;
};

/** The /mushaf params that open `verseKey` ('S:A') on its matched slots. */
export function quranHitOpenParams(
  verseKey: string,
  positions: readonly number[],
): QuranHitOpenParams {
  const [surah, ayah] = verseKey.split(':');
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  const first = sorted[0] ?? 1;
  return {
    surah,
    ayah,
    anchor: `${verseKey}:${first}`,
    words: sorted.join(','),
  };
}

/** The slots of a `words` param ('3,4' → [3, 4]); invalid parts dropped. */
export function parseFlashWords(words: string | undefined): number[] {
  if (!words) return [];
  return words
    .split(',')
    .map(part => Number(part.trim()))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 255);
}
