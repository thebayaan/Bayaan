import {
  decodeEntries,
  decodeMorph,
  mergeBookPassages,
  parseWordKey,
  quotableWord,
  splitRefs,
  type IrabBookPassages,
} from '../irabFormat';

const texts = ['', 'الواو', 'حرف عطف', 'خبر {{3}} محذوف', 'الجذر', 'ك ت ب'];

describe('decodeEntries', () => {
  it('decodes kinds, labels, texts and spans', () => {
    const json = JSON.stringify([
      ['p', 1, 2],
      ['i', 0, 3],
      ['h', 0, 2, '2:3:1', '2:3:4'],
    ]);
    expect(decodeEntries(json, texts)).toEqual([
      {kind: 'prefix', label: 'الواو', text: 'حرف عطف'},
      {kind: 'implied', label: '', text: 'خبر {{3}} محذوف'},
      {kind: 'phrase', label: '', text: 'حرف عطف', span: ['2:3:1', '2:3:4']},
    ]);
  });

  it('skips unknown kinds and text ids, and survives bad JSON', () => {
    expect(
      decodeEntries(
        JSON.stringify([
          ['z', 1, 2],
          ['s', 1, 99],
        ]),
        texts,
      ),
    ).toEqual([]);
    expect(decodeEntries('not json', texts)).toEqual([]);
    expect(decodeEntries('{}', texts)).toEqual([]);
  });
});

describe('decodeMorph', () => {
  it('decodes label / value pairs', () => {
    expect(decodeMorph('[[4,5]]', texts)).toEqual([
      {label: 'الجذر', value: 'ك ت ب'},
    ]);
  });

  it('skips rows with unknown ids', () => {
    expect(decodeMorph('[[4,99],[1,2]]', texts)).toEqual([
      {label: 'الواو', value: 'حرف عطف'},
    ]);
    expect(decodeMorph('oops', texts)).toEqual([]);
  });
});

describe('splitRefs', () => {
  it('splits same-verse and other-verse word references', () => {
    expect(splitRefs('خبر {{3}} محذوف، معطوف على {{2:4:1}}', '2:5')).toEqual([
      {type: 'text', text: 'خبر '},
      {type: 'ref', verseKey: '2:5', position: 3},
      {type: 'text', text: ' محذوف، معطوف على '},
      {type: 'ref', verseKey: '2:4', position: 1},
    ]);
  });

  it('returns plain text unchanged', () => {
    expect(splitRefs('مبتدأ مرفوع', '1:2')).toEqual([
      {type: 'text', text: 'مبتدأ مرفوع'},
    ]);
  });
});

describe('parseWordKey', () => {
  it('parses s:a:w', () => {
    expect(parseWordKey('2:255:7')).toEqual({verseKey: '2:255', position: 7});
    expect(parseWordKey('2:255')).toBeNull();
  });
});

describe('quotableWord', () => {
  it('drops pause and verse-end marks', () => {
    expect(quotableWord('رَّبِّهِمْ ۖ')).toBe('رَّبِّهِمْ');
    expect(quotableWord('ٱلدِّينِ ۚ')).toBe('ٱلدِّينِ');
  });

  // DigitalKhatt slots, written code point by code point. U+06DC (small
  // high seen) belongs to the word: it is no pause mark.
  it('keeps the small high seen over the sad (2:245:14, 7:69:22)', () => {
    const yabsut =
      '\u0648\u064E\u064A\u064E\u0628\u0652\u0635\u06DC\u064F\u0637\u064F';
    expect(quotableWord(yabsut)).toBe(yabsut);
    // 7:69:22 ends with a pause mark (U+06D6): it goes, the seen stays.
    const bastah = '\u0628\u064E\u0635\u06DC\u0652\u0637\u064E\u0629\u08F0';
    expect(quotableWord(`${bastah}\u06D6`)).toBe(bastah);
  });

  it('keeps the saktah sign (18:1:11, 36:52:6, 75:27:2)', () => {
    const iwaja = '\u0639\u0650\u0648\u064E\u062C\u064E\u0627\u06DC';
    expect(quotableWord(iwaja)).toBe(iwaja);
    // 36:52:6: the saktah stays, the pause mark after it (U+06D7) goes.
    const marqadina =
      '\u0645\u0651\u064E\u0631\u0652\u0642\u064E\u062F\u0650\u0646\u064E\u0627\u06DC';
    expect(quotableWord(`${marqadina}\u06D7`)).toBe(marqadina);
    // 75:27:2: a combining grapheme joiner (U+034F) before the sign.
    const man = '\u0645\u064E\u0646\u0652\u034F\u06DC';
    expect(quotableWord(man)).toBe(man);
  });
});

describe('mergeBookPassages', () => {
  /** A book with placeholder passages of these ids. */
  const book = (bookId: number, ...ids: number[]): IrabBookPassages => ({
    bookId,
    nameAr: `\u0643\u062A\u0627\u0628 ${bookId}`,
    authorAr: '\u0645\u0624\u0644\u0641',
    passages: ids.map(id => ({
      id,
      text: `\u0646\u0635 ${id}`,
      part: '1',
      page: `${id}`,
    })),
  });

  it('shows a page shared by several verses once, under all of them (100:1-5)', () => {
    const verses = ['100:1', '100:2', '100:3', '100:4', '100:5'];
    const parts = verses.map(verseKey => ({
      verseKey,
      books: [book(309, 34), book(318, 1343)],
    }));
    expect(mergeBookPassages(parts)).toEqual([
      {verseKeys: verses, books: [book(309, 34), book(318, 1343)]},
    ]);
  });

  it("keeps a verse's own passages under it, in reading order", () => {
    const parts = [
      {verseKey: '2:1', books: [book(309, 1, 2)]},
      {verseKey: '2:2', books: [book(309, 2, 3), book(318, 9)]},
      {verseKey: '2:3', books: []},
    ];
    expect(mergeBookPassages(parts)).toEqual([
      {verseKeys: ['2:1'], books: [book(309, 1)]},
      {verseKeys: ['2:1', '2:2'], books: [book(309, 2)]},
      {verseKeys: ['2:2'], books: [book(309, 3), book(318, 9)]},
    ]);
  });
});
