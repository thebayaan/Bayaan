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
  stripEditorNotes,
} from '../irab/build-irab-db';

/** al-Nahhas, part 1 page 13: the passage shown for 1:1. */
const NAHHAS_P1_13 =
  'قال أبو جعفر: حدّثنا أبو الحسن أحمد بن سعيد الدّمشقي «١» عن عبد الخالق عن أبي عبيد «٢» قال: حدّثنا عبّاد بن عبّاد المهلّبي عن واصل «٣» مولى أبي عيينة قال:<br />\r' +
  'قال عمر بن الخطاب رضي الله عنه: تعلّموا إعراب القرآن كما تتعلّمون حفظه. فمن ذلك:<p class="text-center">\r[سورة الفاتحة (١) : آية ١]</p>\r' +
  'بِسْمِ اللَّهِ الرَّحْمنِ الرَّحِيمِ (١)<br />\r' +
  '(اسم) مخفوض بالباء الزائدة، وقال أبو إسحاق «٤» : وكسرت الباء ليفرّق بين ما<br />\r' +
  '<div class="foot-notes">\r(١) الحاشية الأولى.<br />\r(٢) الحاشية الثانية.<br />\r(٣) الحاشية الثالثة.<br />\r(٤) الحاشية الرابعة.</div>';

/**
 * al-Nahhas, part 2 page 142: the block's </div> sits inside a poem table
 * that a note opened.
 */
const NAHHAS_P2_142 =
  'وَإِذا تُتْلى عَلَيْهِمْ آياتُنا اسم ما لم يسمّ فاعله. قال أبو إسحاق بَيِّناتٍ نصب على الحال.<br />\r' +
  '<div class="foot-notes">\r(١) الحاشية الأولى.<br />\r' +
  "(٥) حاشية فيها بيت:<table class='poem'><tr><td><strong>«صدر البيت</td><td>عجز البيت»</strong></div></td></tr></table>";

/**
 * al-Nahhas, part 4 page 38 (passage 2113): a line of the author's text
 * starts with a verse number, like a footnote does.
 */
const NAHHAS_P4_38 =
  'أَنْذَرْتُكُمْ صاعِقَةً مِثْلَ صاعِقَةِ عادٍ وَثَمُودَ<br />\r' +
  '(١٣) فأمسكت على فيه، وناشدته الرحم أن يكفّ.<br />\r' +
  'وَأَمَّا ثَمُودُ فَهَدَيْناهُمْ رفعت ثمود بالابتداء «١» ولم تصرفه على أنه اسم للقبيلة<br />\r' +
  '<div class="foot-notes">\r(١) الحاشية الأولى.</div>';

/** al-Nahhas, part 5 page 185 (passage 1355): no notes on the page. */
const NAHHAS_P5_185 =
  'رحلة الشتاء والصّيف. قال أبو جعفر: يكون هذا على البدل، وتقديره: إيلافهم إيلاف رحلة الشتاء والصيف.<br />\r' +
  'ْيَعْبُدُوا رَبَّ هذَا الْبَيْتِ<br />\r' +
  '(٣) وإن شئت كسرت اللام على الأصل.<p class="text-center">\r[سورة قريش (١٠٦) : آية ٤]</p>\r' +
  'الَّذِي أَطْعَمَهُمْ مِنْ جُوعٍ وَآمَنَهُمْ مِنْ خَوْفٍ (٤)';

/** al-Ukbari, part 1 page 5: the passage shown for 1:2. */
const UKBARI_P1_5 =
  'سُورَةُ الْفَاتِحَةِ<p class="text-center">\rبِسم الله الرَّحْمَن الرَّحِيم</p>\r' +
  'قَالَ تَعَالَى: (الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ (٢) الرَّحْمَنِ الرَّحِيمِ (٣))<br />\r';

describe('stripEditorNotes', () => {
  it("removes the footnote block and the «n» markers from al-Nahhas's page for 1:1", () => {
    const page = stripEditorNotes(NAHHAS_P1_13);
    expect(page).toMatchObject({footnoteBlocks: 1, markers: 4});
    expect(page.html).not.toMatch(/foot-notes|الحاشية|«/);
    expect(cleanBookHtml(page.html).split('\n')).toEqual([
      'قال أبو جعفر: حدّثنا أبو الحسن أحمد بن سعيد الدّمشقي عن عبد الخالق عن أبي عبيد قال: حدّثنا عبّاد بن عبّاد المهلّبي عن واصل مولى أبي عيينة قال:',
      'قال عمر بن الخطاب رضي الله عنه: تعلّموا إعراب القرآن كما تتعلّمون حفظه. فمن ذلك:',
      '[سورة الفاتحة (١) : آية ١]',
      'بِسْمِ اللَّهِ الرَّحْمنِ الرَّحِيمِ (١)',
      '(اسم) مخفوض بالباء الزائدة، وقال أبو إسحاق : وكسرت الباء ليفرّق بين ما',
    ]);
  });

  it('cuts a block whose </div> is misnested in a poem table', () => {
    const page = stripEditorNotes(NAHHAS_P2_142);
    expect(page.footnoteBlocks).toBe(1);
    expect(cleanBookHtml(page.html)).toBe(
      'وَإِذا تُتْلى عَلَيْهِمْ آياتُنا اسم ما لم يسمّ فاعله. قال أبو إسحاق بَيِّناتٍ نصب على الحال.',
    );
  });

  it("keeps the author's lines that start with a verse number", () => {
    expect(cleanBookHtml(stripEditorNotes(NAHHAS_P4_38).html)).toBe(
      [
        'أَنْذَرْتُكُمْ صاعِقَةً مِثْلَ صاعِقَةِ عادٍ وَثَمُودَ',
        '(١٣) فأمسكت على فيه، وناشدته الرحم أن يكفّ.',
        'وَأَمَّا ثَمُودُ فَهَدَيْناهُمْ رفعت ثمود بالابتداء ولم تصرفه على أنه اسم للقبيلة',
      ].join('\n'),
    );
    const plain = stripEditorNotes(NAHHAS_P5_185);
    expect(plain).toEqual({html: NAHHAS_P5_185, footnoteBlocks: 0, markers: 0});
    expect(cleanBookHtml(plain.html)).toContain(
      '\n(٣) وإن شئت كسرت اللام على الأصل.\n[سورة قريش (١٠٦) : آية ٤]\n',
    );
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
    expect(cleanBookHtml(UKBARI_P1_5)).toBe(
      [
        'سُورَةُ الْفَاتِحَةِ',
        'بِسم الله الرَّحْمَن الرَّحِيم',
        'قَالَ تَعَالَى: (الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ (٢) الرَّحْمَنِ الرَّحِيمِ (٣))',
      ].join('\n'),
    );
    expect(cleanBookHtml('سطر\r\nسطر آخر\rثالث<p>رابع')).toBe(
      'سطر\nسطر آخر\nثالث\nرابع',
    );
  });

  it('fails on any other control character', () => {
    expect(() => cleanBookHtml('نص\u0007نص')).toThrow(/control character/);
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
