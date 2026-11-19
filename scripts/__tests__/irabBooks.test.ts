/**
 * Turning the Quranpedia book pages into the passages the app shows.
 *
 * The page shapes come from the pinned dumps (version 2026-08-10). The main
 * text is the books' own; the footnote bodies are placeholders, since the
 * editor's notes are what the build removes.
 */
import {
  bookPassage,
  cleanBookHtml,
  isFrontMatter,
  pageVerse,
  stripEditorNotes,
} from '../irab/build-irab-db';

// Generated from the pinned dumps (version 2026-08-10): the books' text is
// copied code point for code point, the footnote bodies are placeholders.

/** al-Nahhas, part 1 page 13: the passage shown for 1:1. */
const NAHHAS_P1_13 =
  'قال أبو جعفر: حدّثنا أبو الحسن أحمد بن سعيد الدّمشقي «١» عن عبد الخالق عن أبي عبيد «٢» قال: حدّثنا عبّاد بن عبّاد المهلّبي عن واصل «٣» مولى أبي عيينة قال:<br />\rقال عمر بن الخطاب رضي الله عنه: تعلّموا إعراب القرآن كما تتعلّمون حفظه. فمن ذلك:<p class="text-center">\r[سورة الفاتحة (١) : آية ١]</p>\rبِسْمِ اللَّهِ الرَّحْمنِ الرَّحِيمِ (١)<br />\r(اسم) مخفوض بالباء الزائدة، وقال أبو إسحاق «٤» : وكسرت الباء ليفرّق بين ما<br />\r<div class="foot-notes">\r(١) الحاشية الأولى.<br />\r(٢) الحاشية الثانية.</div>';
const NAHHAS_P1_13_TEXT = [
  'قال أبو جعفر: حدّثنا أبو الحسن أحمد بن سعيد الدّمشقي عن عبد الخالق عن أبي عبيد قال: حدّثنا عبّاد بن عبّاد المهلّبي عن واصل مولى أبي عيينة قال:',
  'قال عمر بن الخطاب رضي الله عنه: تعلّموا إعراب القرآن كما تتعلّمون حفظه. فمن ذلك:',
  '[سورة الفاتحة (١) : آية ١]',
  'بِسْمِ اللَّهِ الرَّحْمنِ الرَّحِيمِ (١)',
  '(اسم) مخفوض بالباء الزائدة، وقال أبو إسحاق : وكسرت الباء ليفرّق بين ما',
];

/**
 * al-Nahhas, part 2 page 142 (its last line): the block's </div> sits inside
 * a poem table that a note opened.
 */
const NAHHAS_P2_142 =
  'وَإِذا تُتْلى عَلَيْهِمْ آياتُنا اسم ما لم يسمّ فاعله. قال أبو إسحاق بَيِّناتٍ نصب على الحال.<br />\r<div class="foot-notes">\r(١) الحاشية الأولى.<br />\r(٥) حاشية فيها بيت:<table class=\'poem\'><tr><td><strong>«صدر البيت</td><td>عجز البيت»</strong></div></td></tr></table>';
const NAHHAS_P2_142_TEXT = [
  'وَإِذا تُتْلى عَلَيْهِمْ آياتُنا اسم ما لم يسمّ فاعله. قال أبو إسحاق بَيِّناتٍ نصب على الحال.',
];

/**
 * al-Nahhas, part 4 page 38 (passage 2113): a line of the author's text
 * starts with a verse number, like a footnote does.
 */
const NAHHAS_P4_38 =
  'أَنْذَرْتُكُمْ صاعِقَةً مِثْلَ صاعِقَةِ عادٍ وَثَمُودَ<br />\r(١٣) فأمسكت على فيه، وناشدته الرحم أن يكفّ، وقد علمتم أنّ محمدا إذا قال شيئا لم يكذب فخفت أن ينزل بكم العذاب فناشدته الرحم أن يكفّ. قال الضحاك: صاعِقَةً مِثْلَ صاعِقَةِ عادٍ وَثَمُودَ أي عذابا- وقال محمد بن يزيد: الصاعقة معناها في كلام العرب المبيدة المهلكة المخمدة فربّما استعملت للإخماد من غير إهلاك ومنه سمّي الصّعق بن حرب لأنه ضرب ضربة فخمد ثم أفاق.<br />\rقرأ أبو عمرو ونافع فَأَرْسَلْنا عَلَيْهِمْ رِيحاً صَرْصَراً فِي أَيَّامٍ نَحِساتٍ «١» بإسكان الحاء، وأكثر القراء بكسرها فيقول: نَحِساتٍ واحتجّ أبو عمرو في التسكين على إجماعهم بتسكين الحاء في قولهم: نحس وفي قوله جلّ وعزّ: فِي يَوْمِ نَحْسٍ مُسْتَمِرٍّ <span class="surah-ref">[القمر: ١٩]</span> وردّ عليه أبو عبيد هذا الاحتجاج لأن معنى فِي يَوْمِ نَحْسٍ في يوم شؤم وأن معنى فِي أَيَّامٍ نَحِساتٍ في أيام مشؤومات، والقول كما قال أبو عبيد.<br />\rوَأَمَّا ثَمُودُ فَهَدَيْناهُمْ رفعت ثمود بالابتداء ولم تصرفه على أنه اسم للقبيلة<br />\r<div class="foot-notes">\r(١) الحاشية الأولى.</div>';
const NAHHAS_P4_38_TEXT = [
  'أَنْذَرْتُكُمْ صاعِقَةً مِثْلَ صاعِقَةِ عادٍ وَثَمُودَ',
  '(١٣) فأمسكت على فيه، وناشدته الرحم أن يكفّ، وقد علمتم أنّ محمدا إذا قال شيئا لم يكذب فخفت أن ينزل بكم العذاب فناشدته الرحم أن يكفّ. قال الضحاك: صاعِقَةً مِثْلَ صاعِقَةِ عادٍ وَثَمُودَ أي عذابا- وقال محمد بن يزيد: الصاعقة معناها في كلام العرب المبيدة المهلكة المخمدة فربّما استعملت للإخماد من غير إهلاك ومنه سمّي الصّعق بن حرب لأنه ضرب ضربة فخمد ثم أفاق.',
  'قرأ أبو عمرو ونافع فَأَرْسَلْنا عَلَيْهِمْ رِيحاً صَرْصَراً فِي أَيَّامٍ نَحِساتٍ بإسكان الحاء، وأكثر القراء بكسرها فيقول: نَحِساتٍ واحتجّ أبو عمرو في التسكين على إجماعهم بتسكين الحاء في قولهم: نحس وفي قوله جلّ وعزّ: فِي يَوْمِ نَحْسٍ مُسْتَمِرٍّ [القمر: ١٩] وردّ عليه أبو عبيد هذا الاحتجاج لأن معنى فِي يَوْمِ نَحْسٍ في يوم شؤم وأن معنى فِي أَيَّامٍ نَحِساتٍ في أيام مشؤومات، والقول كما قال أبو عبيد.',
  'وَأَمَّا ثَمُودُ فَهَدَيْناهُمْ رفعت ثمود بالابتداء ولم تصرفه على أنه اسم للقبيلة',
];

/** al-Nahhas, part 5 page 185 (passage 1355): no notes on the page. */
const NAHHAS_P5_185 =
  'رحلة الشتاء والصّيف. قال أبو جعفر: يكون هذا على البدل، وتقديره: إيلافهم إيلاف رحلة الشتاء والصيف.<br />\rْيَعْبُدُوا رَبَّ هذَا الْبَيْتِ<br />\r(٣) وإن شئت كسرت اللام على الأصل.<p class="text-center">\r[سورة قريش (١٠٦) : آية ٤]</p>\rالَّذِي أَطْعَمَهُمْ مِنْ جُوعٍ وَآمَنَهُمْ مِنْ خَوْفٍ (٤)';
const NAHHAS_P5_185_TEXT = [
  'رحلة الشتاء والصّيف. قال أبو جعفر: يكون هذا على البدل، وتقديره: إيلافهم إيلاف رحلة الشتاء والصيف.',
  'ْيَعْبُدُوا رَبَّ هذَا الْبَيْتِ',
  '(٣) وإن شئت كسرت اللام على الأصل.',
  '[سورة قريش (١٠٦) : آية ٤]',
  'الَّذِي أَطْعَمَهُمْ مِنْ جُوعٍ وَآمَنَهُمْ مِنْ خَوْفٍ (٤)',
];

/** al-Ukbari, part 1 page 5: the passage shown for 1:2. */
const UKBARI_P1_5 =
  'سُورَةُ الْفَاتِحَةِ<p class="text-center">\rبِسم الله الرَّحْمَن الرَّحِيم</p>\rقَالَ تَعَالَى: (الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ (٢) الرَّحْمَنِ الرَّحِيمِ (٣))<br />\r';
const UKBARI_P1_5_TEXT = [
  'سُورَةُ الْفَاتِحَةِ',
  'بِسم الله الرَّحْمَن الرَّحِيم',
  'قَالَ تَعَالَى: (الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ (٢) الرَّحْمَنِ الرَّحِيمِ (٣))',
];
// End of the generated fixtures.

describe('stripEditorNotes', () => {
  it("removes the footnote block and the «n» markers from al-Nahhas's page for 1:1", () => {
    const page = stripEditorNotes(NAHHAS_P1_13);
    expect(page).toMatchObject({footnoteBlocks: 1, markers: 4});
    expect(page.html).not.toMatch(/foot-notes|الحاشية|«/);
    expect(cleanBookHtml(page.html).split('\n')).toEqual(NAHHAS_P1_13_TEXT);
    expect(NAHHAS_P1_13_TEXT[0]).toContain('الدّمشقي عن عبد الخالق');
  });

  it('cuts a block whose </div> is misnested in a poem table', () => {
    const page = stripEditorNotes(NAHHAS_P2_142);
    expect(page.footnoteBlocks).toBe(1);
    expect(cleanBookHtml(page.html).split('\n')).toEqual(NAHHAS_P2_142_TEXT);
  });

  it("keeps the author's lines that start with a verse number", () => {
    const page = stripEditorNotes(NAHHAS_P4_38);
    expect(page).toMatchObject({footnoteBlocks: 1, markers: 1});
    expect(cleanBookHtml(page.html).split('\n')).toEqual(NAHHAS_P4_38_TEXT);
    expect(NAHHAS_P4_38_TEXT[1]).toMatch(/^\(١٣\) فأمسكت/);

    const plain = stripEditorNotes(NAHHAS_P5_185);
    expect(plain).toEqual({html: NAHHAS_P5_185, footnoteBlocks: 0, markers: 0});
    expect(cleanBookHtml(plain.html).split('\n')).toEqual(NAHHAS_P5_185_TEXT);
    expect(NAHHAS_P5_185_TEXT.slice(2, 4)).toEqual([
      '(٣) وإن شئت كسرت اللام على الأصل.',
      '[سورة قريش (١٠٦) : آية ٤]',
    ]);
  });

  it('drops a marker before punctuation without leaving a space', () => {
    expect(
      stripEditorNotes(
        'على قول البصريين «١»، وقال الكسائي «٢» : والحمد لله «٥».<br />\r«٣»<br />\r',
      ).html,
    ).toBe('على قول البصريين، وقال الكسائي : والحمد لله.<br />\r<br />\r');
  });

  it('fails when page text follows the footnotes or the block is not notes', () => {
    expect(() =>
      stripEditorNotes(
        'نص «١»<div class="foot-notes">\r(١) حاشية.</div>\rنص بعد الحواشي',
      ),
    ).toThrow(/after its footnotes/);
    expect(() =>
      stripEditorNotes('نص<div class="foot-notes">\rنص ليس بحاشية</div>'),
    ).toThrow(/footnote block/);
  });
});

describe('cleanBookHtml', () => {
  it('turns carriage returns and paragraph starts into line breaks', () => {
    // The surah's title and the basmala were one line, split only by a CR.
    expect(cleanBookHtml(UKBARI_P1_5).split('\n')).toEqual(UKBARI_P1_5_TEXT);
    expect(UKBARI_P1_5_TEXT[0]).toBe('سُورَةُ الْفَاتِحَةِ');
    expect(cleanBookHtml('سطر\r\nسطر آخر\rثالث<p>رابع')).toBe(
      'سطر\nسطر آخر\nثالث\nرابع',
    );
  });

  it('fails on any other control character', () => {
    expect(() => cleanBookHtml('نص\u0007نص')).toThrow(/control character/);
  });
});

describe('isFrontMatter', () => {
  const nahhas = {id: 318, frontMatter: {part: '1', before: 13, surah: 114}};

  it("drops the publisher's introduction that the dump files under surah 114", () => {
    expect(isFrontMatter(nahhas, {part: '1', page: '3'}, 114)).toBe(true);
    expect(isFrontMatter(nahhas, {part: '1', page: 12}, 114)).toBe(true);
  });

  it("keeps the author's pages", () => {
    expect(isFrontMatter(nahhas, {part: '1', page: '13'}, 1)).toBe(false);
    expect(isFrontMatter(nahhas, {part: '5', page: '199'}, 114)).toBe(false);
    expect(isFrontMatter(nahhas, {part: '2', page: '3'}, 6)).toBe(false);
    expect(isFrontMatter({id: 309}, {part: '1', page: '1'}, 114)).toBe(false);
  });

  it('fails when an introduction page turns up under another surah', () => {
    expect(() => isFrontMatter(nahhas, {part: '1', page: '5'}, 2)).toThrow(
      /318.*1\/5.*surah 2/,
    );
  });
});

describe('pageVerse', () => {
  const ukbari = {
    id: 309,
    opening: {part: '1', before: 5, from: '114:5', to: '1:1'},
  };

  it("files the author's opening pages with the verse they open", () => {
    expect(pageVerse(ukbari, {part: '1', page: '1'}, '114:5')).toBe('1:1');
    expect(pageVerse(ukbari, {part: '1', page: 4}, '114:5')).toBe('1:1');
    expect(pageVerse(ukbari, {part: '1', page: '3'}, '1:1')).toBe('1:1');
  });

  it('leaves every other page where the dump files it', () => {
    expect(pageVerse(ukbari, {part: '1', page: '5'}, '1:2')).toBe('1:2');
    expect(pageVerse(ukbari, {part: '2', page: '1312'}, '114:5')).toBe('114:5');
    expect(pageVerse({id: 318}, {part: '1', page: '1'}, '114:5')).toBe('114:5');
  });

  it('fails when an opening page turns up under another verse', () => {
    expect(() => pageVerse(ukbari, {part: '1', page: '2'}, '2:1')).toThrow(
      /309.*1\/2.*2:1/,
    );
  });
});

describe('bookPassage', () => {
  it('strips the notes of a book flagged as carrying them', () => {
    expect(bookPassage(NAHHAS_P4_38, true)).toMatchObject({
      footnoteBlocks: 1,
      markers: 1,
    });
  });

  it("fails rather than ship an editor's notes under the author's name", () => {
    expect(() => bookPassage(NAHHAS_P1_13, false)).toThrow(/footnotes/);
    expect(() => bookPassage('نص «١» آخر', false)).toThrow(/note marker/);
    expect(bookPassage(UKBARI_P1_5, false)).toMatchObject({
      footnoteBlocks: 0,
      markers: 0,
    });
  });
});
