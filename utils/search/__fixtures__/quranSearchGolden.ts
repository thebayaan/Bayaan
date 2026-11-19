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
  // Persian and Urdu keyboards (ی ک, ہ ھ ۃ)
  {query: 'یا أیها الذین آمنوا', first: '2:104', count: 89},
  {query: 'یا قوم', includes: ['2:54']},
  {query: 'بسم اللہ الرحمن الرحیم', exactly: ['1:1', '27:30']},
  {query: 'ذلک الکتاب', exactly: ['2:2']},
  {query: 'ھدی للمتقین', includes: ['2:2']},
  {query: 'إبراہیم', first: '2:124'},
  {query: 'الجنۃ', includes: ['2:35']},
  {query: 'رحمہ', includes: ['7:56']},
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
  // A hamza drawn on the line or on a tatweel, typed on its seat or as a
  // bare alif (يَسْـَٔلُونَكَ, رَءَا, أَرَءَيْتَ, فَسْـَٔلُوٓا۟).
  {query: 'يسالونك عن الروح', exactly: ['17:85']},
  {query: 'ويسألونك عن الروح', exactly: ['17:85']},
  {query: 'فلما راى', includes: ['6:77', '6:78', '11:70', '12:28']},
  {query: 'ارايت الذي ينهى', exactly: ['96:9']},
  {query: 'افرايتم ما تمنون', exactly: ['56:58']},
  {query: 'فاسالوا اهل الذكر', exactly: ['16:43', '21:7']},
  {query: 'قل لا اسالكم عليه اجرا', includes: ['6:90', '42:23']},
  {query: 'يستأذنك', includes: ['9:44', '9:45']},
  {query: 'يسأ', includes: ['2:189', '2:215']},
  // Without its seat letter a typed hamza is often another word: امرأة is
  // not أمره (5:95, 12:21), رئاء not رأى (6:76), امرأت not أمرت (6:14).
  // Only a word the text does not have falls back to it (أإله, 27:60).
  {
    query: 'امرأة',
    includes: ['3:35', '4:12', '27:23'],
    excludes: ['5:95', '12:21'],
  },
  {query: 'امرأت', includes: ['3:35', '66:11'], excludes: ['6:14', '39:11']},
  {
    query: 'رئاء',
    includes: ['2:264', '4:38', '8:47'],
    excludes: ['6:76', '6:77'],
  },
  {query: 'أإله مع الله', includes: ['27:60', '27:61', '27:64']},
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
  // The vocative and one-lam words typed as drawn (يَٰٓأَيُّهَا, ٱلَّيْل),
  // except where the letters spell another word: يقوم is يَقُومُ, not
  // يَٰقَوْمِ (2:54), and الى is إِلَى, not ٱلَّٰٓـِٔى (33:4, 58:2).
  {query: 'يأيها الذين آمنوا', first: '2:104', count: 89},
  {query: 'يايها الناس', includes: ['2:21']},
  {query: 'يموسى', includes: ['2:55', '7:115']},
  {query: 'يآدم', includes: ['2:33', '2:35']},
  {query: 'يبني إسرائيل', includes: ['2:40', '2:47']},
  {query: 'اليل', includes: ['2:164', '3:27']},
  {query: 'واليل إذا يغشى', first: '92:1', exactly: ['92:1', '91:4']},
  {query: 'يقوم', excludes: ['2:54', '5:20']},
  {query: 'الى', excludes: ['33:4', '58:2']},
  // An open taa (فِطْرَتَ, مَرْضَاتِ) typed as ة, also where the corpus
  // spells the lemma with ت (TAA_MARBUTA_LEMMAS).
  {query: 'فطرة الله', exactly: ['30:30']},
  {query: 'ابتغاء مرضاة الله', exactly: ['2:207', '2:265', '4:114']},
  {query: 'ابنة عمران', exactly: ['66:12']},
  {query: 'غيابة الجب', exactly: ['12:10', '12:15']},
  {query: 'معصية الرسول', exactly: ['58:8', '58:9']},
  {query: 'جمالة صفر', exactly: ['77:33']},
  {query: 'رحمة ربك', includes: ['19:2', '43:32']},
  // An alif maqsura drawn as a final alif (ٱلْأَقْصَا, طَغَا), typed as ى.
  {query: 'المسجد الأقصى', exactly: ['17:1']},
  {query: 'المسجد الاقصي', exactly: ['17:1']},
  {query: 'من أقصى المدينة', exactly: ['28:20', '36:20']},
  {query: 'لما طغى الماء', exactly: ['69:11']},
  {query: 'رسلنا تترى', exactly: ['23:44']},
  {query: 'لدى الباب', exactly: ['12:25']},
  // Other Uthmani spellings: a sad with a small seen, a hamza before a silent
  // yeh, a plural waw without its alif, a silent waw, the yeh of يحيي left
  // out, and the reviewed spellings (REVIEWED_SPELLINGS).
  {query: 'يقبض ويبسط', includes: ['2:245']},
  {query: 'وزادكم في الخلق بسطة', exactly: ['7:69']},
  {query: 'المسيطرون', exactly: ['52:37']},
  {
    query: 'فرعون وملئه',
    includes: ['7:103', '10:75', '11:97', '23:46', '28:32', '43:46'],
  },
  {query: 'وملئهم', includes: ['10:83']},
  {query: 'وعتوا عتوا كبيرا', exactly: ['25:21']},
  {query: 'سعوا في آياتنا', includes: ['22:51', '34:5']},
  {query: 'سأريكم', exactly: ['7:145', '21:37']},
  {query: 'يحيي الموتى', includes: ['22:6', '42:9', '46:33', '75:40']},
  {query: 'لمحيي الموتى', exactly: ['30:50', '41:39']},
  {query: 'ليسوءوا وجوهكم', exactly: ['17:7']},
  {query: 'أصحاب الأيكة', exactly: ['15:78', '26:176', '38:13', '50:14']},
  {query: 'لاتخذت عليه أجرا', exactly: ['18:77']},
  {query: 'بمسيطر', exactly: ['88:22']},
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
  // A conjunction or preposition typed as a word of its own.
  {query: 'و الله', includes: ['2:19']},
  {query: 'و الله على كل شيء قدير', includes: ['2:284', '3:29']},
  {query: 'ل الناس', includes: ['2:185']},
  {query: 'ب الله', includes: ['2:8']},
  {query: 'ح م و الكتاب المبين', exactly: ['43:2', '44:2']},
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
  // Muqatta'at. Letters typed apart (or one letter) are the surah opening:
  // whole words drawn without a hamza, also when the letters spell a root
  // (ا ل م, root ء ل م, which is suggested instead).
  {query: 'ا ل م', exactly: ['2:1', '3:1', '29:1', '30:1', '31:1', '32:1']},
  {query: 'ا ل م ص', exactly: ['7:1']},
  {query: 'ا ل ر', exactly: ['10:1', '11:1', '12:1', '14:1', '15:1']},
  {query: 'ا ل م ر', exactly: ['13:1']},
  {query: 'ك ه ي ع ص', exactly: ['19:1']},
  {query: 'ط ه', exactly: ['20:1']},
  {query: 'ط س م', exactly: ['26:1', '28:1']},
  {query: 'ط س', exactly: ['27:1']},
  {query: 'ي س', exactly: ['36:1']},
  {query: 'ص', exactly: ['38:1']},
  {
    query: 'ح م',
    exactly: ['40:1', '41:1', '42:1', '43:1', '44:1', '45:1', '46:1'],
  },
  {query: 'ع س ق', exactly: ['42:2']},
  // Two openings in a row (حم عسق, 42:1-2), typed apart.
  {query: 'ح م ع س ق', exactly: ['42:2']},
  {query: 'ح م ع س ق كذلك يوحي', exactly: ['42:3']},
  {query: 'ق', exactly: ['50:1']},
  {query: 'ن', exactly: ['68:1']},
  // A phrase runs on from an ayah of one word (QURAN_ONE_WORD_AYAHS: an
  // opening, الرحمن, والعصر) into the next ayah, which is the hit: a surah's
  // beginning pasted with its opening.
  {query: 'الم ذلك الكتاب لا ريب فيه', exactly: ['2:2']},
  {query: 'الٓمٓ ذَٰلِكَ ٱلۡكِتَٰبُ لَا رَيۡبَۛ فِيهِۛ', exactly: ['2:2']},
  {query: 'الم الله لا إله إلا هو', exactly: ['3:2']},
  {query: 'الم أحسب الناس', exactly: ['29:2']},
  {query: 'الم تنزيل الكتاب', exactly: ['32:2']},
  {query: 'المص كتاب أنزل إليك', exactly: ['7:2']},
  {query: 'كهيعص ذكر رحمت ربك', exactly: ['19:2']},
  {query: 'طه ما أنزلنا عليك القرآن لتشقى', exactly: ['20:2']},
  {query: 'طسم تلك آيات الكتاب المبين', exactly: ['26:2', '28:2']},
  {query: 'يس والقرآن الحكيم', exactly: ['36:2']},
  {query: 'حم تنزيل الكتاب', exactly: ['40:2', '45:2', '46:2']},
  {query: 'حم عسق', exactly: ['42:2']},
  {query: 'حم عسق كذلك يوحي', exactly: ['42:3']},
  {query: 'الرحمن علم القرآن', exactly: ['55:2']},
  {query: 'والعصر إن الإنسان لفي خسر', exactly: ['103:2']},
  // Letters typed apart, then words: the opening they spell.
  {query: 'ا ل ر تلك آيات الكتاب', exactly: ['10:1', '12:1', '15:1']},
  {query: 'ح م تنزيل الكتاب', exactly: ['40:2', '45:2', '46:2']},
  // Pasted from the mushaf, with the maddah over its letters (which ألم
  // never has), one word is the opening too.
  {query: 'الٓمٓ', exactly: ['2:1', '3:1', '29:1', '30:1', '31:1', '32:1']},
  {query: 'الٓرۚ', exactly: ['10:1', '11:1', '12:1', '14:1', '15:1']},
  // Typed as one word, an opening is an ordinary word: الم also finds ألم
  // typed without its hamza (2:106) and, as a prefix, الملك; the openings
  // rank with the whole-word matches, in mushaf order.
  {
    query: 'الم',
    first: '2:1',
    includes: ['3:1', '29:1', '30:1', '31:1', '32:1', '2:106', '67:1'],
  },
  {query: 'طه', includes: ['20:1']},
  {query: 'يس', includes: ['36:1']},
  {query: 'كهيعص', includes: ['19:1']},
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
  // An opening keeps its root reachable as a suggestion.
  {letters: 'ا ل م', roots: ['ء ل م']},
  {letters: 'الم', roots: ['ء ل م']},
];

/**
 * What every surface treats a query as: the kind of the data service's
 * outcome (the service alone parses with the root list), and the root it
 * lists (root) or the roots it suggests (text).
 */
export interface QuranKindFixture {
  query: string;
  kind: 'none' | 'text' | 'root';
  roots: readonly string[];
}

export const QURAN_KIND_FIXTURES: readonly QuranKindFixture[] = [
  {query: 'ر ح م', kind: 'root', roots: ['ر ح م']},
  // Letters that could spell a root until the root list says they are the
  // text لكن (the surfaces hold their own rows until this answer).
  {query: 'ل ك ن', kind: 'text', roots: []},
  {query: 'root:رحم', kind: 'root', roots: ['ر ح م']},
  {query: 'جذر: ر ح م', kind: 'root', roots: ['ر ح م']},
  {query: 'رحم', kind: 'text', roots: ['ر ح م']},
  {query: 'ا ل م', kind: 'text', roots: ['ء ل م']},
  {query: 'ح م', kind: 'text', roots: []},
  {query: 'ح م ع س ق', kind: 'text', roots: []},
  {query: '2:255', kind: 'none', roots: []},
  {query: 'husary', kind: 'none', roots: []},
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
