// @ai-generated
/**
 * Golden queries for the Quran text search, shared by the index build (a
 * build gate, scripts/search/quranSearchIndex.ts) and Jest
 * (utils/search/__tests__/quranSearch.golden.test.ts, on the bundled DB).
 * Ayahs are Hafs verse keys.
 */

export interface QuranTextFixture {
  query: string;
  /** Ayahs that must be among the hits. */
  includes?: readonly string[];
  /** Ayahs that must not be among the hits. */
  excludes?: readonly string[];
  /** The first hit. */
  first?: string;
  /** Exactly these ayahs, in any order. */
  exactly?: readonly string[];
  /** This many ayahs. */
  count?: number;
  kind?: 'phrase' | 'allWords';
}

export const QURAN_TEXT_FIXTURES: readonly QuranTextFixture[] = [
  // Imla'i, rasm and mixed spellings
  {query: 'الصلاة', includes: ['2:3', '2:43']},
  {query: 'الصلوة', includes: ['2:3']},
  {query: 'يقيمون الصلاة', includes: ['2:3']},
  {query: 'الصلا', includes: ['2:3']},
  {query: 'الرحمن', includes: ['1:1', '1:3', '55:1']},
  {query: 'الرحمان', includes: ['1:1', '1:3', '55:1']},
  {query: 'رحمن', includes: ['1:1']},
  {query: 'الرحمن الرحيم', includes: ['1:1', '1:3']},
  {query: 'الكتاب', first: '2:2'},
  {query: 'كتاب', includes: ['2:2']},
  {query: 'هذا', includes: ['2:25']},
  {query: 'ذلك', includes: ['2:2']},
  {query: 'ذلك الكتاب', exactly: ['2:2']},
  {query: 'ذلك الكتاب لا ريب فيه', exactly: ['2:2']},
  {query: 'مالك', includes: ['1:4', '3:26', '43:77']},
  {query: 'ملك', includes: ['1:4', '114:2']},
  {query: 'مالك يوم الدين', includes: ['1:4']},
  {query: 'يخادعون', includes: ['2:9', '4:142']},
  {query: 'ابراهيم', first: '2:124', includes: ['2:125', '3:67']},
  {query: 'إبراهيم', first: '2:124'},
  {query: 'السموات', includes: ['2:33', '2:164', '2:255']},
  {query: 'السماوات', includes: ['2:164', '2:255']},
  {query: 'السموات والأرض', includes: ['2:164']},
  {query: 'الحياة الدنيا', includes: ['2:85', '2:86']},
  {query: 'الزكاة', includes: ['2:43']},
  {query: 'مشكاة', includes: ['24:35']},
  {query: 'الربا', includes: ['2:275']},
  {query: 'النبيين', includes: ['2:61']},
  {query: 'لكن', includes: ['2:12']},
  {query: 'إله', includes: ['2:163']},
  {query: 'على', includes: ['1:7']},
  {query: 'عليهم', includes: ['1:7']},
  {query: 'داود', includes: ['2:251']},
  {query: 'الليل', includes: ['2:164', '3:27']},
  // 91:4 يَغْشَىٰهَا matches the last word as a prefix, after the exact 92:1.
  {query: 'والليل إذا يغشى', first: '92:1', exactly: ['92:1', '91:4']},
  // Marks, tatweel, presentation forms, bidi marks, pasted Uthmani
  {query: 'ٱلرَّحْمَٰنِ', includes: ['1:1']},
  {query: 'الرَّحْمَنِ', includes: ['1:1']},
  {query: 'الرحمـن', includes: ['1:1']},
  {query: 'ﺍﻟﺮﺣﻤﻦ', includes: ['1:1']},
  {query: '\u{200F}الرحمن\u{200F}', includes: ['1:1']},
  // Hamza
  {query: 'السماء', includes: ['2:19', '2:22']},
  {query: 'شيء', includes: ['2:20']},
  {query: 'شئ', includes: ['2:20']},
  {query: 'ماء', includes: ['2:22'], excludes: ['2:4']},
  {query: 'القرآن', includes: ['2:185']},
  {query: 'هؤلاء', includes: ['2:31']},
  {query: 'أولئك', includes: ['2:5']},
  {query: 'مسؤولا', includes: ['17:34', '17:36', '33:15']},
  {query: 'مسئولا', includes: ['17:34']},
  {query: 'رؤوف', includes: ['2:143', '9:117']},
  {query: 'يستهزئون', includes: ['6:5']},
  {query: 'مستهزئون', includes: ['2:14']},
  {query: 'يؤمنون', includes: ['2:3']},
  {query: 'يومنون', includes: ['2:3']},
  {query: 'الأرض', includes: ['2:11']},
  // Vocative يا, ها
  {query: 'يا أيها', includes: ['2:21']},
  // A vocative typed with its conjunction is one Uthmani word (وَيَٰقَوْمِ).
  {query: 'ويا قوم', includes: ['11:29', '11:85', '40:32']},
  {query: 'ويا سماء أقلعي', includes: ['11:44']},
  // A final hamza on a seat after a long vowel (وَإِيتَآئِ, وَرَآئِ, تَبُوٓأَ).
  {query: 'وإيتاء ذي القربى', includes: ['16:90']},
  {query: 'أو من وراء حجاب', includes: ['42:51']},
  {query: 'أن تبوء بإثمي', includes: ['5:29']},
  {query: 'ياأيها', includes: ['2:21']},
  {query: 'يا أيها الذين آمنوا', first: '2:104', count: 89},
  {query: 'يا قوم', includes: ['2:54']},
  {query: 'قوم', includes: ['2:54']},
  {query: 'يا بني آدم', includes: ['7:26']},
  // Proclitics and the article
  {query: 'الله', first: '1:1', includes: ['2:7']},
  {query: 'والله', includes: ['2:19']},
  {query: 'لله', includes: ['1:2']},
  {query: 'الناس', includes: ['2:8', '114:1']},
  {query: 'للناس', includes: ['2:185']},
  {query: 'الذين', includes: ['1:7']},
  {query: 'للذين', includes: ['2:226']},
  {query: 'الضالين', includes: ['1:7']},
  {query: 'ولا الضالين', includes: ['1:7']},
  {query: 'هدى للمتقين', includes: ['2:2']},
  // Phrases
  {query: 'بسم الله الرحمن الرحيم', exactly: ['1:1', '27:30']},
  {query: 'الحمد لله', includes: ['1:2', '6:1', '18:1', '34:1', '35:1']},
  {
    query: 'الحمد لله رب العالمين',
    exactly: ['1:2', '6:45', '10:10', '37:182', '39:75', '40:65'],
  },
  {query: 'رب العالمين', includes: ['1:2']},
  {query: 'اهدنا الصراط المستقيم', includes: ['1:6']},
  {query: 'إياك نعبد', includes: ['1:5']},
  {query: 'صراط الذين أنعمت عليهم', includes: ['1:7']},
  {query: 'قل هو الله أحد', includes: ['112:1']},
  {query: 'الله لا إله إلا هو الحي القيوم', includes: ['2:255', '3:2']},
  {query: 'إن الله على كل شيء قدير', includes: ['2:20']},
  {query: 'والصافات صفا', includes: ['37:1']},
  {query: 'ألم تر', includes: ['2:243']},
  {query: 'فبأي آلاء ربكما تكذبان', first: '55:13', count: 31},
  {query: 'لا إكراه في الدين', includes: ['2:256']},
  {query: 'سبح اسم ربك الأعلى', includes: ['87:1']},
  {query: 'إذا جاء نصر الله والفتح', includes: ['110:1']},
  {query: 'تبت يدا أبي لهب', includes: ['111:1']},
  // Digital Khatt slots: «بعد ما» split in two, «إل ياسين» one slot
  {query: 'بعد ما', includes: ['2:181', '8:6', '13:37']},
  {query: 'إل ياسين', includes: ['37:130']},
  {query: 'الياسين', includes: ['37:130']},
  // Muqatta'at
  {query: 'الم', first: '2:1'},
  {query: 'طه', includes: ['20:1']},
  {query: 'يس', includes: ['36:1']},
  {query: 'كهيعص', includes: ['19:1']},
  {query: 'ك ه ي ع ص', includes: ['19:1']},
  {query: 'ح م', includes: ['40:1']},
  {query: 'ن والقلم', includes: ['68:1']},
  // The all-words fallback
  {query: 'العالمين رب', kind: 'allWords', includes: ['1:2']},
];

export interface QuranRootFixture {
  root: string;
  words: number;
  ayahs?: number;
  lemmas?: number;
  /** The lemma with the most words, compared by its letters. */
  topLemma?: {letters: string; words: number};
}

export const QURAN_ROOT_FIXTURES: readonly QuranRootFixture[] = [
  {
    root: 'ر ح م',
    words: 339,
    ayahs: 313,
    lemmas: 9,
    topLemma: {letters: 'رحيم', words: 116},
  },
  {root: 'ك ت ب', words: 319, lemmas: 7},
  {root: 'ء ل ه', words: 2851},
  {root: 'ر ء ي', words: 328},
  {root: 'س م و', words: 381},
  {root: 'د ع و', words: 212},
  {root: 'ق و ل', words: 1722},
  {root: 'ش ي ء', words: 519},
  {root: 'ء م ن', words: 879},
  // 20:94 يَبْنَؤُمَّ holds two stems; the word counts its main stem only.
  {root: 'ء م م', words: 118},
];

/** Typed letters and the known roots they must suggest. */
export const QURAN_ROOT_QUERY_FIXTURES: readonly {
  letters: string;
  roots: readonly string[];
}[] = [
  {letters: 'رحم', roots: ['ر ح م']},
  {letters: 'اله', roots: ['ء ل ه']},
  {letters: 'أله', roots: ['ء ل ه']},
  {letters: 'رأي', roots: ['ر ء ي']},
  {letters: 'راى', roots: ['ر ء ي']},
  {letters: 'سما', roots: ['س م و']},
  {letters: 'دعا', roots: ['د ع و']},
  {letters: 'قول', roots: ['ق و ل']},
  {letters: 'شيء', roots: ['ش ي ء']},
  {letters: 'أمن', roots: ['ء م ن']},
  {letters: 'كتب', roots: ['ك ت ب']},
];

/** Why a text search result fails a fixture, or null when it passes. */
export function textFixtureFailure(
  fixture: QuranTextFixture,
  found: {kind: string; hits: readonly {verseKey: string}[]},
): string | null {
  const keys = found.hits.map(hit => hit.verseKey);
  const has = new Set(keys);
  const problems: string[] = [];
  const missing = (fixture.includes ?? []).filter(key => !has.has(key));
  if (missing.length) problems.push(`missing ${missing.join(' ')}`);
  const extra = (fixture.excludes ?? []).filter(key => has.has(key));
  if (extra.length) problems.push(`unexpected ${extra.join(' ')}`);
  if (fixture.first && keys[0] !== fixture.first) {
    problems.push(`first ${keys[0] ?? 'none'}, expected ${fixture.first}`);
  }
  if (fixture.exactly) {
    const want = [...fixture.exactly].sort().join(' ');
    const got = [...keys].sort().join(' ');
    if (want !== got) problems.push(`got ${got || 'none'}, expected ${want}`);
  }
  if (fixture.count !== undefined && keys.length !== fixture.count) {
    problems.push(`${keys.length} ayahs, expected ${fixture.count}`);
  }
  if (fixture.kind && found.kind !== fixture.kind) {
    problems.push(`kind ${found.kind}, expected ${fixture.kind}`);
  }
  return problems.length ? `«${fixture.query}»: ${problems.join('; ')}` : null;
}
