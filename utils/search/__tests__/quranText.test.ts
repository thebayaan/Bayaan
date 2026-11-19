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
  QURAN_OPENINGS,
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
    ['17:34:17', 'مَسْـُٔولࣰا', ['مسولا', 'مسوولا']],
    ['12:2:4', 'عَرَبِيࣰّا (open tanween stays inside the word)', ['عربيا']],
    ['37:130:3', 'إِلْ يَاسِينَ (one slot with a space)', ['الياسين']],
    ['2:164:7', 'ٱلَّيْلِ (drawn with one lam)', ['الليل']],
    ['2:189:1', '۞يَسْـَٔلُونَكَ (rub el hizb removed)', ['يسالونك', 'يسلونك']],
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
    ['81:8:2', 'ٱلْمَوْءُۥدَةُ', ['الموده', 'المووده', 'الموووده']],
    ['2:22:13', 'بِهِۦ (the pronoun only lengthens)', ['به']],
    ['21:88:7', 'نُـۨجِي (small high noon)', ['نجي', 'ننجي']],
    ['4:23:21', 'ٱلَّٰتِي (drawn with one lam)', ['اللاتي', 'اللتي']],
    ['4:16:1', 'وَٱلَّذَانِ (dual, drawn with one lam)', ['واللذان']],
    ['2:24:8', 'ٱلَّتِي (one lam in both)', ['التي']],
    ['2:221:30', 'يَدْعُوٓا۟ (silent final alif)', ['يدعو', 'يدعوا']],
    ['11:68:7', 'ثَمُودَا۟', ['ثمود', 'ثمودا']],
    ['2:259:19', 'مِا۟ئَةَ (silent alif inside)', ['مايه', 'ميه']],
    ['10:4:8', 'يَبْدَؤُا۟ (final hamza on waw)', ['يبد', 'يبدا', 'يبدوا']],
    ['6:76:5', 'رَءَا', ['را', 'راي', 'ري']],
    ['3:184:8', 'جَآءُو', ['جاو', 'جاوا', 'جاوو', 'جاووا']],
    ['10:94:8', 'فَسْـَٔلِ', ['فاسال', 'فاسل', 'فسال', 'فسل']],
    ['3:144:10', 'أَفَإِي۟ن (silent yeh)', ['افان', 'افاين']],
    ['2:245:14', 'وَيَبْصُۜطُ (sad with a small seen)', ['ويبسط', 'ويبصط']],
    ['7:69:22', 'بَصْۜطَةࣰ', ['بسطه', 'بصطه']],
    [
      '52:37:7',
      'ٱلْمُصَۣيْطِرُونَ (small seen under it)',
      ['المسيطرون', 'المصيطرون'],
    ],
    [
      '7:103:9',
      'وَمَلَإِي۟هِۦ (hamza and silent yeh)',
      ['وملاه', 'وملايه', 'ومليه'],
    ],
    ['10:83:12', 'وَمَلَإِي۟هِمْ', ['وملاهم', 'وملايهم', 'ومليهم']],
    ['7:145:18', 'سَأُو۟رِيكُمْ (silent waw)', ['ساريكم', 'ساوريكم']],
  ])('%s %s', (location, _word, expected) => {
    expect(spellingSet(location)).toEqual(expected);
  });

  // A hamza drawn on the line or on a tatweel is typed on its everyday seat
  // (يسألونك, typed يسالونك with a bare alif): one more spelling.
  it.each([
    ['17:85:1', 'وَيَسْـَٔلُونَكَ', 'ويسالونك'],
    ['96:9:1', 'أَرَءَيْتَ', 'ارايت'],
    ['9:86:10', 'ٱسْتَـْٔذَنَكَ', 'استاذنك'],
    ['10:49:19', 'يَسْتَـْٔخِرُونَ', 'يستاخرون'],
    ['11:29:3', 'أَسْـَٔلُكُمْ', 'اسالكم'],
    ['2:143:44', 'لَرَءُوفࣱ (damma: ؤ)', 'لرووف'],
    ['6:110:2', 'أَفْـِٔدَتَهُمْ (kasra: ئ)', 'افيدتهم'],
    ['2:14:16', 'مُسْتَهْزِءُونَ (the kasra before it wins)', 'مستهزيون'],
    ['2:40:2', 'إِسْرَٰٓءِيلَ (kasra after a long alif)', 'اسراييل'],
    ['2:271:16', 'سَيِّـَٔاتِكُمْ (ئ, then the alif stays)', 'سيياتكم'],
    ['4:112:3', 'خَطِيٓـَٔةً (after a long yeh)', 'خطييه'],
    ['3:49:16', 'كَهَيْـَٔةِ', 'كهييه'],
    ['12:87:8', 'تَا۟يْـَٔسُوا۟ (ييأس keeps its alif)', 'تياسوا'],
    ['2:48:8', 'شَيْـࣰٔا (a tanween alif after ي)', 'شييا'],
    ['17:31:12', 'خِطْـࣰٔا (after a joining letter)', 'خطيا'],
    ['2:6:6', 'ءَأَنذَرْتَهُمْ (first in the word: on an alif)', 'اانذرتهم'],
    ['13:5:5', 'أَءِذَا (after the question hamza: by the rule)', 'ايذا'],
    ['13:5:5', 'أَءِذَا (or as the first letter of إذا)', 'ااذا'],
    ['38:8:1', 'أَءُنزِلَ', 'اونزل'],
    ['38:8:1', 'أَءُنزِلَ', 'اانزل'],
  ])('%s %s is also typed %s', (location, _word, typed) => {
    expect(quranWordSpellings(dk(location)).alternates).toContain(typed);
  });

  it.each([
    ['2:185:6', 'ٱلْقُرْءَانُ (with the alif after it: آ)'],
    ['2:34:5', 'لِـَٔادَمَ (لِ before آدم)'],
    ['2:20:6', 'أَضَآءَ (final, after a long alif)'],
    ['2:23:14', 'شُهَدَآءَكُم (a fatha after a long alif)'],
    ['5:31:10', 'سَوْءَةَ (a fatha after a waw with a sukun)'],
    ['2:260:30', 'جُزْءࣰا (after a letter that never joins)'],
    ['4:92:12', 'خَطَـࣰٔا (after a fatha the tanween alif goes)'],
  ])('%s %s keeps the hamza on the line', location => {
    expect(quranWordSpellings(dk(location)).alternates).toEqual([]);
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
      f =>
        `${f.form} ${f.tier}${f.rasmOnly ? ' rasm' : ''}${
          f.asDrawn ? ' drawn' : ''
        }`,
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
    // وَيَٰقَوْمِ, and يقوم as drawn without the و (which the index drops:
    // it is يَقُومُ's spelling)
    expect(forms('11:29:1', morph(['wa', 'ya'], false, 'قَوْم'))).toEqual([
      'وياقوم 3',
      'ويقوم 3 rasm',
      'ياقوم 2',
      'قوم 2',
      'يقوم 2 rasm drawn',
    ]);
  });

  it('also gives the letters exactly as drawn of a vocative or a one-lam word', () => {
    // The index keeps these only where no other word has them.
    expect(forms('2:21:1', morph(['ya'], false, 'أَيّ'))).toEqual([
      'ياايها 3',
      'يايها 3 rasm drawn',
      'ايها 2',
    ]);
    expect(forms('2:55:3', morph(['ya'], false, 'مُوسَىٰ'))).toEqual([
      'ياموسي 3',
      'يموسي 3 rasm drawn',
      'موسي 2',
    ]);
    expect(forms('2:164:7', morph([], true, 'لَيْل'))).toEqual([
      'الليل 3',
      'اليل 3 rasm drawn',
      'ليل 1',
    ]);
    // A word without these conventions has no other letters as drawn.
    expect(forms('1:1:3', morph([], true, 'رَحْمَٰن'))).toEqual([
      'الرحمان 3',
      'الرحمن 3 rasm',
      'رحمان 1',
      'رحمن 1 rasm',
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
    // ءَأَلِدُ: the question hamza (ء) folds away, or is typed on an alif
    // (أألد); the verb keeps its أ
    expect(forms('11:72:3', morph(['hamza'], false, null))).toEqual([
      'الد 3',
      'االد 3',
    ]);
  });

  it('gives al-layl its two lams in every form', () => {
    // وَٱلَّيْلِ, and its one lam as drawn
    expect(forms('74:33:1', morph(['wa'], true, 'لَيْل'))).toEqual([
      'والليل 3',
      'واليل 3 rasm drawn',
      'الليل 2',
      'اليل 2 rasm drawn',
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
    // The letters as drawn keep their ت: غَيَٰبَتِ is غيابة or غيبت.
    expect(forms('12:10:9', morph([], false, 'غَيَٰبَة'))).toEqual([
      'غيابت 3',
      'غيبت 3 rasm',
      'غيابه 3',
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

  it('spells a final alif as ى when the lemma has one there', () => {
    // طَغَا (lemma طَغَىٰ), لَدَا (lemma لَدَى)
    expect(forms('69:11:3', morph([], false, 'طَغَىٰ'))).toEqual([
      'طغا 3',
      'طغي 3',
    ]);
    expect(forms('12:25:9', morph([], false, 'لَدَى'))).toEqual([
      'لدا 3',
      'لدي 3',
    ]);
    // ٱلْأَقْصَا, with the lemma the build reads as أَقْصَى: with and
    // without its article.
    expect(forms('17:1:11', morph([], true, 'أَقْصَى'))).toEqual([
      'الاقصا 3',
      'اقصا 1',
      'الاقصي 3',
      'اقصي 1',
    ]);
    // Not for an alif after the lemma's letters (a dual: أَتَيَا of أَتَىٰ).
    expect(
      quranWordForms('أَتَيَا', morph([], false, 'أَتَىٰ')).map(f => f.form),
    ).toEqual(['اتيا']);
  });

  it('gives a plural waw drawn with a sukun its alif', () => {
    // وَعَتَوْ, سَعَوْ; not لَوْ (two letters)
    expect(forms('25:21:17', morph(['wa'], false, 'عَتَ'))).toEqual([
      'وعتو 3',
      'عتو 2',
      'وعتوا 3',
      'عتوا 2',
    ]);
    expect(forms('34:5:2', morph([], false, 'سَعَىٰ'))).toEqual([
      'سعو 3',
      'سعوا 3',
    ]);
    expect(forms('2:96:11', morph([], false, 'لَو'))).toEqual(['لو 3']);
  });

  it('spells out the second yeh of ح ي ي that the text leaves out', () => {
    const ofRoot = (root: string, m: QuranWordMorph) => ({...m, root});
    // يُحْيِ, لَمُحْيِ
    expect(
      forms('2:73:5', ofRoot('ح ي ي', morph([], false, 'أَحْيَا'))),
    ).toEqual(['يحي 3', 'يحيي 3']);
    expect(
      forms('30:50:13', ofRoot('ح ي ي', morph(['li'], false, 'مُحْى'))),
    ).toEqual(['لمحي 3', 'محي 2', 'لمحيي 3', 'محيي 2']);
    // بِٱلْوَحْيِ, of و ح ي, has one yeh.
    expect(
      forms('21:45:4', ofRoot('و ح ي', morph(['bi'], true, 'وَحْى'))),
    ).toEqual(['بالوحي 3', 'الوحي 2', 'وحي 1']);
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

  it('joins a conjunction or preposition typed apart to the next word', () => {
    expect(keys('و الله')).toEqual([['والله']]);
    expect(keys('ف الله')).toEqual([['فالله']]);
    expect(keys('ب الله')).toEqual([['بالله']]);
    expect(keys('ك الذي')).toEqual([['كالذي']]);
    expect(keys('و من الله في')).toEqual([['ومن'], ['الله'], ['في']]);
    // From the right: و ب الله is وبالله.
    expect(keys('و ب الله')).toEqual([['وبالله']]);
    // ل before the article drops its alif (للناس), and before الله a lam.
    expect(keys('ل الناس')).toEqual([['للناس']]);
    expect(keys('ل الله')).toEqual([['لله']]);
    expect(keys('ل الأرض')).toEqual([['للارض', 'للرض']]);
    // With a vocative: و يا قوم is وَيَٰقَوْمِ.
    expect(keys('و يا قوم')).toEqual([['وياقوم']]);
    // Not before a letter typed apart, nor at the end.
    expect(keys('ب س م الله')).toEqual([['ب'], ['س'], ['م'], ['الله']]);
    expect(keys('الله و')).toEqual([['الله'], ['و']]);
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

  it('reads Persian, Urdu and Kurdish keyboard letters as Arabic ones', () => {
    // یا with a Persian yeh joins the next word like يا.
    expect(keys('یا أیها الذین آمنوا')).toEqual([
      ['ياايها'],
      ['الذين'],
      ['امنوا'],
    ]);
    expect(keys('یا قوم')).toEqual([['ياقوم']]);
    // Urdu heh goal (ہ), heh doachashmee (ھ), teh marbuta goal (ۃ), Kurdish
    // ae (ە), heh with yeh above (ۀ)
    expect(keys('اللہ')).toEqual([['الله']]);
    expect(keys('ھدی')).toEqual([['هدي']]);
    expect(keys('إبراہیم')).toEqual([['ابراهيم']]);
    for (const mercy of ['رحمۃ', 'رحمہ', 'رحمە', 'رحمۀ']) {
      expect(keys(mercy)).toEqual([['رحمه']]);
    }
    // A word of these letters only is still an Arabic word.
    expect(keys('ہ')).toEqual([['ه']]);
  });

  it('reads verse numbers pasted with their verses as the ends of ayahs', () => {
    const tokens = (query: string) => {
      const parsed = parseQuranQuery(query);
      if (parsed.kind !== 'text') throw new Error(`${query}: ${parsed.kind}`);
      return parsed.tokens;
    };
    const praise = [['الحمد'], ['لله'], ['رب'], ['العالمين']];
    // A number in parentheses or brackets after the verse, in any digits.
    for (const query of [
      'الحمد لله رب العالمين (2)',
      'الحمد لله رب العالمين (٢)',
      'الحمد لله رب العالمين [2]',
      'الحمد لله رب العالمين ﴿٢﴾',
      'الحمد لله رب العالمين ۝٢',
    ]) {
      expect(keys(query)).toEqual(praise);
      expect(tokens(query).some(t => t.ayahStart)).toBe(false);
    }
    // Two ayahs pasted together: the second starts at the first word after
    // the number.
    const verses = `${['1:2:1', '1:2:2', '1:2:3', '1:2:4', '1:2:5']
      .map(dk)
      .join(' ')} ${['1:3:1', '1:3:2', '1:3:3'].map(dk).join(' ')}`;
    expect(tokens(verses).map(t => t.ayahStart ?? false)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(
      tokens('الحمد لله رب العالمين (2) الرحمن الرحيم (3)')[4],
    ).toMatchObject({keys: ['الرحمن'], ayahStart: true});
    // Other digits keep the query out (commands), as do numbers alone.
    expect(parseQuranQuery('سورة 2')).toEqual({kind: 'none'});
    expect(parseQuranQuery('(2)')).toEqual({kind: 'none'});
    expect(parseQuranQuery('2:255 (الكرسي)')).toEqual({kind: 'none'});
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
      expect(keys('ب ت')).toEqual([['بت']]);
    });

    describe('surah openings', () => {
      const withAlam = new Set(['ء ل م', 'ر ح م']);
      const knowsAlam = (root: string) => withAlam.has(root);
      const opening = (key: string) => ({
        kind: 'text',
        tokens: [{keys: [key], needsHamza: false, opening: true}],
      });

      it('lists the 14 openings', () => {
        expect(QURAN_OPENINGS.size).toBe(14);
        expect([...QURAN_OPENINGS].every(o => /^[ء-ي]+$/u.test(o))).toBe(true);
      });

      it('reads ا ل م as the opening, even though it spells the root ء ل م', () => {
        expect(parseQuranQuery('ا ل م', knowsAlam)).toEqual({
          ...opening('الم'),
          // The root stays reachable as a suggestion.
          rootLetters: 'الم',
        });
      });

      it.each([
        ['ا ل م ص', 'المص'],
        ['ا ل ر', 'الر'],
        ['ا ل م ر', 'المر'],
        ['ك ه ي ع ص', 'كهيعص'],
        ['ط ه', 'طه'],
        ['ط س م', 'طسم'],
        ['ط س', 'طس'],
        ['ي س', 'يس'],
        ['ح م', 'حم'],
        ['ع س ق', 'عسق'],
        ['ص', 'ص'],
        ['ق', 'ق'],
        ['ن', 'ن'],
        // Pasted with the mushaf's marks (a maddah over the letters, which
        // ألم never has), another keyboard's letters.
        [dk('68:1:1'), 'ن'],
        [dk('2:1:1'), 'الم'],
        [dk('10:1:1'), 'الر'],
        [dk('42:2:1'), 'عسق'],
        ['ک ه ی ع ص', 'كهيعص'],
        ['ى س', 'يس'],
      ])('%s is the opening %s', (query, key) => {
        expect(parseQuranQuery(query, knowsAlam)).toMatchObject(opening(key));
      });

      it('reads letters typed apart before other words as their opening', () => {
        const first = (query: string) => {
          const parsed = parseQuranQuery(query, knowsAlam);
          if (parsed.kind !== 'text') throw new Error(query);
          return {
            words: parsed.tokens.length,
            first: parsed.tokens[0],
            rest: parsed.tokens.slice(1).some(t => t.opening),
          };
        };
        expect(first('ا ل ر تلك آيات الكتاب')).toEqual({
          words: 4,
          first: {keys: ['الر'], needsHamza: false, opening: true},
          rest: false,
        });
        expect(first('ح م تنزيل الكتاب')).toMatchObject({
          words: 3,
          first: {keys: ['حم'], opening: true},
        });
        expect(first('ن والقلم')).toMatchObject({
          words: 2,
          first: {keys: ['ن'], opening: true},
        });
        // Pasted from the mushaf, with its maddah.
        expect(first(`${dk('2:1:1')} ${dk('2:2:1')}`)).toMatchObject({
          words: 2,
          first: {keys: ['الم'], opening: true},
          rest: false,
        });
        // Letters that are no opening, or typed with a hamza: as typed.
        expect(first('ب س م الله')).toMatchObject({words: 4});
        expect(first('ب س م الله').first.opening).toBeUndefined();
        expect(first('أ ل م تنزيل')).toMatchObject({words: 4});
        expect(first('أ ل م تنزيل').first.opening).toBeUndefined();
      });

      it('leaves other letters alone', () => {
        // Typed with a hamza: the root letters, not an opening.
        expect(parseQuranQuery('أ ل م', knowsAlam)).toEqual({
          kind: 'root',
          letters: 'ألم',
          explicit: false,
        });
        expect(parseQuranQuery('ر ح م', knowsAlam)).toMatchObject({
          kind: 'root',
        });
        // One word: an ordinary word (also ألم without its hamza), as is
        // ألم pasted from the mushaf (no maddah).
        expect(parseQuranQuery('الم', knowsAlam)).toEqual({
          kind: 'text',
          tokens: [{keys: ['الم'], needsHamza: false}],
          rootLetters: 'الم',
        });
        expect(parseQuranQuery(dk('94:1:1'), knowsAlam)).toEqual({
          kind: 'text',
          tokens: [{keys: ['الم'], needsHamza: true}],
          rootLetters: 'ألم',
        });
        // A letter that opens no surah, and spaced letters that open none.
        expect(parseQuranQuery('ب', knowsAlam)).toEqual({
          kind: 'text',
          tokens: [{keys: ['ب'], needsHamza: false}],
          rootLetters: null,
        });
        expect(parseQuranQuery('ب ت ث ج د', knowsAlam)).toEqual({
          kind: 'text',
          tokens: [{keys: ['بتثجد'], needsHamza: false}],
          rootLetters: null,
        });
      });

      it('reads letters typed apart that spell two openings as both (ح م ع س ق)', () => {
        const two = [
          {keys: ['حم'], needsHamza: false, opening: true},
          {keys: ['عسق'], needsHamza: false, opening: true},
        ];
        expect(parseQuranQuery('ح م ع س ق', knowsAlam)).toEqual({
          kind: 'text',
          tokens: two,
          rootLetters: null,
        });
        // Before other words too (42:1-3).
        const parsed = parseQuranQuery('ح م ع س ق كذلك يوحي', knowsAlam);
        expect(parsed.kind === 'text' && parsed.tokens).toEqual([
          ...two,
          {keys: ['كذلك'], needsHamza: false},
          {keys: ['يوحي'], needsHamza: false},
        ]);
        // Two openings that are not one after the other in the text (ص,
        // طه) find nothing as text, so a known root they spell comes first.
        expect(parseQuranQuery('ص ط ه', () => true)).toEqual({
          kind: 'root',
          letters: 'صطه',
          explicit: false,
        });
        expect(parseQuranQuery('ص ط ه', knowsAlam)).toMatchObject({
          kind: 'text',
          tokens: [
            {keys: ['ص'], opening: true},
            {keys: ['طه'], opening: true},
          ],
        });
      });
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

  it('finds اطمأن and اشمأز under the roots the corpus gives them', () => {
    // The corpus writes them ط م ن and ش م ز, without the hamza.
    const corpus = new Set(['ط م ن', 'ش م ز', 'ل ء ل ء', 'ق ر ن', 'ق ر ء']);
    const isCorpusRoot = (root: string) => corpus.has(root);
    expect(rootCandidates('طمأن', isCorpusRoot)).toEqual(['ط م ن']);
    expect(rootCandidates('ط م ا ن', isCorpusRoot)).toEqual(['ط م ن']);
    expect(rootCandidates('شمأز', isCorpusRoot)).toEqual(['ش م ز']);
    expect(rootCandidates('لألأ', isCorpusRoot)).toEqual(['ل ء ل ء']);
    // Other hamzas stay root letters: قرآن is no root of three letters.
    expect(rootCandidates('قرآن', isCorpusRoot)).toEqual([]);
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
