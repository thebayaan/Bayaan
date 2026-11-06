import adhkarData from '@/data/adhkar.json';
import {
  adhkarCardLabel,
  adhkarCopyText,
  adhkarTranslationCopyText,
  cleanAdhkarTranslation,
  parseAdhkarArabic,
  segmentAdhkarTranslation,
  type AdhkarSegment,
} from '../adhkarText';
import {getAdhkarQuranPassages} from '../adhkarQuran';

const rows: ReadonlyArray<{
  id: string;
  arabic: string;
  translation: string | null;
}> = adhkarData.adhkar;

function row(id: string): {id: string; arabic: string} {
  const found = rows.find(r => r.id === id);
  if (!found) throw new Error(`row ${id} missing`);
  return found;
}

function arabicLetters(text: string): string {
  return (text.match(/[ء-ي]/g) ?? []).join('');
}

function kinds(segments: AdhkarSegment[]): string[] {
  return segments.map(s => s.kind);
}

// The data and these literals may order combining marks differently.
function nfc(text: string): string {
  return text.normalize('NFC');
}

function pairs(segments: AdhkarSegment[]): string[][] {
  return segments.map(s => [s.kind, nfc(s.text)]);
}

describe('parseAdhkarArabic', () => {
  it('splits narration, dhikr and additions and drops the marks (row 20)', () => {
    const segments = parseAdhkarArabic(row('20').arabic);
    expect(kinds(segments)).toEqual([
      'narration',
      'dhikr',
      'addition',
      'addition',
      'dhikr',
    ]);
    expect(nfc(segments[0].text)).toBe(
      nfc('يَبْدَأُ بِرِجْلِهِ الْيُمْنَى، وَيَقُولُ:'),
    );
    expect(nfc(segments[2].text)).toBe(nfc('بِسْمِ اللَّهِ، وَالصَّلَاةُ'));
    expect(nfc(segments[4].text)).toBe(
      nfc('اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ'),
    );
  });

  it('treats a row without (( )) as dhikr throughout', () => {
    expect(parseAdhkarArabic('سُبْحَانَ اللَّهِ')).toEqual([
      {kind: 'dhikr', text: 'سُبْحَانَ اللَّهِ', quranIndex: null},
    ]);
  });

  it('keeps a parenthesis that sits next to the closing mark', () => {
    // Row 138 before v9 moved its count note outside the marks.
    const segments = parseAdhkarArabic(
      '((أَعُوذُ بِاللَّهِ، وَاتْفُلْ عَلَى يَسَارِكَ (ثلاثاً))).',
    );
    expect(segments).toHaveLength(1);
    expect(segments[0].text.endsWith('(ثلاثاً)')).toBe(true);
  });

  it('turns an open dhikr that introduces speech into narration (row 134)', () => {
    const segments = parseAdhkarArabic(row('134').arabic);
    expect(pairs(segments)).toEqual([
      ['narration', nfc('يَقُولُ:')],
      ['dhikr', nfc('آمَنْتُ بِاللَّهِ وَرُسُلِهِ')],
    ]);
  });

  it('drops a single parenthesis split from its partner (row 10)', () => {
    const segments = parseAdhkarArabic(row('10').arabic);
    expect(pairs(segments)).toEqual([
      ['addition', nfc('بِسْمِ اللَّهِ')],
      [
        'dhikr',
        nfc('اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبْثِ وَالْخَبائِث.'),
      ],
    ]);
  });

  it('emits Quran ranges as their own segments without ﴿ ﴾', () => {
    const {arabic} = row('75');
    const passages = getAdhkarQuranPassages('75', arabic);
    expect(passages).not.toBeNull();
    const segments = parseAdhkarArabic(arabic, passages?.ranges);
    expect(segments.map(s => [s.kind, s.quranIndex])).toEqual([
      ['dhikr', null],
      ['dhikr', 0],
    ]);
    expect(nfc(segments[0].text)).toBe(
      nfc('أَعُوذُ بِاللَّهِ مِنَ الشَّيطَانِ الرَّجِيمِ'),
    );
    expect(segments[1].text).not.toMatch(/[﴿﴾]/);
  });

  it('parses every row cleanly', () => {
    for (const {id, arabic} of rows) {
      const passages = getAdhkarQuranPassages(id, arabic);
      for (const ranges of [undefined, passages?.ranges]) {
        const segments = parseAdhkarArabic(arabic, ranges);
        expect({id, count: segments.length > 0}).toEqual({id, count: true});
        for (const segment of segments) {
          expect({id, text: segment.text}).toEqual({
            id,
            text: expect.not.stringMatching(/\(\(|\)\)|\[|\]/),
          });
          expect(segment.text.trim()).toBe(segment.text);
          expect(segment.text).not.toMatch(/^[،,.:;؛]/);
          expect(segment.text.length).toBeGreaterThan(0);
          if (segment.kind === 'narration') {
            expect({id, text: segment.text}).toEqual({
              id,
              text: expect.not.stringMatching(/[()]/),
            });
          }
        }
        expect({
          id,
          letters: arabicLetters(segments.map(s => s.text).join(' ')),
        }).toEqual({id, letters: arabicLetters(arabic)});
      }
    }
  });
});

describe('outer parentheses and unpaired brackets', () => {
  it('drops one pair that wraps a whole row without (( )) (rows 1, 3)', () => {
    for (const id of ['1', '3']) {
      const segments = parseAdhkarArabic(row(id).arabic);
      expect(segments).toHaveLength(1);
      expect(segments[0].kind).toBe('dhikr');
      expect(segments[0].text).not.toMatch(/^[(.]|\)$|\s\)/);
    }
  });

  it('keeps inner parentheses of a wrapped row', () => {
    expect(parseAdhkarArabic('(أَ (بَ) جَ).')).toEqual([
      {kind: 'dhikr', text: 'أَ (بَ) جَ.', quranIndex: null},
    ]);
  });

  it('shows the garment word of row 5 as an addition', () => {
    const segments = parseAdhkarArabic(row('5').arabic);
    expect(kinds(segments)).toEqual(['dhikr', 'addition', 'dhikr']);
    expect(nfc(segments[1].text)).toBe(nfc('الثَّوْبَ'));
    expect(segments.some(s => /[()]/.test(s.text))).toBe(false);
  });

  it('keeps parentheses that do not wrap the whole row', () => {
    expect(parseAdhkarArabic('(أ) ب')[0].text).toBe('(أ) ب');
  });

  it('drops a ﴿ the data never closes from copy text (row 50 before v7)', () => {
    const text = adhkarCopyText(
      '((سَجَدَ وَجْهِيَ لِلَّذِي خَلَقَهُ، ﴿فَتَبارَكَ اللَّهُ أَحْسَنُ الْخَالِقِينَ)).',
    );
    expect(text).not.toMatch(/[﴿﴾]/);
  });

  it('leaves every row with balanced parentheses and ornate brackets', () => {
    function balanced(text: string, open: string, close: string): boolean {
      let depth = 0;
      for (const char of text) {
        if (char === open) depth += 1;
        if (char === close) depth -= 1;
        if (depth < 0) return false;
      }
      return depth === 0;
    }
    for (const {id, arabic} of rows) {
      for (const segment of parseAdhkarArabic(arabic)) {
        expect({id, ok: balanced(segment.text, '(', ')')}).toEqual({
          id,
          ok: true,
        });
        expect({id, ok: balanced(segment.text, '﴿', '﴾')}).toEqual({
          id,
          ok: true,
        });
      }
    }
  });
});

describe('adhkarCopyText', () => {
  it('gives the dhikr with additions and no marks or narration', () => {
    expect(nfc(adhkarCopyText(row('20').arabic))).toBe(
      nfc(
        'أَعُوذُ بِاللَّهِ العَظِيمِ، وَبِوَجْهِهِ الْكَرِيمِ، وَسُلْطَانِهِ الْقَدِيمِ، مِنَ الشَّيْطَانِ الرَّجِيمِ' +
          ' بِسْمِ اللَّهِ، وَالصَّلَاةُ وَالسَّلَامُ عَلَى رَسُولِ اللَّهِ' +
          ' اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
      ),
    );
  });

  it('keeps the narration when it is most of the text (row 195)', () => {
    const text = nfc(adhkarCopyText(row('195').arabic));
    expect(text.startsWith(nfc('عَنِ ابْنِ عُمَرَ'))).toBe(true);
    expect(text.endsWith(nfc('إِنَّكَ أَنْتَ التَّوَّابُ الغَفُورُ'))).toBe(
      true,
    );
    expect(text).not.toMatch(/\(\(|\)\)/);
  });

  it('drops the ( ) of instructions and counts in narration (rows 21, 114, 236)', () => {
    const [first] = parseAdhkarArabic(row('21').arabic);
    expect(nfc(first.text)).toBe(
      nfc('يَبْدَأُ بِرِجْلِهِ الْيُسْرَى وَيَقُولُ:'),
    );
    const counts = parseAdhkarArabic(row('114').arabic).filter(
      s => s.kind === 'narration',
    );
    expect(counts.map(s => nfc(s.text))).toEqual([
      nfc('ثلاثاً -'),
      nfc('ثَلاَثَ مَرَّاتٍ -'),
    ]);
    const text = nfc(adhkarCopyText(row('236').arabic));
    expect(text).not.toMatch(/[()]/);
    expect(
      text.endsWith(
        nfc('فَفَعَلَ عَلَى الْمَرْوَةِ كَمَا فَعَلَ عَلَى الصَّفَا.'),
      ),
    ).toBe(true);
  });

  it('keeps the takbir and the travel verse in the copy (row 207)', () => {
    const text = nfc(adhkarCopyText(row('207').arabic));
    expect(text.startsWith(nfc('اللَّهُ أَكْبَرُ'))).toBe(true);
    expect(text).toContain(nfc('سُبْحَانَ الَّذِي سَخَّرَ لَنَا'));
    expect(text).toContain(nfc('آيِبُونَ'));
  });

  it('does not copy the after-prayer note of Ayat al-Kursi (row 71)', () => {
    const text = nfc(adhkarCopyText(row('71').arabic));
    expect(text).toContain(nfc('الْعَلِيُّ الْعَظِيمُ'));
    expect(text).not.toContain(nfc('عَقِبَ'));
  });

  it('treats the Safa verse as recited, inside the marks (row 236)', () => {
    const text = nfc(adhkarCopyText(row('236').arabic));
    expect(text).toContain(
      nfc('إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَآئِرِ اللَّهِ'),
    );
    const segments = parseAdhkarArabic(row('236').arabic);
    const verse = segments.find(s =>
      nfc(s.text).includes(nfc('إِنَّ الصَّفَا')),
    );
    expect(verse?.kind).not.toBe('narration');
  });

  it('returns a row without marks unchanged apart from whitespace', () => {
    expect(adhkarCopyText('  سُبْحَانَ   اللَّهِ ')).toBe('سُبْحَانَ اللَّهِ');
  });

  it('never leaves marks in any row', () => {
    for (const {arabic} of rows) {
      expect(adhkarCopyText(arabic)).not.toMatch(/\(\(|\)\)|\[|\]/);
    }
  });
});

describe('cleanAdhkarTranslation', () => {
  it('collapses a self-contained ((x)) to (x)', () => {
    expect(cleanAdhkarTranslation('omnipotent.)((one hundred times))')).toBe(
      'omnipotent.)(one hundred times)',
    );
  });

  it('leaves "))" that closes two nested parentheses alone', () => {
    const text = '(How perfect my Lord is.(three times))';
    expect(cleanAdhkarTranslation(text)).toBe(text);
  });

  it('never unbalances parentheses in any translation', () => {
    function balance(text: string): number {
      return (
        (text.match(/\(/g) ?? []).length - (text.match(/\)/g) ?? []).length
      );
    }
    for (const {translation} of rows) {
      if (!translation) continue;
      expect(balance(cleanAdhkarTranslation(translation))).toBe(
        balance(translation),
      );
    }
  });
});

describe('adhkarCardLabel', () => {
  it('speaks the clean Arabic dhikr then the translation', () => {
    const arabic =
      'قَالَ النَّبِيُّ (( سُبْحَانَ اللَّهِ وَبِحَمْدِهِ )) كَثِيرًا جِدًّا فِي الْيَوْمِ';
    const label = adhkarCardLabel(arabic, 'Glory be to Allah ((and praise))');
    expect(label).toContain(adhkarCopyText(arabic));
    expect(label).not.toMatch(/\(\(|\)\)/);
    expect(label).toContain('سُبْحَانَ اللَّهِ وَبِحَمْدِهِ');
    expect(label.endsWith('Glory be to Allah (and praise)')).toBe(true);
  });

  it('drops the ornate brackets and * separators from the spoken label', () => {
    const label = adhkarCardLabel(row('4').arabic, null);
    expect(label).not.toMatch(/[\uFD3E\uFD3F*]/);
    expect(label).not.toMatch(/\s{2,}/);
    const withVerse = adhkarCardLabel(row('70').arabic, 'Say');
    expect(withVerse).not.toMatch(/[\uFD3E\uFD3F*]/);
  });

  it('is only the Arabic without a translation', () => {
    expect(adhkarCardLabel('(( سُبْحَانَ اللَّهِ ))', null)).toBe(
      adhkarCopyText('(( سُبْحَانَ اللَّهِ ))'),
    );
  });
});

// Translator glosses inside a sentence keep their parentheses: they mark
// words that are not in the Arabic. Every other parenthesis is rendered.
const KEPT_GLOSSES: ReadonlyArray<readonly [string, string]> = [
  ['evening-90', '(in worshipping Allāh)'],
  ['99', '(A form of spitting comprising mainly of air with little spittle)'],
  ['99', '(Al-Ikhlas, Al-Falaq, An-Nas)'],
  ['107', '(i.e. You have total mastery over)'],
  ['110', '(chapter 32)'],
  ['110', '(chapter 67)'],
  ['11', '(Allah)'],
  ['22', '(one who calls to prayer)'],
  ['22', '(or)'],
  ['6', '(i.e. the garment)'],
  ['7', '(with another)'],
  ['29', '(others with Allah)'],
  ['30', '(great angels)'],
  ['35', '(He is)'],
  ['35', '(i.e. Jibra-eel)'],
  ['40', '(of You)'],
  ['43', '(He is)'],
  ['43', '(i.e. Jibra-eel)'],
  ['51', '(prostration)'],
  ['53', '(al)'],
  ['74', '(two rakAAah nafilah)'],
  ['119', '(i.e. Jibra-eel)'],
  ['120', '(i.e. You have total mastery over)'],
  ['128', '(He is)'],
  ['138', '(A form of spitting comprising mainly of air with little spittle)'],
  ['140', '(i.e. two rakAAas)'],
  ['145', '(the new parent)'],
  ['147', '(the sickness)'],
  ['148', '(the sick person)'],
  ['155', '(vicegerent, as is commonly translated)'],
  ['155', '(also refer to supplication #198)'],
  ['160', '(of good)'],
  ['160', '(i.e. passed away)'],
  ['160', '(by death)'],
  ['162', '(faltasbir waltahtasib)'],
  ['168', '(The One)'],
  ['174', '(let it fall)'],
  ['178', '(when you remember)'],
  ['185', '(the invitation)'],
  ['185', '(in order to bless the inmates of the house)'],
  ['188', '(i.e. the one who sneezed)'],
  ['190', '(your spouse)'],
  ['195', '(to accept my repentance)'],
  ['206', '(transport)'],
  ['207', '(transport)'],
  ['207', '(vicegerent, as is commonly translated)'],
  ['214', '(Allah is the Most Great)'],
  ['214', '(Glory is to Allah)'],
  ['222', '(nation)'],
  ['225', '(charitably)'],
  ['226', '(the poor)'],
  ['231', '(i.e. my praising)'],
  ['233', '(in response to Your call)'],
  ['236', '(one should make a personal supplication)'],
  ['237', '(is)'],
  ['238', '(Al-Mash aril Haraam)'],
  ['238', '(Allah is the Most Great)'],
  ['238', '(Allah is One)'],
  ['238', '(There is none worthy of worship but Allah)'],
  ['239', '(Allah is the Most Great)'],
  ['239', '(stoning)'],
  ['239', '(for supplications)'],
  ['246', '(it is)'],
  ['256', '(There are)'],
  ['256', '(which are)'],
  ['267', '(i.e. the first hour)'],
  ['267', '(you may)'],
  ['267', '(the children)'],
];

function visibleParens(translation: string): string[] {
  return segmentAdhkarTranslation(translation).flatMap(
    segment => segment.text.match(/\([^()]*\)|[()]/g) ?? [],
  );
}

function translationOf(id: string): string {
  const found = rows.find(r => r.id === id)?.translation;
  if (!found) throw new Error(`row ${id} has no translation`);
  return found;
}

function tpairs(translation: string): string[][] {
  return segmentAdhkarTranslation(translation).map(s => [s.kind, s.text]);
}

describe('segmentAdhkarTranslation', () => {
  it('drops a whole-row wrapper (row 91 after the count)', () => {
    expect(tpairs(translationOf('91'))).toEqual([
      ['dhikr', 'How perfect Allah is and I praise Him.'],
      ['narration', 'one hundred times'],
    ]);
  });

  it('splits counts inside the wrapper into narration (row 106)', () => {
    expect(tpairs(translationOf('106'))).toEqual([
      ['dhikr', 'How Perfect Allah is.'],
      ['narration', 'thirty-three times'],
      ['dhikr', 'All praise is for Allah.'],
      ['narration', 'thirty-three times'],
      ['dhikr', 'Allah is the greatest.'],
      ['narration', 'thirty-four times'],
    ]);
  });

  it('keeps a later dhikr as dhikr and a definition as narration (rows 82, 90)', () => {
    expect(
      segmentAdhkarTranslation(translationOf('82')).map(s => s.kind),
    ).toEqual(['dhikr', 'narration', 'dhikr', 'narration']);
    expect(tpairs(translationOf('90'))[1]).toEqual([
      'narration',
      'fitrah: the religion of Islam, the way of Ibraheem u.',
    ]);
  });

  it('mutes the narration around quoted words (rows 146, 254)', () => {
    expect(
      segmentAdhkarTranslation(translationOf('146')).map(s => s.kind),
    ).toEqual(['narration', 'dhikr']);
    expect(tpairs(translationOf('254'))).toEqual([
      ['narration', 'Whoever says:'],
      ['dhikr', 'How perfect Allah is and I praise Him.'],
      [
        'narration',
        'a hundred times during the day, his sins are wiped away, even if they are like the foam of the sea.',
      ],
    ]);
  });

  it('turns ayah numbers and surah labels into references (rows 4, 76)', () => {
    const verses = segmentAdhkarTranslation(translationOf('4'));
    expect(verses[0]).toEqual({kind: 'reference', text: '190'});
    expect(verses[1].kind).toBe('dhikr');
    const surahs = segmentAdhkarTranslation(translationOf('76'));
    expect(surahs[0]).toEqual({
      kind: 'reference',
      text: 'Soorah al-Ikhlaas 112',
    });
    expect(surahs.filter(s => s.kind === 'narration')).toEqual([]);
  });

  it('keeps the honorific words without their parentheses (rows 24, evening-90)', () => {
    expect(translationOf('evening-90')).toContain('(ﷺ)');
    expect(visibleParens(translationOf('evening-90'))).toEqual([
      '(in worshipping Allāh)',
    ]);
    expect(segmentAdhkarTranslation(translationOf('24'))[0].text).toContain(
      "Prophet sal-Allaahu 'alayhe wa sallam after",
    );
  });

  it('keeps short glosses inside a sentence (rows 11, 22)', () => {
    expect(tpairs(translationOf('11'))).toEqual([
      ['dhikr', 'I ask You (Allah) for forgiveness.'],
    ]);
    expect(visibleParens(translationOf('22'))).toEqual([
      '(one who calls to prayer)',
      '(or)',
    ]);
  });

  it('shows no parenthesis outside the kept glosses in any row', () => {
    const shown: (readonly [string, string])[] = [];
    for (const {id, translation} of rows) {
      if (!translation) continue;
      for (const paren of visibleParens(translation)) shown.push([id, paren]);
    }
    expect(shown).toEqual(KEPT_GLOSSES);
  });
});

describe('adhkarTranslationCopyText', () => {
  it('copies the dhikr without the count note or wrapper', () => {
    expect(adhkarTranslationCopyText(translationOf('91'))).toBe(
      'How perfect Allah is and I praise Him.',
    );
  });

  it('keeps the narration when it is most of the text (row 254)', () => {
    expect(adhkarTranslationCopyText(translationOf('254'))).toBe(
      'Whoever says: How perfect Allah is and I praise Him. a hundred times during the day, his sins are wiped away, even if they are like the foam of the sea.',
    );
  });

  it('leaves out ayah numbers', () => {
    expect(adhkarTranslationCopyText(translationOf('4'))).not.toMatch(
      /\b19\d\b/,
    );
  });
});
