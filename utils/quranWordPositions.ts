// @ai-generated
/**
 * Word positions of the Hafs text in its two numberings:
 * - Digital Khatt slots (the mushaf words, data/mushaf/digitalkhatt);
 * - QUL word positions (word by word, the i'rab data, word audio).
 * They agree everywhere except in three verses, where Digital Khatt draws
 * «بَعْدَ مَا» as two slots and QUL counts one word: 2:181 (slots 3-4),
 * 8:6 (4-5) and 13:37 (8-9). utils/__tests__/quranWordPositions.test.ts and
 * the search index build check this against both DBs.
 *
 * The QPC tajweed data numbers its words as Digital Khatt does, except in
 * 37:130 (DK_SLOT_QPC_TAJWEED_WORDS, checked by the same test).
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

/**
 * The QPC tajweed words (data/QPC Hafs Tajweed 2.json) of the DK slots that
 * are not simply the QPC word at their own position. DK writes
 * «إِلْ يَاسِينَ» (37:130) as one slot, slot 3, where QPC has two words, 3
 * and 4; QPC gives that verse no verse-number entry, so its end marker
 * (slot 4) has none. Everywhere else slot n is QPC word n; in the sajdah
 * verses QPC lists ۩ in the end marker's place, which carries no rule.
 */
export const DK_SLOT_QPC_TAJWEED_WORDS: Readonly<
  Record<string, Readonly<Record<number, readonly number[]>>>
> = {
  '37:130': {3: [3, 4], 4: []},
};

/** The QPC tajweed word positions of a Hafs DK slot, in order. */
export function dkToQpcTajweedPositions(
  verseKey: string,
  dkPosition: number,
): readonly number[] {
  return DK_SLOT_QPC_TAJWEED_WORDS[verseKey]?.[dkPosition] ?? [dkPosition];
}

/** A run of QPC tajweed text and its rule (utils/tajweedLoader.ts). */
export interface QpcTajweedSegment {
  text: string;
  rule: string | null;
}

/** One word of the QPC tajweed data; `location` is 's:a:w'. */
export interface QpcTajweedWord {
  location: string;
  segments: QpcTajweedSegment[];
}

const WORD_SPACE: QpcTajweedSegment = {text: ' ', rule: null};

/**
 * The tajweed segments to align onto a Hafs DK slot, from the QPC words of
 * its verse (IndexedTajweedData[verseKey]): those of its QPC word, or, for a
 * slot of two QPC words, both joined by a space as the slot writes them.
 * Null when QPC has no word for the slot.
 */
export function slotTajweedSegments(
  verseWords: readonly QpcTajweedWord[],
  dkPosition: number,
): QpcTajweedSegment[] | null {
  if (verseWords.length === 0) return null;
  const verseKey = verseWords[0].location.split(':').slice(0, 2).join(':');
  const words = dkToQpcTajweedPositions(verseKey, dkPosition).flatMap(
    position => {
      const word = verseWords.find(
        w => Number(w.location.split(':')[2]) === position,
      );
      return word ? [word] : [];
    },
  );
  if (words.length === 0) return null;
  if (words.length === 1) return words[0].segments;
  return words.flatMap((word, i) =>
    i === 0 ? word.segments : [WORD_SPACE, ...word.segments],
  );
}
