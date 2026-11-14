// @ai-generated
/**
 * The DigitalKhatt / word-by-word word pairing (services/wbw/wordAlignment.ts)
 * on the shapes of the bundled data: verses paired 1:1, بَعْدَ مَا written as
 * two slots (2:181), and damaged word-by-word texts that used to shift the
 * pairing (25:42: U+FFFD; 27:26: ۩ and U+200F). The invisible characters are
 * written as escapes. wordAlignment.database.test.ts runs every verse of the
 * bundled data.
 */
import {
  alignDkWithWbw,
  isVerseEndMarker,
  normalizeForMatch,
  slotsByWbwPosition,
  type DkSlot,
  type DkWbwAlignment,
  type WbwToken,
} from '../wordAlignment';

const dk = (texts: readonly string[]): DkSlot[] =>
  texts.map((text, i) => ({text, wordPositionInVerse: i + 1}));
const wbw = (texts: readonly string[]): WbwToken[] =>
  texts.map((textUthmani, i) => ({textUthmani, position: i + 1}));

/** Each pair as 'slot>word' (DigitalKhatt slot position > word-by-word position). */
const shape = (a: DkWbwAlignment): string[] =>
  a.pairs.map(p => `${p.dk.wordPositionInVerse}>${p.wbw.position}`);

const oneToOne = (n: number): string[] =>
  Array.from({length: n}, (_, i) => `${i + 1}>${i + 1}`);

// Hafs 2:181 (bundled texts): DigitalKhatt writes بَعْدَ مَا as slots 3 and 4,
// word by word as word 3.
const DK_2_181 = [
  'فَمَنۢ',
  'بَدَّلَهُۥ',
  'بَعْدَ',
  'مَا',
  'سَمِعَهُۥ',
  'فَإِنَّمَآ',
  'إِثْمُهُۥ',
  'عَلَى',
  'ٱلَّذِينَ',
  'يُبَدِّلُونَهُۥٓۚ',
  'إِنَّ',
  'ٱللَّهَ',
  'سَمِيعٌ',
  'عَلِيمࣱ',
  '۝١٨١',
];
const WBW_2_181 = [
  'فَمَنۢ',
  'بَدَّلَهُۥ',
  'بَعْدَ مَا',
  'سَمِعَهُۥ',
  'فَإِنَّمَآ',
  'إِثْمُهُۥ',
  'عَلَى',
  'ٱلَّذِينَ',
  'يُبَدِّلُونَهُۥٓ ۚ',
  'إِنَّ',
  'ٱللَّهَ',
  'سَمِيعٌ',
  'عَلِيمٌۭ',
];

// Hafs 25:42: word-by-word word 9 is 'عَلَيْهَا' + ' ' + two U+FFFD.
const DK_25_42 = [
  'إِن',
  'كَادَ',
  'لَيُضِلُّنَا',
  'عَنْ',
  'ءَالِهَتِنَا',
  'لَوْلَآ',
  'أَن',
  'صَبَرْنَا',
  'عَلَيْهَاۚ',
  'وَسَوْفَ',
  'يَعْلَمُونَ',
  'حِينَ',
  'يَرَوْنَ',
  'ٱلْعَذَابَ',
  'مَنْ',
  'أَضَلُّ',
  'سَبِيلًا',
  '۝٤٢',
];
const WBW_25_42 = [
  ...DK_25_42.slice(0, 8),
  'عَلَيْهَا \uFFFD\uFFFD',
  ...DK_25_42.slice(9, 17),
];

// Hafs 27:26: word-by-word word 8 is 'ٱلْعَظِيمِ' + ' ' + ۩ (U+06E9) + U+200F.
const DK_27_26 = [
  'ٱللَّهُ',
  'لَآ',
  'إِلَٰهَ',
  'إِلَّا',
  'هُوَ',
  'رَبُّ',
  'ٱلْعَرْشِ',
  'ٱلْعَظِيمِ۩',
  '۝٢٦',
];
const WBW_27_26 = [
  'ٱللَّهُ',
  'لَآ',
  'إِلَـٰهَ',
  'إِلَّا',
  'هُوَ',
  'رَبُّ',
  'ٱلْعَرْشِ',
  'ٱلْعَظِيمِ ۩\u200F',
];

describe('normalizeForMatch', () => {
  it('drops the diacritics and the pause and sajdah marks', () => {
    expect(normalizeForMatch('بَعْدَ')).toBe('بعد');
    expect(normalizeForMatch('يُبَدِّلُونَهُۥٓ ۚ')).toBe('يبدلونه');
    expect(normalizeForMatch('عَلِيمࣱ')).toBe(normalizeForMatch('عَلِيمٌۭ'));
  });

  it('drops U+FFFD, the LRM / RLM marks and the Arabic letter mark', () => {
    expect(normalizeForMatch(WBW_25_42[8])).toBe('عليها');
    expect(normalizeForMatch(WBW_27_26[7])).toBe(
      normalizeForMatch(DK_27_26[7]),
    );
    expect(normalizeForMatch('\u200Eفي\u061C')).toBe('في');
  });

  it('collapses spaces and keeps the space between two words', () => {
    expect(normalizeForMatch('  بَعْدَ \n\t مَا ')).toBe('بعد ما');
  });

  it('leaves nothing of a verse-end marker', () => {
    expect(normalizeForMatch('۝١٨١')).toBe('');
  });
});

describe('isVerseEndMarker', () => {
  it('is true for a marker slot only', () => {
    expect(isVerseEndMarker('۝٧')).toBe(true);
    expect(isVerseEndMarker('۝٢٨٦')).toBe(true);
    expect(isVerseEndMarker('۝۱۲')).toBe(true);
    expect(isVerseEndMarker('۝')).toBe(false);
    expect(isVerseEndMarker('')).toBe(false);
    expect(isVerseEndMarker(DK_27_26[7])).toBe(false);
    // A word ending with an inline marker (Warsh 1:7:4) is a word.
    expect(isVerseEndMarker('عَلَي۟هِم۟ ۝٦')).toBe(false);
  });
});

describe('alignDkWithWbw', () => {
  it('pairs as many slots as words 1:1 and takes the marker out', () => {
    const slots = dk(['بِسْمِ', 'ٱللَّهِ', 'ٱلرَّحْمَٰنِ', 'ٱلرَّحِيمِ', '۝١']);
    const a = alignDkWithWbw(
      slots,
      wbw(['بِسْمِ', 'ٱللَّهِ', 'ٱلرَّحْمَـٰنِ', 'ٱلرَّحِيمِ']),
    );
    expect(shape(a)).toEqual(oneToOne(4));
    expect(a.endMarker).toBe(slots[4]);
  });

  it('never compares text when the counts agree', () => {
    const a = alignDkWithWbw(
      dk(['فِي', 'ٱلْأَرْضِ', '۝٢']),
      wbw(['فِى', 'unrelated']),
    );
    expect(shape(a)).toEqual(oneToOne(2));
  });

  it('pairs both slots of بَعْدَ مَا with one word and shifts the rest (2:181)', () => {
    const slots = dk(DK_2_181);
    const words = wbw(WBW_2_181);
    const a = alignDkWithWbw(slots, words);
    expect(shape(a)).toEqual([
      '1>1',
      '2>2',
      '3>3',
      '4>3',
      ...Array.from({length: 10}, (_, i) => `${i + 5}>${i + 4}`),
    ]);
    expect(a.endMarker).toBe(slots[14]);
    expect(slotsByWbwPosition(a.pairs).get(3)).toEqual([3, 4]);
    expect(slotsByWbwPosition(a.pairs).get(13)).toEqual([14]);
  });

  it('keeps 25:42 1:1 despite the U+FFFD word, with the marker as the end marker', () => {
    const slots = dk(DK_25_42);
    const a = alignDkWithWbw(slots, wbw(WBW_25_42));
    expect(shape(a)).toEqual(oneToOne(17));
    expect(a.endMarker).toBe(slots[17]);
  });

  it('keeps 27:26 1:1 despite ۩ and U+200F, with the marker as the end marker', () => {
    const slots = dk(DK_27_26);
    const a = alignDkWithWbw(slots, wbw(WBW_27_26));
    expect(shape(a)).toEqual(oneToOne(8));
    expect(a.endMarker).toBe(slots[8]);
  });

  it('does not stall on damaged text while accumulating', () => {
    // An N:1 verse whose later words carry the 25:42 and 27:26 damage.
    const a = alignDkWithWbw(
      dk(['بَعْدَ', 'مَا', 'عَلَيْهَاۚ', 'وَسَوْفَ', 'ٱلْعَظِيمِ۩', '۝٢']),
      wbw(['بَعْدَ مَا', WBW_25_42[8], 'وَسَوْفَ', WBW_27_26[7]]),
    );
    expect(shape(a)).toEqual(['1>1', '2>1', '3>2', '4>3', '5>4']);
    expect(a.endMarker?.wordPositionInVerse).toBe(6);
  });

  it('pairs slots left after the last word with that word', () => {
    const a = alignDkWithWbw(dk(['أ', 'ب', 'ج', '۝٣']), wbw(['د', 'ه']));
    expect(shape(a)).toEqual(['1>1', '2>2', '3>2']);
    expect(a.endMarker?.wordPositionInVerse).toBe(4);
  });

  it('never pairs the marker, even with a word left over', () => {
    const slots = dk(['كَلِمَةࣱ', '۝١']);
    const a = alignDkWithWbw(slots, wbw(['كَلِمَةٌ', 'زائدة']));
    expect(shape(a)).toEqual(['1>1']);
    expect(a.endMarker).toBe(slots[1]);
  });

  it('gives no pairs without word-by-word words or without slots', () => {
    const slots = dk(['بِسْمِ', '۝١']);
    expect(alignDkWithWbw(slots, [])).toEqual({
      pairs: [],
      endMarker: slots[1],
    });
    expect(alignDkWithWbw([], wbw(['بِسْمِ']))).toEqual({
      pairs: [],
      endMarker: null,
    });
  });

  it("returns the caller's own objects", () => {
    const slots = [
      {text: 'بِسْمِ', wordPositionInVerse: 1, verseKey: '1:1'},
      {text: '۝١', wordPositionInVerse: 2, verseKey: '1:1'},
    ];
    const words = [
      {position: 1, textUthmani: 'بِسْمِ', translation: 'In (the) name'},
    ];
    const a = alignDkWithWbw(slots, words);
    expect(a.pairs[0].dk).toBe(slots[0]);
    expect(a.pairs[0].wbw.translation).toBe('In (the) name');
    expect(a.endMarker?.verseKey).toBe('1:1');
  });
});

describe('slotsByWbwPosition', () => {
  it("lists each word's slots in slot order", () => {
    const a = alignDkWithWbw(dk(DK_25_42), wbw(WBW_25_42));
    const slots = slotsByWbwPosition(a.pairs);
    expect(slots.size).toBe(17);
    expect(slots.get(9)).toEqual([9]);
    expect(slots.get(17)).toEqual([17]);
  });
});
