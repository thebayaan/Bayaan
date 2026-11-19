import {
  decodeEntries,
  decodeMorph,
  parseWordKey,
  quotableWord,
  splitRefs,
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
