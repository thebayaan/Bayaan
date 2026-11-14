// @ai-generated
/**
 * Word positions of the Hafs text in its two numberings:
 * - Digital Khatt slots (the mushaf words, data/mushaf/digitalkhatt);
 * - QUL word positions (word by word, the i'rab data, word audio).
 * They agree everywhere except in three verses, where Digital Khatt draws
 * «بَعْدَ مَا» as two slots and QUL counts one word: 2:181 (slots 3-4),
 * 8:6 (4-5) and 13:37 (8-9). utils/__tests__/quranWordPositions.test.ts and
 * the search index build check this against both DBs.
 */

/** The DK slot of the split-off «ما» in each verse that has one. */
export const DK_SPLIT_SLOTS: Readonly<Record<string, number>> = {
  '2:181': 4,
  '8:6': 5,
  '13:37': 9,
};

const SPLITS: ReadonlyMap<string, number> = new Map(
  Object.entries(DK_SPLIT_SLOTS),
);

/** The QUL position of a DK slot (both slots of «بعد ما» give one). */
export function dkToQulPosition(verseKey: string, dkPosition: number): number {
  const split = SPLITS.get(verseKey);
  return split !== undefined && dkPosition >= split
    ? dkPosition - 1
    : dkPosition;
}

/** The DK slots of a QUL word: two for «بعد ما», one everywhere else. */
export function qulToDkPositions(
  verseKey: string,
  qulPosition: number,
): readonly number[] {
  const split = SPLITS.get(verseKey);
  if (split === undefined || qulPosition < split - 1) return [qulPosition];
  if (qulPosition === split - 1) return [split - 1, split];
  return [qulPosition + 1];
}
