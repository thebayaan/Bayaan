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
});
