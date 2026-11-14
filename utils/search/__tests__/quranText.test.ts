// @ai-generated
/**
 * The Quran search normaliser on real Digital Khatt words. The words are read
 * from the bundled Hafs DB by location, so each case uses the exact encoding
 * the index is built from (decomposed hamza, maddah, open tanween, ...).
 */
import path from 'path';
import Database from 'better-sqlite3';
import {
  parseQuranQuery,
  QURAN_QUERY_MAX_TOKENS,
  quranWordForms,
  quranWordSpellings,
  rootCandidates,
  rootQuery,
  stripArticle,
  stripProclitics,
  type QuranWordMorph,
} from '../quranText';

const DK = path.join(
  __dirname,
  '../../../data/mushaf/digitalkhatt/digital-khatt-v2.db',
);
const db = new Database(DK, {readonly: true});
const read = db.prepare('SELECT text FROM words WHERE location = ?');

/** The Hafs Digital Khatt word at 's:a:w'. */
function dk(location: string): string {
  const row = read.get(location) as {text: string} | undefined;
  if (!row) throw new Error(`no DK word at ${location}`);
  return row.text;
}

afterAll(() => db.close());

function spellingSet(location: string): string[] {
  const s = quranWordSpellings(dk(location));
  return [...new Set([s.imlaei, ...s.alternates, s.rasm, ...s.mixed])].sort();
}

describe('quranWordSpellings', () => {
  // The design's table (docs/plans/2026-11-14-word-study/03-word-search.md §7).
  it.each([
    ['2:3:5', 'ٱلصَّلَوٰةَ', ['الصلاه', 'الصلوه']],
    ['1:1:3', 'ٱلرَّحْمَٰنِ', ['الرحمان', 'الرحمن']],
    ['2:2:2', 'ٱلْكِتَٰبُ', ['الكتاب', 'الكتب']],
    ['2:25:20', 'هَٰذَا', ['هاذا', 'هذا']],
    ['2:2:1', 'ذَٰلِكَ', ['ذالك', 'ذلك']],
    ['1:4:1', 'مَٰلِكِ', ['مالك', 'ملك']],
    ['2:9:1', 'يُخَٰدِعُونَ', ['يخادعون', 'يخدعون']],
    ['2:124:3', 'إِبْرَٰهِـۧمَ', ['ابراهيم', 'ابرهم']],
    ['2:33:15', 'ٱلسَّمَٰوَٰتِ', ['السماوات', 'السماوت', 'السموات', 'السموت']],
    ['2:275:3', 'ٱلرِّبَوٰا۟', ['الربا', 'الربوا']],
    ['2:85:37', 'ٱلْحَيَوٰةِ', ['الحياه', 'الحيوه']],
    ['2:61:52', 'ٱلنَّبِيِّـۧنَ', ['النبين', 'النبيين']],
    ['2:54:5', 'يَٰقَوْمِ', ['ياقوم']],
    ['2:21:1', 'يَٰٓأَيُّهَا', ['ياايها']],
    ['2:5:2', 'عَلَىٰ', ['علي']],
    ['2:185:6', 'ٱلْقُرْءَانُ', ['القران']],
    ['2:5:1', 'أُو۟لَٰٓئِكَ', ['اولايك', 'اوليك']],
    ['2:31:12', 'هَٰٓؤُلَآءِ', ['هاولا', 'هولا']],
    ['17:34:17', 'مَسْـُٔولࣰا', ['مسولا']],
    ['12:2:4', 'عَرَبِيࣰّا (open tanween stays inside the word)', ['عربيا']],
    ['37:130:3', 'إِلْ يَاسِينَ (one slot with a space)', ['الياسين']],
    ['2:164:7', 'ٱلَّيْلِ (drawn with one lam)', ['الليل']],
    ['2:189:1', '۞يَسْـَٔلُونَكَ (rub el hizb removed)', ['يسلونك']],
  ])('%s %s', (location, _word, expected) => {
    expect(spellingSet(location)).toEqual(expected);
  });

  // Rules added after measuring typed spellings against the whole text
  // (docs/features/quran-search.md, "Spelling rules").
  it.each([
    ['69:3:2', 'أَدْرَىٰكَ (ىٰ before a suffix)', ['ادراك', 'ادريك']],
    ['3:3:10', 'ٱلتَّوْرَىٰةَ', ['التوراه', 'التوريه']],
    ['2:258:18', 'يُحْيِۦ (small yeh after yeh)', ['يحي', 'يحيي']],
    ['9:19:17', 'يَسْتَوُۥنَ (small waw after waw)', ['يستون', 'يستوون']],
    ['2:251:5', 'دَاوُۥدُ', ['داود', 'داوود']],
    ['81:8:2', 'ٱلْمَوْءُۥدَةُ', ['الموده', 'المووده']],
    ['2:22:13', 'بِهِۦ (the pronoun only lengthens)', ['به']],
    ['21:88:7', 'نُـۨجِي (small high noon)', ['نجي', 'ننجي']],
    ['4:23:21', 'ٱلَّٰتِي (drawn with one lam)', ['اللاتي', 'اللتي']],
    ['4:16:1', 'وَٱلَّذَانِ (dual, drawn with one lam)', ['واللذان']],
    ['2:24:8', 'ٱلَّتِي (one lam in both)', ['التي']],
    ['2:221:30', 'يَدْعُوٓا۟ (silent final alif)', ['يدعو', 'يدعوا']],
    ['11:68:7', 'ثَمُودَا۟', ['ثمود', 'ثمودا']],
    ['2:259:19', 'مِا۟ئَةَ (silent alif inside)', ['مايه', 'ميه']],
    ['10:4:8', 'يَبْدَؤُا۟ (final hamza on waw)', ['يبد', 'يبدا', 'يبدوا']],
    ['6:76:5', 'رَءَا', ['را', 'ري']],
    ['3:184:8', 'جَآءُو', ['جاو', 'جاوا']],
    ['10:94:8', 'فَسْـَٔلِ', ['فاسل', 'فسل']],
    ['3:144:10', 'أَفَإِي۟ن (silent yeh)', ['افان', 'افاين']],
  ])('%s %s', (location, _word, expected) => {
    expect(spellingSet(location)).toEqual(expected);
  });

  it('keeps the plural alif as the main spelling', () => {
    // قَالُوا۟: قالوا first; قالو only as an alternate.
    const said = quranWordSpellings('قَالُوا\u{06DF}');
    expect(said.imlaei).toBe('قالوا');
    expect(said.alternates).toEqual(['قالو']);
  });

  it('gives nothing for a verse marker', () => {
    expect(quranWordSpellings(dk('1:1:5'))).toEqual({
      imlaei: '',
      alternates: [],
      rasm: '',
      mixed: [],
      hasHamza: false,
    });
  });

  it('flags a hamza, but not a maddah used as a madd sign', () => {
    expect(quranWordSpellings(dk('2:22:11')).hasHamza).toBe(true); // مَآءࣰ
    expect(quranWordSpellings(dk('2:173:19')).hasHamza).toBe(false); // فَلَآ
    expect(quranWordSpellings(dk('2:173:19')).imlaei).toBe('فلا');
    expect(quranWordSpellings(dk('2:22:11')).imlaei).toBe('ما');
    expect(quranWordSpellings(dk('17:34:17')).hasHamza).toBe(true);
  });
});

describe('quranWordForms (proclitics and the article)', () => {
  const morph = (
    proclitics: QuranWordMorph['proclitics'],
    definiteByArticle: boolean,
    lemma: string | null,
  ): QuranWordMorph => ({proclitics, definiteByArticle, lemma});
  const forms = (location: string, m: QuranWordMorph) =>
    quranWordForms(dk(location), m).map(
      f => `${f.form} ${f.tier}${f.rasmOnly ? ' rasm' : ''}`,
    );

  it('strips each proclitic in turn, then the article', () => {
    // وَبِٱلْـَٔاخِرَةِ
    expect(forms('2:4:10', morph(['wa', 'bi'], true, 'آخِر'))).toEqual([
      'وبالاخره 3',
      'بالاخره 2',
      'الاخره 2',
      'اخره 1',
    ]);
  });

  it("restores the article's alif after a final lam", () => {
    // لِلنَّاسِ
    expect(forms('2:83:17', morph(['li'], true, 'نَاس'))).toEqual([
      'للناس 3',
      'الناس 2',
      'ناس 1',
    ]);
    // لِّلَّذِينَ: a relative pronoun is definite through its lemma
    expect(forms('2:79:2', morph(['li'], false, 'ٱلَّذِى'))).toEqual([
      'للذين 3',
      'الذين 2',
    ]);
    // لِلَّهِ
    expect(forms('1:2:2', morph(['li'], false, 'ٱللَّه'))).toEqual([
      'لله 3',
      'الله 2',
    ]);
  });

  it('never gives Allah or a relative pronoun an article-free form', () => {
    expect(forms('1:1:2', morph([], false, 'ٱللَّه'))).toEqual(['الله 3']);
    expect(forms('1:7:2', morph([], false, 'ٱلَّذِى'))).toEqual(['الذين 3']);
    expect(forms('2:19:17', morph(['wa'], false, 'ٱللَّه'))).toEqual([
      'والله 3',
      'الله 2',
    ]);
  });

  it('keeps the vocative alif after a proclitic', () => {
    // وَيَٰقَوْمِ
    expect(forms('11:29:1', morph(['wa', 'ya'], false, 'قَوْم'))).toEqual([
      'وياقوم 3',
      'ويقوم 3 rasm',
      'ياقوم 2',
      'قوم 2',
    ]);
  });

  it('strips ها only when it is written with its alif', () => {
    // هَٰٓأَنتُمْ
    expect(forms('3:66:1', morph(['ha'], false, null))).toEqual([
      'هاانتم 3',
      'هانتم 3 rasm',
      'انتم 2',
    ]);
    // هَلُمَّ: no لم form
    expect(forms('6:150:2', morph(['ha'], false, null))).toEqual(['هلم 3']);
  });

  it('keeps the word’s own alif after a question hamza on the line', () => {
    // ءَأَلِدُ: the question hamza (ء) folds away; the verb keeps أ
    expect(forms('11:72:3', morph(['hamza'], false, null))).toEqual(['الد 3']);
  });

  it('gives al-layl its two lams in every form', () => {
    // وَٱلَّيْلِ
    expect(forms('74:33:1', morph(['wa'], true, 'لَيْل'))).toEqual([
      'والليل 3',
      'الليل 2',
      'ليل 1',
    ]);
  });

  it('spells an open taa with ة when the lemma ends in one', () => {
    // رَحْمَتَ (lemma رَحْمَة) and ٱمْرَأَتُ (lemma read as ٱمْرَأَة)
    expect(forms('2:218:12', morph([], false, 'رَحْمَة'))).toEqual([
      'رحمت 3',
      'رحمه 3',
    ]);
    expect(forms('3:35:3', morph([], false, 'ٱمْرَأَة'))).toEqual([
      'امرات 3',
      'امراه 3',
    ]);
    // Not for a plural -at (صلوات, lemma صَلَوٰة) or a word whose lemma ends
    // in ت (أخت).
    expect(
      quranWordForms('صَلَوَٰتٌ', morph([], false, 'صَلَوٰة')).map(f => f.form),
    ).toEqual(['صلوات', 'صلوت']);
    expect(
      quranWordForms('أُخْتٌ', morph([], false, 'أُخْت')).map(f => f.form),
    ).toEqual(['اخت']);
  });

  it('flags the hamza of the part each form spells', () => {
    const [full, bare] = quranWordForms(
      dk('2:4:10'),
      morph(['wa', 'bi'], true, 'آخِر'),
    ).filter(f => f.tier !== 2);
    expect(full.hasHamza).toBe(true);
    expect(bare.hasHamza).toBe(true);
    // أَفَلَا: the hamza is the proclitic's
    const afala = quranWordForms(
      'أَفَلَا',
      morph(['hamza', 'fa'], false, null),
    );
    expect(afala.map(f => [f.form, f.hasHamza])).toEqual([
      ['افلا', true],
      ['فلا', false],
      ['لا', false],
    ]);
  });

  it('exposes the steps on their own', () => {
    expect(stripProclitics(dk('2:4:10'), ['wa', 'bi'], true)).toEqual([
      'بالاخره',
      'الاخره',
    ]);
    expect(stripProclitics(dk('1:2:2'), ['li'], true, true)).toEqual(['الله']);
    expect(stripArticle(dk('2:102:64'))).toBe('اخره');
    expect(stripArticle(dk('1:1:3'))).toBe('رحمان');
    expect(stripArticle(dk('2:9:1'))).toBeNull();
  });
});

describe('parseQuranQuery', () => {
  const keys = (query: string) => {
    const parsed = parseQuranQuery(query);
    return parsed.kind === 'text' ? parsed.tokens.map(t => t.keys) : parsed;
  };

  it.each([
    ['2:255'],
    ['صفحة 5'],
    ['جزء ٣٠'],
    ['juz 30'],
    ['husary'],
    [''],
    ['  '],
  ])('%s is not a Quran query', query => {
    expect(parseQuranQuery(query)).toEqual({kind: 'none'});
  });

  it('reads typed, pasted and decorated text the same way', () => {
    for (const query of [
      'الرحمن',
      'الرَّحْمَنِ',
      'الرحمـن',
      'ﺍﻟﺮﺣﻤﻦ',
      '\u{200F}الرحمن\u{200F}',
    ]) {
      expect(keys(query)).toEqual([['الرحمن']]);
    }
    // Pasted Uthmani gives its imla'i spelling.
    expect(keys(dk('1:1:3'))).toEqual([['الرحمان']]);
    expect(keys(dk('2:3:5'))).toEqual([['الصلاه']]);
  });

  it('joins a standalone يا, ها or إل to the next word', () => {
    expect(keys('يا أيها')).toEqual([['ياايها']]);
    // Typed as one word, its أ is a medial seat like any other.
    expect(keys('ياأيها')).toEqual([['ياايها', 'يايها']]);
    expect(keys('يا أيها الذين آمنوا')).toEqual([
      ['ياايها'],
      ['الذين'],
      ['امنوا'],
    ]);
    expect(keys('إل ياسين')).toEqual([['الياسين']]);
    expect(keys('ها أنتم')).toEqual([['هاانتم']]);
    // Not when typed with a hamza, nor at the end.
    expect(keys('ياء')).toEqual([['يا']]);
    expect(keys('قوم يا')).toEqual([['قوم'], ['يا']]);
    // آل (family of) stays a word of its own, typed with or without madda.
    expect(keys('آل فرعون')).toEqual([['ال'], ['فرعون']]);
    expect(keys('ال عمران')).toEqual([['ال'], ['عمران']]);
  });

  it('asks for a hamza only when one is typed', () => {
    const parsed = (query: string) => {
      const p = parseQuranQuery(query);
      if (p.kind !== 'text') throw new Error('expected text');
      return p.tokens[0];
    };
    expect(parsed('ماء')).toEqual({keys: ['ما'], needsHamza: true});
    expect(parsed('ما')).toEqual({keys: ['ما'], needsHamza: false});
    expect(parsed('القرآن').needsHamza).toBe(true);
  });

  it('also tries a hamza seat without its seat letter', () => {
    expect(keys('مسؤولا')).toEqual([['مسوولا', 'مسولا']]);
    expect(keys('مسئولا')).toEqual([['مسيولا', 'مسولا']]);
    expect(keys('يستهزئون')).toEqual([['يستهزيون', 'يستهزون']]);
    expect(keys('رؤوف')).toEqual([['رووف', 'روف']]);
    expect(keys('شئ')).toEqual([['شي', 'ش']]);
    // أ and إ after the first letter (يَسْـَٔلُونَكَ, أَرَءَيْتُمْ, ءَأَنتُمْ).
    expect(keys('يسألونك')).toEqual([['يسالونك', 'يسلونك']]);
    expect(keys('أرأيتم')).toEqual([['ارايتم', 'اريتم']]);
    expect(keys('أأنتم')).toEqual([['اانتم', 'انتم']]);
    expect(keys('أإله')).toEqual([['االه', 'اله']]);
    // Never the first letter: أنتم keeps one key.
    expect(keys('أنتم')).toEqual([['انتم']]);
  });

  it('counts letters, not marks, for the length cap', () => {
    // 30 pasted words of 10 letters each are cut whole, after 20 words.
    const word = 'كَتَبْنَٰهَا'.repeat(1);
    const parsed = parseQuranQuery(Array(30).fill(`${word}كتب`).join(' '));
    expect(parsed.kind === 'text' && parsed.tokens.length).toBe(20);
    expect(
      parsed.kind === 'text' &&
        parsed.tokens.every(t => t.keys[0] === 'كتبناهاكتب'),
    ).toBe(true);
  });

  it('reads a pasted verse with its end-of-ayah number', () => {
    const verse = ['1:1:1', '1:1:2', '1:1:3', '1:1:4', '1:1:5']
      .map(dk)
      .join(' ');
    expect(keys(verse)).toEqual([['بسم'], ['الله'], ['الرحمان'], ['الرحيم']]);
    expect(keys('﴿١﴾ الرحمن')).toEqual([['الرحمن']]);
  });

  it('drops words without an Arabic letter from an Arabic query', () => {
    expect(keys('الله x')).toEqual([['الله']]);
  });

  it(`keeps at most ${QURAN_QUERY_MAX_TOKENS} words`, () => {
    const parsed = parseQuranQuery(Array(30).fill('من').join(' '));
    expect(parsed.kind === 'text' && parsed.tokens.length).toBe(
      QURAN_QUERY_MAX_TOKENS,
    );
  });

  it('offers the letters of a one-word query of 3-4 letters for roots', () => {
    const rootLetters = (query: string) => {
      const p = parseQuranQuery(query);
      return p.kind === 'text' ? p.rootLetters : undefined;
    };
    expect(rootLetters('رحم')).toBe('رحم');
    expect(rootLetters('أمن')).toBe('أمن');
    expect(rootLetters('من')).toBeNull();
    expect(rootLetters('الرحمن')).toBeNull();
    expect(rootLetters('رحم الله')).toBeNull();
  });

  describe('roots', () => {
    const known = new Set(['ر ح م', 'ك ت ب']);
    const isKnownRoot = (root: string) => known.has(root);

    it.each([
      ['root:رحم', 'رحم'],
      ['root: ر ح م', 'رحم'],
      ['ROOT : رحم', 'رحم'],
      ['جذر:رحم', 'رحم'],
      ['جذر: ر ح م', 'رحم'],
      ['جذر：كتب', 'كتب'],
    ])('%s is an explicit root query', (query, letters) => {
      expect(parseQuranQuery(query, isKnownRoot)).toEqual({
        kind: 'root',
        letters,
        explicit: true,
      });
    });

    it('treats 3-4 spaced letters as a root only when it is a known root', () => {
      expect(parseQuranQuery('ر ح م', isKnownRoot)).toEqual({
        kind: 'root',
        letters: 'رحم',
        explicit: false,
      });
      expect(keys('ر ح م')).toEqual([['رحم']]);
    });

    it("joins other spaced letters into one word (the muqatta'at)", () => {
      expect(keys('ح م')).toEqual([['حم']]);
      expect(keys('ك ه ي ع ص')).toEqual([['كهيعص']]);
    });

    it('gives nothing for an empty root query', () => {
      expect(parseQuranQuery('root:')).toEqual({kind: 'none'});
    });
  });
});

describe('rootCandidates', () => {
  const known = new Set([
    'ر ح م',
    'ء ل ه',
    'ر ء ي',
    'س م و',
    'د ع و',
    'ق و ل',
    'ش ي ء',
    'ء م ن',
    'ك ت ب',
  ]);
  const isKnownRoot = (root: string) => known.has(root);

  it.each([
    ['رحم', ['ر ح م']],
    ['ر ح م', ['ر ح م']],
    ['اله', ['ء ل ه']],
    ['أله', ['ء ل ه']],
    ['رأي', ['ر ء ي']],
    ['راى', ['ر ء ي']],
    ['سما', ['س م و']],
    ['دعا', ['د ع و']],
    ['قول', ['ق و ل']],
    ['شيء', ['ش ي ء']],
    ['أمن', ['ء م ن']],
    ['كتب', ['ك ت ب']],
    ['كتبه', []],
    ['كت', []],
    ['xyz', []],
  ])('%s → %j', (letters, expected) => {
    expect(rootCandidates(letters, isKnownRoot)).toEqual(expected);
  });

  it('only ever offers known roots', () => {
    expect(rootCandidates('ملك', () => false)).toEqual([]);
  });
});

describe('rootQuery', () => {
  it('builds the canonical root query in either keyword', () => {
    expect(rootQuery('ر ح م')).toBe('root:ر ح م');
    expect(rootQuery('ر ح م', 'جذر')).toBe('جذر:ر ح م');
    expect(parseQuranQuery(rootQuery('ء ل ه'))).toEqual({
      kind: 'root',
      letters: 'ءله',
      explicit: true,
    });
  });
});
