// @ai-generated
import {
  applyReviewed,
  diffGroup,
  groupVerse,
  isVocativeToken,
  mapTanzilVerse,
  readReviewed,
  readTanzil,
  readWordJson,
  reviewedForm,
  type RasmUnit,
  type ReviewedFile,
  type WordGroup,
} from '../word-study/rasm';

/** One app word against its standard tokens. */
function unit(uthmani: string, standard: string, key = '1:1:1'): WordGroup {
  const [s, a, w] = key.split(':');
  return {
    verseKey: `${s}:${a}`,
    from: Number(w),
    to: Number(w),
    uthmani,
    standard: standard.split(' '),
  };
}

/** The notes of a unit as "kind standard→mushaf basis [marked text]". */
function notes(uthmani: string, standard: string): string[] {
  const imlaei = standard;
  return diffGroup(unit(uthmani, standard)).notes.map(
    n =>
      `${n.kind} ${n.standard}→${n.mushaf} ${n.basis}${
        n.mark ? ` [${imlaei.slice(n.mark[0], n.mark[1])}]` : ''
      }`,
  );
}

describe('diffGroup: the design §2.3 examples', () => {
  it.each([
    ['مَـٰلِكِ', 'مَالِكِ', ['hadhf ا→ sign [ا]']],
    ['دَاوُۥدُ', 'دَاوُودُ', ['hadhf و→ sign [و]']],
    [
      'إِبْرَٰهِـۧمَ',
      'إِبْرَاهِيمَ',
      ['hadhf ا→ sign [ا]', 'hadhf ي→ sign [ي]'],
    ],
    ['نُـۨجِى', 'نُنجِي', ['hadhf ن→ sign [ن]']],
  ])('hadhf: %s / %s', (uthmani, standard, expected) => {
    expect(notes(uthmani, standard)).toEqual(expected);
  });

  it('2:25:30 أَزْوَٰجٌ is a hadhf (the و has its own vowel), not a badal', () => {
    expect(notes('أَزْوَٰجٌۭ', 'أَزْوَاجٌ')).toEqual(['hadhf ا→ sign [ا]']);
  });

  it.each([
    ['لِشَا۟ىْءٍ', 'لِشَيْءٍ', 'ziyada →ا sign'],
    ['بِأَيْي۟دٍۢ', 'بِأَيْدٍ', 'ziyada →ي sign'],
    ['سَأُو۟رِيكُمْ', 'سَأُرِيكُمْ', 'ziyada →و sign'],
  ])('ziyada: %s / %s', (uthmani, standard, expected) => {
    expect(notes(uthmani, standard)).toEqual([expected]);
  });

  it.each([
    ['ٱلصَّلَوٰةَ', 'الصَّلَاةَ', 'badal ا→و sign [ا]'],
    ['فَسَوَّىٰهُنَّ', 'فَسَوَّاهُنَّ', 'badal ا→ى sign [ا]'],
    ['وَيَبْصُۜطُ', 'وَيَبْسُطُ', 'badal س→ص sign [سُ]'],
  ])('badal: %s / %s', (uthmani, standard, expected) => {
    expect(notes(uthmani, standard)).toEqual([expected]);
  });

  it.each([
    ['مُسْتَهْزِءُونَ', 'مُسْتَهْزِئُونَ', 'hamz ئ→ء sign [ئُ]'],
    ['تَسْـَٔلُوا۟', 'تَسْأَلُوا', 'hamz أ→ء sign [أَ]'],
    ['رُءْيَاكَ', 'رُؤْيَاكَ', 'hamz ؤ→ء sign [ؤْ]'],
  ])('hamz: %s / %s', (uthmani, standard, expected) => {
    expect(notes(uthmani, standard)).toEqual([expected]);
  });

  it('wasl: a vocative joined to the next word', () => {
    expect(notes('يَـٰٓأَيُّهَا', 'يَا أَيُّهَا')).toEqual([
      'hadhf ا→ sign [ا]',
      'wasl → rule',
    ]);
    expect(notes('هَـٰٓأَنتُمْ', 'هَا أَنتُمْ')).toEqual([
      'hadhf ا→ sign [ا]',
      'wasl → rule',
    ]);
    // 20:94: the alif of يا is the rule's; the alif of ابن stays hidden.
    expect(notes('يَبْنَؤُمَّ', 'يَا ابْنَ أُمَّ')).toEqual([
      'hadhf ا→ rule [ا]',
      'hadhf ا→ unconfirmed [ا]',
      'hamz أ→ؤ sign [أُ]',
      'wasl → rule',
    ]);
  });

  it('wasl that no rule covers stays hidden (72:16 وَأَلَّوِ)', () => {
    expect(notes('وَأَلَّوِ', 'وَأَن لَّوِ')).toEqual([
      'hadhf ن→ unconfirmed [ن]',
      'wasl → unconfirmed',
    ]);
  });

  it('fasl: two mushaf words for one standard word', () => {
    const group: WordGroup = {
      verseKey: '1:1',
      from: 2,
      to: 3,
      uthmani: 'أَن لَّآ',
      standard: ['أَلَّا'],
    };
    const kinds = diffGroup(group).notes.map(n => `${n.kind} ${n.basis}`);
    expect(kinds).toContain('fasl unconfirmed');
  });

  it('a substitution with no sign is derived but hidden (12:25 لَدَا)', () => {
    expect(notes('لَدَا', 'لَدَى')).toEqual(['badal ى→ا unconfirmed [ى]']);
  });

  it.each([
    ['ءَامَنُوا۟', 'آمَنُوا'],
    ['ذَٰلِكَ', 'ذَٰلِكَ'],
    ['قَالُوا۟', 'قَالُوا'],
    ['ٱلْـَٔاخِرِ', 'الْآخِرِ'],
    ['عَلَىٰ', 'عَلَىٰ'],
    ['دَآئِرَةٌۭ ۚ', 'دَائِرَةٌ'],
    ['بَعْدَ مَا', 'بَعْدَ مَا'],
  ])('no note: %s / %s', (uthmani, standard) => {
    expect(notes(uthmani, standard)).toEqual([]);
  });
});

describe('pattern rules', () => {
  it('lamAssimilated: the article’s ل merges into the next ل', () => {
    expect(notes('ٱلَّيْلِ', 'اللَّيْلِ')).toEqual(['hadhf ل→ rule [ل]']);
    expect(notes('وَٱلَّـٰتِى', 'وَاللَّاتِي')).toEqual([
      'hadhf ل→ rule [ل]',
      'hadhf ا→ sign [ا]',
    ]);
  });

  it('alifAfterWawJama: no alif after the plural و', () => {
    expect(notes('فَآءُو', 'فَاءُوا')).toEqual(['hadhf ا→ rule [ا]']);
    expect(notes('وَعَتَوْ', 'وَعَتَوْا')).toEqual(['hadhf ا→ rule [ا]']);
  });

  it('doubleYa: one ي written for two', () => {
    expect(notes('يُحْىِ', 'يُحْيِي')).toEqual(['hadhf ي→ rule [يِ]']);
  });

  it('ٱلرِّبَوٰا۟: badal ا→و and ziyada ا, both from the mushaf’s signs', () => {
    expect(notes('ٱلرِّبَوٰا۟', 'الرِّبَا')).toEqual([
      'badal ا→و sign [ا]',
      'ziyada →ا sign',
    ]);
  });

  it('a hamza on another seat, with an extra letter after it', () => {
    expect(notes('يَبْدَؤُا۟', 'يَبْدَأُ')).toEqual([
      'hamz أ→ؤ sign [أُ]',
      'ziyada →ا sign',
    ]);
    expect(notes('وَمَلَإِي۟هِۦ', 'وَمَلَئِهِ')).toEqual([
      'hamz ئ→إ sign [ئِ]',
      'ziyada →ي sign',
    ]);
  });

  it('an alif with no small letter and no rule is hidden', () => {
    expect(notes('فَسْـَٔلُوا۟', 'فَاسْأَلُوا')).toEqual([
      'hadhf ا→ unconfirmed [ا]',
      'hamz أ→ء sign [أَ]',
    ]);
  });
});

describe('pairing', () => {
  it('knows the vocative tokens', () => {
    expect(['يَا', 'وَيَا', 'هَا'].map(isVocativeToken)).toEqual([
      true,
      true,
      true,
    ]);
    expect(['أَيًّا', 'هَٰذَا', 'يَاسِينَ'].map(isVocativeToken)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('mapTanzilVerse joins a vocative to the next token', () => {
    const {groups, problems} = mapTanzilVerse(
      '2:21',
      [
        {position: 1, text: 'يَـٰٓأَيُّهَا'},
        {position: 2, text: 'ٱلنَّاسُ'},
      ],
      ['يَا', 'أَيُّهَا', 'النَّاسُ'],
    );
    expect(problems).toEqual([]);
    expect(groups.map(g => g.standard)).toEqual([
      ['يَا', 'أَيُّهَا'],
      ['النَّاسُ'],
    ]);
  });

  it('mapTanzilVerse gives 20:94:2 three tokens and 72:16:1 two', () => {
    const t94 = mapTanzilVerse(
      '20:94',
      [
        {position: 1, text: 'قَالَ'},
        {position: 2, text: 'يَبْنَؤُمَّ'},
        {position: 3, text: 'لَا'},
      ],
      ['قَالَ', 'يَا', 'ابْنَ', 'أُمَّ', 'لَا'],
    );
    expect(t94.problems).toEqual([]);
    expect(t94.groups[1].standard).toEqual(['يَا', 'ابْنَ', 'أُمَّ']);
    const t16 = mapTanzilVerse(
      '72:16',
      [
        {position: 1, text: 'وَأَلَّوِ'},
        {position: 2, text: 'ٱسْتَقَـٰمُوا۟'},
      ],
      ['وَأَن', 'لَّوِ', 'اسْتَقَامُوا'],
    );
    expect(t16.problems).toEqual([]);
    expect(t16.groups[0].standard).toEqual(['وَأَن', 'لَّوِ']);
  });

  it('mapTanzilVerse gives the two-word app positions two tokens', () => {
    const {groups, problems} = mapTanzilVerse(
      '2:181',
      [
        {position: 2, text: 'بَدَّلَهُۥ'},
        {position: 3, text: 'بَعْدَ مَا'},
      ],
      ['بَدَّلَهُ', 'بَعْدَ', 'مَا'],
    );
    expect(problems).toEqual([]);
    expect(groups[1].standard).toEqual(['بَعْدَ', 'مَا']);
  });

  it('mapTanzilVerse removes the stray space of 5:52:12', () => {
    const {groups, problems} = mapTanzilVerse(
      '5:52',
      [{position: 12, text: 'دَآئِرَ ةٌۭ ۚ'}],
      ['دَائِرَةٌ'],
    );
    expect(problems).toEqual([]);
    expect(groups[0].uthmani).toBe('دَآئِرَةٌۭ ۚ');
  });

  it('mapTanzilVerse reports skeleton mismatches and leftover tokens', () => {
    const {problems} = mapTanzilVerse(
      '1:1',
      [{position: 1, text: 'بِسْمِ'}],
      ['اللَّهِ', 'بِسْمِ'],
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/^1:1:1: /);
    expect(problems[1]).toMatch(/left over/);
  });

  it('groupVerse joins يا to the next word (1:2)', () => {
    expect(
      groupVerse(
        ['يَـٰٓأَيُّهَا', 'ٱلنَّاسُ'],
        ['يَا', 'أَيُّهَا', 'النَّاسُ'],
      ),
    ).toEqual([
      {mushaf: [0, 0], standard: [0, 1]},
      {mushaf: [1, 1], standard: [2, 2]},
    ]);
  });

  it('groupVerse gives يَبْنَؤُمَّ three tokens (1:3)', () => {
    expect(
      groupVerse(['قَالَ', 'يَبْنَؤُمَّ'], ['قَالَ', 'يَا ابْنَ أُمَّ']),
    ).toEqual([
      {mushaf: [0, 0], standard: [0, 0]},
      {mushaf: [1, 1], standard: [1, 3]},
    ]);
  });

  it('groupVerse regroups a word-level verse whose slots are shifted', () => {
    // يا sits in its own slot, so every later slot is one off.
    expect(
      groupVerse(
        ['يَـٰقَوْمِ', 'ٱعْبُدُوا۟', 'ٱللَّهَ'],
        ['يَا', 'قَوْمِ', 'اعْبُدُوا', 'اللَّهَ'],
      ),
    ).toEqual([
      {mushaf: [0, 0], standard: [0, 1]},
      {mushaf: [1, 1], standard: [2, 2]},
      {mushaf: [2, 2], standard: [3, 3]},
    ]);
  });

  it('groupVerse pairs a fasl (2:1)', () => {
    expect(groupVerse(['أَن', 'لَّآ'], ['أَلَّا'])).toEqual([
      {mushaf: [0, 1], standard: [0, 0]},
    ]);
  });

  it('groupVerse gives null for a verse it cannot pair', () => {
    expect(groupVerse(['قَالَ', 'رَبِّ'], ['قَالَ', 'يَوْمَ'])).toBeNull();
  });
});

describe('readTanzil', () => {
  const FIXTURE = [
    '1|1|بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    '95|1|بِّسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ وَالتِّينِ وَالزَّيْتُونِ',
    '9|1|بَرَاءَةٌ مِّنَ اللَّهِ',
    '',
    '# PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK',
    '#  Tanzil Quran Text (Simple, Version 1.1)',
  ].join('\n');

  it('drops the basmala of N:1 (also بِّسْمِ) and keeps the notice', () => {
    const text = readTanzil(FIXTURE);
    expect(text.verses.get('1:1')).toHaveLength(4);
    expect(text.verses.get('95:1')).toEqual(['وَالتِّينِ', 'وَالزَّيْتُونِ']);
    expect(text.verses.get('9:1')).toEqual(['بَرَاءَةٌ', 'مِّنَ', 'اللَّهِ']);
    expect(text.basmalaDropped).toBe(1);
    expect(text.notice).toBe(
      '# PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK\n#  Tanzil Quran Text (Simple, Version 1.1)',
    );
  });

  it('drops pause signs and fails without the basmala', () => {
    expect(
      readTanzil('2|2|ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ').verses.get('2:2'),
    ).toEqual(['ذَٰلِكَ', 'الْكِتَابُ', 'لَا', 'رَيْبَ', 'فِيهِ']);
    expect(() => readTanzil('2|1|الم')).toThrow(/basmala/);
    expect(() => readTanzil('nonsense')).toThrow(/unreadable/);
  });
});

it('readWordJson groups words per verse in order', () => {
  expect(
    readWordJson(
      '{"2:21:2":"النَّاسُ","2:21:1":"يَا أَيُّهَا","1:1:1":"بِسْمِ"}',
    ),
  ).toEqual(
    new Map([
      ['2:21', ['يَا أَيُّهَا', 'النَّاسُ']],
      ['1:1', ['بِسْمِ']],
    ]),
  );
  expect(() => readWordJson('{"2:21":"x"}')).toThrow(/bad entry/);
});

describe('the reviewed list', () => {
  const ladaa = (): RasmUnit => {
    const {notes: derived} = diffGroup(unit('لَدَا', 'لَدَى', '12:25:9'));
    return {
      verseKey: '12:25',
      from: 9,
      to: 9,
      imlaei: 'لَدَى',
      notes: derived,
      reviewed: false,
    };
  };
  const file = (words: ReviewedFile['words']): ReviewedFile => ({
    __format: 1,
    words,
  });

  it('ships empty', () => {
    const shipped = readReviewed(
      JSON.stringify(require('../word-study/rasm-reviewed.json')),
    );
    expect(shipped.words).toEqual({});
  });

  it('confirms derived notes', () => {
    const u = ladaa();
    const {units, problems} = applyReviewed(
      [u],
      file({
        '12:25:9': {derived: reviewedForm(u.notes), confirm: true, why: 'لدا'},
      }),
    );
    expect(problems).toEqual([]);
    expect(units[0].reviewed).toBe(true);
    expect(units[0].notes.map(n => n.basis)).toEqual(['reviewed']);
  });

  it('replaces or skips a unit', () => {
    const u = ladaa();
    const derived = reviewedForm(u.notes);
    const replaced = applyReviewed(
      [u],
      file({
        '12:25:9': {derived, notes: [['b', 'ى', 'ا', -1, -1]], why: 'لدا'},
      }),
    );
    expect(replaced.units[0].notes).toEqual([
      {
        kind: 'badal',
        standard: 'ى',
        mushaf: 'ا',
        mark: null,
        basis: 'reviewed',
        why: 'لدا',
      },
    ]);
    const skipped = applyReviewed(
      [u],
      file({'12:25:9': {derived, skip: true, why: 'x'}}),
    );
    expect(skipped.units).toEqual([]);
  });

  it('fails when the derived notes changed or the unit is gone', () => {
    const u = ladaa();
    const changed = applyReviewed(
      [u],
      file({'12:25:9': {derived: [], confirm: true, why: 'x'}}),
    );
    expect(changed.problems[0]).toMatch(/changed since review/);
    expect(changed.units[0].reviewed).toBe(false);
    const stale = applyReviewed(
      [],
      file({'12:25:9': {derived: [], confirm: true, why: 'x'}}),
    );
    expect(stale.problems[0]).toMatch(/no derived unit/);
  });

  it('rejects malformed files', () => {
    expect(() => readReviewed('{"words":{}}')).toThrow(/__format/);
    expect(() =>
      readReviewed('{"__format":1,"words":{"1:1:1":{"derived":[],"why":"x"}}}'),
    ).toThrow(/one of/);
    expect(() =>
      readReviewed(
        '{"__format":1,"words":{"1:1":{"derived":[],"skip":true,"why":"x"}}}',
      ),
    ).toThrow(/bad key/);
  });
});
