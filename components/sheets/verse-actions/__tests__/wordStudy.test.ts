// @ai-generated
/**
 * The Word Study word model (wordStudy.ts): the sequence a selection steps
 * through, built from the real Hafs DigitalKhatt slots of the verse-units
 * fixture (services/mushaf/__fixtures__/verseUnitsFixture.json), word
 * references, the root and lemma of a word's morphology (real facts of the
 * bundled i'rab), and the React Native Quran face.
 */
import type {MorphFact} from '@/services/irab/irabFormat';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import type {WBWWord} from '@/services/wbw/WBWDataService';
import type {WordStudyPart} from '../verseUnitScreens';
import {
  buildWordSequence,
  indexOfWord,
  rnQuranFontFamily,
  rootSearchKey,
  sameWord,
  summarizeMorph,
  type PartWords,
} from '../wordStudy';

const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    locations: string[];
    texts: {hafs: string[]};
  };

/** The Hafs DigitalKhatt slots of a fixture verse, its marker included. */
function hafsSlots(verseKey: string): DKWordInfo[] {
  const out: DKWordInfo[] = [];
  fixture.locations.forEach((location, i) => {
    const [s, a, w] = location.split(':');
    if (`${s}:${a}` === verseKey) {
      out.push({
        text: fixture.texts.hafs[i],
        verseKey,
        wordPositionInVerse: Number(w),
      });
    }
  });
  if (out.length === 0) throw new Error(`no fixture verse ${verseKey}`);
  return out;
}

/** Word-by-word words for slots (one per word slot; the texts only label them). */
function wbwOf(slots: readonly DKWordInfo[]): WBWWord[] {
  return slots
    .filter(slot => !slot.text.startsWith('۝'))
    .map((slot, i) => ({
      position: i + 1,
      textUthmani: slot.text,
      translation: `t${i + 1}`,
      transliteration: '',
      audioUrl: '',
    }));
}

function loaded(...verseKeys: string[]): Map<string, PartWords> {
  return new Map(
    verseKeys.map(key => {
      const dk = hafsSlots(key);
      return [key, {dk, wbw: wbwOf(dk)}];
    }),
  );
}

const refs = (sequence: ReturnType<typeof buildWordSequence>) =>
  sequence.map(w => `${w.verseKey}:${w.position}`);

describe('buildWordSequence', () => {
  it('Warsh 1:6: the first four words of Hafs 1:7, with their own slots and text', () => {
    const parts: WordStudyPart[] = [
      {verseKey: '1:7', caption: 'hafsVerse', wordRange: {first: 1, last: 4}},
    ];
    const slots = hafsSlots('1:7');
    const sequence = buildWordSequence(parts, loaded('1:7'));
    expect(sequence).toEqual(
      [1, 2, 3, 4].map((position, index) => ({
        verseKey: '1:7',
        position,
        index,
        part: 0,
        slots: [`1:7:${position}`],
        text: slots[position - 1].text,
      })),
    );
  });

  it('Warsh 1:7: words 5 to 9 of Hafs 1:7, without the end marker', () => {
    const parts: WordStudyPart[] = [
      {verseKey: '1:7', caption: 'hafsVerse', wordRange: {first: 5, last: 10}},
    ];
    const sequence = buildWordSequence(parts, loaded('1:7'));
    expect(refs(sequence)).toEqual([
      '1:7:5',
      '1:7:6',
      '1:7:7',
      '1:7:8',
      '1:7:9',
    ]);
    expect(sequence.map(w => w.index)).toEqual([0, 1, 2, 3, 4]);
    expect(sequence.some(w => w.text.includes('۝'))).toBe(false);
  });

  it('a whole verse: every word, never the marker', () => {
    const sequence = buildWordSequence(
      [{verseKey: '1:7', caption: 'none'}],
      loaded('1:7'),
    );
    expect(sequence).toHaveLength(9);
    expect(sequence[8].slots).toEqual(['1:7:9']);
  });

  it('runs across parts in reading order (Warsh 103:1, Bazzi 71:24)', () => {
    const merged = buildWordSequence(
      [
        {verseKey: '103:1', caption: 'hafsVerse'},
        {verseKey: '103:2', caption: 'hafsVerse'},
      ],
      loaded('103:1', '103:2'),
    );
    expect(refs(merged)).toEqual([
      '103:1:1',
      '103:2:1',
      '103:2:2',
      '103:2:3',
      '103:2:4',
    ]);
    expect(merged.map(w => [w.index, w.part])).toEqual([
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ]);

    const split = buildWordSequence(
      [
        {
          verseKey: '71:23',
          caption: 'hafsVerse',
          wordRange: {first: 10, last: 14},
        },
        {
          verseKey: '71:24',
          caption: 'hafsVerse',
          wordRange: {first: 1, last: 3},
        },
      ],
      loaded('71:23', '71:24'),
    );
    expect(refs(split)).toEqual([
      '71:23:10',
      '71:23:11',
      '71:23:12',
      '71:23:13',
      '71:24:1',
      '71:24:2',
      '71:24:3',
    ]);
  });

  it('gives a word written as two slots both slots and shifts the words after it', () => {
    // The start of Hafs 2:181: بَعْدَ مَا is slots 3 and 4, word-by-word word 3.
    const dk: DKWordInfo[] = [
      'فَمَنۢ',
      'بَدَّلَهُۥ',
      'بَعْدَ',
      'مَا',
      'سَمِعَهُۥ',
      '۝١٨١',
    ].map((text, i) => ({text, verseKey: '2:181', wordPositionInVerse: i + 1}));
    const wbw: WBWWord[] = [
      'فَمَنۢ',
      'بَدَّلَهُۥ',
      'بَعْدَ مَا',
      'سَمِعَهُۥ',
    ].map((textUthmani, i) => ({
      position: i + 1,
      textUthmani,
      translation: '',
      transliteration: '',
      audioUrl: '',
    }));
    const sequence = buildWordSequence(
      [{verseKey: '2:181', caption: 'none'}],
      new Map([['2:181', {dk, wbw}]]),
    );
    expect(sequence.map(w => [w.position, w.slots])).toEqual([
      [1, ['2:181:1']],
      [2, ['2:181:2']],
      [3, ['2:181:3', '2:181:4']],
      [4, ['2:181:5']],
    ]);
    expect(sequence[2].text).toBe('بَعْدَ مَا');
  });

  it('adds no words for a part whose words are not loaded', () => {
    const sequence = buildWordSequence(
      [
        {verseKey: '1:6', caption: 'verse'},
        {verseKey: '1:7', caption: 'verse'},
      ],
      loaded('1:7'),
    );
    expect(sequence).toHaveLength(9);
    expect(sequence[0]).toMatchObject({verseKey: '1:7', index: 0, part: 1});
  });
});

describe('word references', () => {
  const sequence = buildWordSequence(
    [{verseKey: '1:7', caption: 'hafsVerse', wordRange: {first: 5, last: 10}}],
    loaded('1:7'),
  );

  it('finds a word of the sequence', () => {
    expect(indexOfWord(sequence, {verseKey: '1:7', position: 5})).toBe(0);
    expect(indexOfWord(sequence, {verseKey: '1:7', position: 9})).toBe(4);
  });

  it('is -1 outside the sequence and without a word', () => {
    expect(indexOfWord(sequence, {verseKey: '1:7', position: 4})).toBe(-1);
    expect(indexOfWord(sequence, {verseKey: '1:6', position: 5})).toBe(-1);
    expect(indexOfWord(sequence, null)).toBe(-1);
    expect(indexOfWord(sequence, undefined)).toBe(-1);
  });

  it('compares verse and position', () => {
    expect(
      sameWord({verseKey: '1:7', position: 5}, {verseKey: '1:7', position: 5}),
    ).toBe(true);
    expect(
      sameWord({verseKey: '1:7', position: 5}, {verseKey: '1:6', position: 5}),
    ).toBe(false);
    expect(
      sameWord({verseKey: '1:7', position: 5}, {verseKey: '1:7', position: 6}),
    ).toBe(false);
  });
});

describe('summarizeMorph', () => {
  // مَٰلِكِ (1:4:1), as the bundled i'rab stores it.
  const MALIK: MorphFact[] = [
    {label: 'نوع الكلمة', value: 'اسم فاعل'},
    {label: 'الجذر', value: 'م ل ك'},
    {label: 'بنية الجذر', value: 'صحيح سالم'},
    {label: 'الأصل المعجمي', value: 'مَٰلِك'},
    {label: 'الاشتقاق', value: 'اسم فاعل من الفعل الثلاثي المجرد'},
    {label: 'العدد والجنس', value: 'مفرد مذكر'},
    {label: 'التعريف', value: 'معرفة بالإضافة'},
  ];

  it('takes the root and lemma out and keeps the other facts in data order', () => {
    expect(summarizeMorph(MALIK)).toEqual({
      root: 'م ل ك',
      lemma: 'مَٰلِك',
      rest: [MALIK[0], MALIK[2], MALIK[4], MALIK[5], MALIK[6]],
    });
  });

  it('gives null for a missing root or lemma', () => {
    const particle: MorphFact[] = [
      {label: 'نوع الكلمة', value: 'حرف جر'},
      {label: 'ملاحظة', value: 'حرف مبني'},
    ];
    expect(summarizeMorph(particle)).toEqual({
      root: null,
      lemma: null,
      rest: particle,
    });
    expect(summarizeMorph([])).toEqual({root: null, lemma: null, rest: []});
  });
});

describe('rootSearchKey', () => {
  it('joins the spaced root letters', () => {
    expect(rootSearchKey('م ل ك')).toBe('ملك');
    expect(rootSearchKey('ز ل ز ل')).toBe('زلزل');
    expect(rootSearchKey('ملك')).toBe('ملك');
  });
});

describe('rnQuranFontFamily', () => {
  it("follows the renderer's DigitalKhatt face; IndoPak draws in Madani 1421", () => {
    expect(rnQuranFontFamily('dk_v1', 'hafs')).toBe('DigitalKhattV1');
    expect(rnQuranFontFamily('dk_v1', 'warsh')).toBe('DigitalKhattV1');
    expect(rnQuranFontFamily('dk_v2', 'hafs')).toBe('DigitalKhattV2');
    expect(rnQuranFontFamily('dk_indopak', 'hafs')).toBe('DigitalKhattV2');
    expect(rnQuranFontFamily('dk_indopak', 'warsh')).toBe('DigitalKhattV2');
    expect(rnQuranFontFamily('qcf_v2', 'hafs')).toBe('DigitalKhattV2');
  });
});
