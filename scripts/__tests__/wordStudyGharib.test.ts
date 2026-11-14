// @ai-generated
import {
  cleanGloss,
  cleanHeadword,
  GHARIB_SPLITTERS,
  MEANINGS_SCHEMA,
  placeAll,
  readGharibReviewed,
  readJsonl,
  readQuranpediaBook,
  readQuranpediaMeanings,
  reviewedKey,
  textProblem,
  type GharibInput,
  type GharibReviewed,
  type Placement,
} from '../word-study/gharib';
import type {AppWord} from '../word-study/rasm';

// The app's words (data/wbw/wbw-en.db) of a few verses. Glosses below are
// invented: no book text is copied into the tests.
const VERSES: Record<string, string[]> = {
  '1:4': ['مَـٰلِكِ', 'يَوْمِ', 'ٱلدِّينِ'],
  '2:2': [
    'ذَٰلِكَ',
    'ٱلْكِتَـٰبُ',
    'لَا',
    'رَيْبَ ۛ',
    'فِيهِ ۛ',
    'هُدًۭى',
    'لِّلْمُتَّقِينَ',
  ],
  '2:3': [
    'ٱلَّذِينَ',
    'يُؤْمِنُونَ',
    'بِٱلْغَيْبِ',
    'وَيُقِيمُونَ',
    'ٱلصَّلَوٰةَ',
    'وَمِمَّا',
    'رَزَقْنَـٰهُمْ',
    'يُنفِقُونَ',
  ],
  '2:4': ['وَٱلَّذِينَ', 'يُؤْمِنُونَ'],
  '2:5': [
    'أُو۟لَـٰٓئِكَ',
    'عَلَىٰ',
    'هُدًۭى',
    'مِّن',
    'رَّبِّهِمْ ۖ',
    'وَأُو۟لَـٰٓئِكَ',
    'هُمُ',
    'ٱلْمُفْلِحُونَ',
  ],
  '69:11': [
    'إِنَّا',
    'لَمَّا',
    'طَغَا',
    'ٱلْمَآءُ',
    'حَمَلْنَـٰكُمْ',
    'فِى',
    'ٱلْجَارِيَةِ',
  ],
  '10:53': [
    '۞ وَيَسْتَنۢبِـُٔونَكَ',
    'أَحَقٌّ',
    'هُوَ ۖ',
    'قُلْ',
    'إِى',
    'وَرَبِّىٓ',
    'إِنَّهُۥ',
    'لَحَقٌّۭ ۖ',
  ],
  '2:255': [
    'ٱللَّهُ',
    'لَآ',
    'إِلَـٰهَ',
    'إِلَّا',
    'هُوَ',
    'لَّهُۥ',
    'مَا',
    'فِى',
    'ٱلسَّمَـٰوَٰتِ',
    'وَمَا',
    'فِى',
    'ٱلْأَرْضِ ۗ',
    'وَسِعَ',
    'كُرْسِيُّهُ',
    'ٱلسَّمَـٰوَٰتِ',
    'وَٱلْأَرْضَ ۖ',
  ],
};

const verses = new Map<string, AppWord[]>(
  Object.entries(VERSES).map(([vk, words]) => [
    vk,
    words.map((text, i) => ({position: i + 1, text})),
  ]),
);
const NONE: GharibReviewed = {__format: 1, entries: {}};

let ord = 0;
function entry(verseKey: string, headword: string): GharibInput {
  const [surah, ayah] = verseKey.split(':').map(Number);
  return {surah, ayah, sourceId: 9, ord: ++ord, headword, gloss: 'شرح'};
}

function place(verseKey: string, headword: string): Placement {
  return placeAll([entry(verseKey, headword)], verses, NONE)[0];
}

describe('placement tiers', () => {
  it.each([
    ['1:4', 'يَوْمِ الدِّينِ', [2, 3]],
    ['1:4', 'مالِكِ', [1, 1]],
    ['2:3', 'وَيُقِيمُونَ الصَّلاةَ', [4, 5]],
    ['2:3', 'وَمِمَّا رَزَقْناهُمْ يُنْفِقُونَ', [6, 8]],
    ['2:2', 'لا رَيْبَ فِيهِ', [3, 5]],
    ['2:2', 'لاريب فيه', [3, 5]],
    ['2:2', 'ذلِكَ', [1, 1]],
    // Each word may be read plene or as written: ذلك as written, الكتاب plene.
    ['2:2', 'ذلِكَ الْكِتابُ', [1, 2]],
  ])('%s «%s» is tier 1', (vk, headword, span) => {
    expect(place(vk, headword)).toMatchObject({tier: 1, span, moved: false});
  });

  it('an alif written in one spelling only is tier 2', () => {
    // السموات: neither السماوات (plene) nor السموت (as written).
    expect(place('2:255', 'السَّمواتِ')).toMatchObject({
      tier: 2,
      span: [9, 9],
      ambiguous: true,
    });
  });

  it('an attached prefix is tier 3', () => {
    expect(place('2:3', 'الغيب')).toMatchObject({tier: 3, span: [3, 3]});
  });

  it('a seatless hamza and a conjunction still place at tier 3', () => {
    expect(place('10:53', 'يستنبئونك')).toMatchObject({tier: 3, span: [1, 1]});
  });

  it('a loose match is tier 4 and stays at verse level', () => {
    // طَغَى in the book, طَغَا in the mushaf.
    expect(place('69:11', 'لَمَّا طَغَى الْماءُ')).toMatchObject({
      tier: 4,
      span: null,
      candidate: '69:11:2-4',
    });
  });

  it('a match in a neighbouring verse is moved and stays at verse level', () => {
    expect(place('2:5', 'لا رَيْبَ فِيهِ')).toMatchObject({
      verseKey: '2:5',
      tier: 1,
      moved: true,
      span: null,
      candidate: '2:2:3-5',
    });
  });

  it('no match leaves the entry at verse level', () => {
    expect(place('2:3', 'وهي القيامة')).toMatchObject({
      tier: 0,
      span: null,
      candidate: '',
    });
  });

  it('a duplicated word goes after the previous placed entry', () => {
    const placed = placeAll(
      [
        entry('2:255', 'السَّماواتِ'),
        entry('2:255', 'كُرْسِيُّهُ'),
        entry('2:255', 'السَّماواتِ'),
      ],
      verses,
      NONE,
    );
    expect(placed.map(p => [p.span, p.ambiguous])).toEqual([
      [[9, 9], true],
      [[14, 14], false],
      [[15, 15], true],
    ]);
  });

  it('keeps book order inside a verse', () => {
    const placed = placeAll(
      [entry('2:2', 'هُدىً'), entry('2:2', 'لِلْمُتَّقِينَ')].reverse(),
      verses,
      NONE,
    );
    expect(placed.map(p => p.input.headword)).toEqual([
      'هُدىً',
      'لِلْمُتَّقِينَ',
    ]);
  });

  it('a hand placement (tier 5) wins, also at verse level', () => {
    const e = entry('2:3', 'وهي القيامة');
    const f = entry('2:2', 'هُدىً');
    const reviewed = readGharibReviewed(
      JSON.stringify({
        __format: 1,
        entries: {
          [reviewedKey(e)]: {span: '2:3:3-3'},
          [reviewedKey(f)]: {verseLevel: true},
        },
      }),
    );
    const placed = placeAll([e, f], verses, reviewed);
    const of = (x: GharibInput) => placed.find(p => p.input === x);
    expect(of(e)).toMatchObject({tier: 5, span: [3, 3], verseKey: '2:3'});
    expect(of(f)).toMatchObject({tier: 5, span: null, verseKey: '2:2'});
  });
});

describe('readQuranpediaMeanings', () => {
  const dump = {
    license: {version: '2026-11-14'},
    schema: MEANINGS_SCHEMA,
    data: [
      {
        surah: 1,
        ayah: 4,
        meanings: [
          {book_info: {id: 327}, words: [{text: 'الدِّينِ', meaning: 'أ'}]},
          {book_info: {id: 491}, words: [{text: 'الدِّينِ', meaning: 'ب'}]},
        ],
      },
      {
        surah: 2,
        ayah: 2,
        meanings: [
          {
            book_info: {id: 327},
            words: [
              {text: 'لا رَيْبَ فِيهِ', meaning: 'ج'},
              {text: 'هُدىً', meaning: 'د'},
            ],
          },
        ],
      },
    ],
  };

  it('keeps the locked books and numbers entries in file order', () => {
    const {entries, version} = readQuranpediaMeanings(dump, [327]);
    expect(version).toBe('2026-11-14');
    expect(
      entries.map(e => [e.surah, e.ayah, e.sourceId, e.ord, e.gloss]),
    ).toEqual([
      [1, 4, 327, 1, 'أ'],
      [2, 2, 327, 2, 'ج'],
      [2, 2, 327, 3, 'د'],
    ]);
  });

  it('rejects another schema and a book that is not there', () => {
    expect(() =>
      readQuranpediaMeanings({...dump, schema: '/v1/other'}, [327]),
    ).toThrow(/schema/);
    expect(() => readQuranpediaMeanings(dump, [208])).toThrow(/208/);
  });
});

describe('book splitters', () => {
  const pairs = (id: number, html: string) =>
    GHARIB_SPLITTERS[id](html).map(e => [
      e.headword,
      e.gloss.replace(/<[^>]*>/g, '').trim(),
    ]);

  it.each([
    [
      27760,
      '<span class="book-ayah c1">﴿رَيْب﴾</span> شك <span class="book-ayah">﴿هُدىً﴾</span> رشاد',
    ],
    [341, '1- (رَيْب) شك<br>2- (هُدىً) رشاد'],
    [27784, '"رَيْب" شك "هُدىً" رشاد'],
    [2013, 'رَيْب: شك<br>هُدىً: رشاد<br>'],
  ])('book %s', (id, html) => {
    expect(pairs(id, html)).toEqual([
      ['رَيْب', 'شك'],
      ['هُدىً', 'رشاد'],
    ]);
  });

  it('readQuranpediaBook splits passages and cleans glosses', () => {
    const {entries} = readQuranpediaBook(
      {
        book: {id: 27784},
        license: {version: 'v'},
        ayahs: [
          {
            surah: 2,
            ayah: 2,
            content: [{text: '"رَيْب" شك', part: '1', page: '9'}],
          },
        ],
      },
      27784,
      html => html.trim(),
    );
    expect(entries).toEqual([
      {
        surah: 2,
        ayah: 2,
        sourceId: 27784,
        ord: 1,
        headword: 'رَيْب',
        gloss: 'شك',
        part: '1',
        page: '9',
      },
    ]);
    expect(() =>
      readQuranpediaBook({book: {id: 1}, ayahs: []}, 27784, x => x),
    ).toThrow();
  });
});

it('readJsonl reads one entry per line', () => {
  const entries = readJsonl(
    '{"s":2,"a":2,"source":7,"headword":"رَيْب","gloss":"شك"}\n\n{"s":2,"a":3,"source":7,"headword":"الغيب","gloss":"ما غاب","note":"ن"}',
  );
  expect(entries.map(e => [e.ord, e.headword, e.note])).toEqual([
    [1, 'رَيْب', ''],
    [2, 'الغيب', 'ن'],
  ]);
  expect(() => readJsonl('{"s":2}')).toThrow(/line 1/);
});

describe('cleaning', () => {
  it('strips the editor’s brackets and footnote markers', () => {
    expect(cleanGloss('الراحم  [والرّحمة]  تظهر في القلب [زه] .')).toBe(
      'الراحم تظهر في القلب.',
    );
    expect(cleanGloss('قاله سيبويه «7» . وقيل «8»غيره')).toBe(
      'قاله سيبويه. وقيل غيره',
    );
    expect(cleanGloss('الكفؤ: المثل.1')).toBe('الكفؤ: المثل.');
    expect(cleanGloss('مِنْ فِضَّةٍ  .27،')).toBe('مِنْ فِضَّةٍ.');
  });

  it('fixes spacing around punctuation', () => {
    expect(cleanGloss('قال:عدلا ، انتهى.وقيل « كذا »')).toBe(
      'قال: عدلا، انتهى. وقيل «كذا»',
    );
    expect(cleanHeadword(' لا  رَيْبَ ')).toBe('لا رَيْبَ');
  });

  it('flags what cannot be stored', () => {
    expect(textProblem('شرح')).toBeNull();
    expect(textProblem('<b>شرح</b>')).toBe('markup');
    expect(textProblem('see www.x')).toBe('link');
    expect(textProblem('abc')).toBe('Latin letters');
    expect(textProblem('شرح 7')).toBe('digits');
    expect(textProblem('شرح �')).toBe('U+FFFD');
    expect(textProblem('شرح [زه]')).toBe('a bracket');
  });
});

it('readGharibReviewed checks keys and values', () => {
  expect(readGharibReviewed('{"__format":1,"entries":{}}').entries).toEqual({});
  expect(() => readGharibReviewed('{"entries":{}}')).toThrow(/__format/);
  expect(() =>
    readGharibReviewed(
      '{"__format":1,"entries":{"327 2:2":{"verseLevel":true}}}',
    ),
  ).toThrow(/bad key/);
  expect(() =>
    readGharibReviewed(
      '{"__format":1,"entries":{"327 2:2 ريب":{"span":"2:2"}}}',
    ),
  ).toThrow(/bad value/);
  expect(
    readGharibReviewed(
      JSON.stringify(require('../word-study/gharib-reviewed.json')),
    ).entries,
  ).toEqual({});
});
