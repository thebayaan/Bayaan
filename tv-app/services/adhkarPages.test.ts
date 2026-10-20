import {segmentAdhkarTranslation} from '../../utils/adhkarText';
import {ADHKAR_LISTS, adhkarForList} from './adhkarData';
import {
  ARABIC_PAGE_LETTERS,
  arabicFontSize,
  chooseBreaks,
  dhikrPages,
  instructionNote,
  notesFontSize,
  pageAtProgress,
  pageCount,
  plainQuranBrackets,
  runText,
  sourceLine,
  splitEvenly,
  surahHeading,
  toRuns,
  wrappedInParens,
} from './adhkarPages';

describe('adhkar pages', () => {
  it('keeps a short dhikr on one page with its tones', () => {
    const pages = dhikrPages(
      'كَانَ يَقُولُ: ((سُبْحَانَ اللَّهِ وَبِحَمْدِهِ))',
      'He would say: (Glory is to Allah and praise is to Him.)',
    );
    expect(pages).toHaveLength(1);
    expect(pages[0].arabic.map(r => r.tone)).toEqual(['narration', 'dhikr']);
    expect(pages[0].arabic[1].text).toBe('سُبْحَانَ اللَّهِ وَبِحَمْدِهِ');
    expect(pages[0].translation.some(r => r.tone === 'dhikr')).toBe(true);
  });

  it('splits long rows into pages that keep every word in order', () => {
    for (const dhikr of adhkarForList('morning-adhkar')) {
      const pages = dhikrPages(dhikr.arabic, dhikr.translation);
      const words = pages
        .flatMap(p => p.arabic.map(r => r.text))
        .join(' ')
        .split(' ');
      expect(words.length).toBeGreaterThan(0);
      for (const page of pages) {
        expect(page.arabicLength).toBeLessThanOrEqual(
          ARABIC_PAGE_LETTERS * 1.3,
        );
      }
    }
  });

  it('turns the page between quoted surahs, never inside one', () => {
    const [first] = adhkarForList('before-sleep');
    const pages = dhikrPages(first.arabic, first.translation);
    expect(pages.length).toBeGreaterThan(1);
    const end = pages[0].arabic[pages[0].arabic.length - 1].text;
    expect(end).toMatch(/﴾\.?$/);
    // The translation turns outside its parenthesis, with the Arabic.
    const enEnd = pages[0].translation[pages[0].translation.length - 1].text;
    const opens = (enEnd.match(/\(/g) ?? []).length;
    expect((enEnd.match(/\)/g) ?? []).length).toBe(opens);
  });

  it('prefers a sentence end near the even split', () => {
    const tokens = Array.from({length: 8}, () => ({weight: 5, brk: 0}));
    expect(chooseBreaks(tokens, [20], 20, 0.3, 1)).toEqual([4]);
    // A sentence ends one word later: the page turns there instead.
    tokens[4].brk = 2;
    expect(chooseBreaks(tokens, [20], 20, 0.3, 1)).toEqual([5]);
    // Further than the window allows, the even split wins.
    expect(chooseBreaks(tokens, [20], 20, 0.2, 1)).toEqual([4]);
    // Never inside a parenthesis when a way round is near.
    tokens[4].brk = 0;
    tokens[3].brk = -1;
    expect(chooseBreaks(tokens, [20], 20, 0.3, 1)).not.toEqual([4]);
  });

  it('draws the ornate brackets plainly when asked', () => {
    expect(plainQuranBrackets('﴿قُلْ﴾')).toBe('(قُلْ)');
    const [first] = adhkarForList('before-sleep');
    const text = dhikrPages(first.arabic, first.translation, {
      plainBrackets: true,
    })
      .flatMap(p => p.arabic.map(r => r.text))
      .join(' ');
    expect(text).not.toMatch(/[﴾﴿]/);
  });

  it('splits by weight without leaving a page empty', () => {
    const tokens = [3, 3, 3, 3].map(weight => ({weight}));
    expect(splitEvenly(tokens, 2).map(c => c.length)).toEqual([2, 2]);
    expect(splitEvenly([{weight: 1}], 1)).toHaveLength(1);
  });

  it('joins words of one tone into runs', () => {
    expect(
      toRuns([
        {tone: 'dhikr', text: 'a', weight: 1},
        {tone: 'dhikr', text: 'b', weight: 1},
        {tone: 'narration', text: 'c', weight: 1},
      ]),
    ).toEqual([
      {tone: 'dhikr', text: 'a b'},
      {tone: 'narration', text: 'c'},
    ]);
  });

  it('sizes type down for longer pages', () => {
    expect(arabicFontSize(20)).toBeGreaterThan(arabicFontSize(100));
    expect(arabicFontSize(100)).toBeGreaterThan(arabicFontSize(400));
  });

  it('writes the source line', () => {
    expect(sourceLine(100, 'Muslim')).toBe('Recite 100 times · Muslim');
    expect(sourceLine(1, 'Meaning\nQuran: 1:3')).toBe('Meaning · Quran: 1:3');
    expect(sourceLine(1, '')).toBe('');
  });

  it('writes the source line without the data markup', () => {
    expect(
      sourceLine(
        3,
        'Then recite [Soorah al-Ikhlaas (112)], [Soorah al-Falaq (113)] and [Soorah an-Naas (114)]',
      ),
    ).toBe(
      'Recite Surah al-Ikhlaas (112), Surah al-Falaq (113) and Surah an-Naas (114) · 3 times',
    );
    expect(sourceLine(1, 'Recite Ayat-Al-Kursiy (Al-Baqarah :255)')).toBe(
      'Recite Ayat-Al-Kursiy (Al-Baqarah 255)',
    );
    // A line that gives the count stands for it.
    expect(sourceLine(10, 'ten times or once if lazy')).toBe(
      'Ten times or once if lazy',
    );
    expect(sourceLine(7, '7times')).toBe('7 times');
  });

  it('keeps a long explanation out of the source line, as notes', () => {
    const [name] = adhkarForList('names-of-allah').filter(
      d => d.instruction.length > 500,
    );
    expect(sourceLine(1, name.instruction)).toMatch(/^Quran: /);
    const note = instructionNote(name.instruction);
    expect(note.length).toBeGreaterThan(400);
    const pages = dhikrPages(name.arabic, name.translation, {note});
    expect(pages).toHaveLength(1);
    expect(pages[0].notes).toBe(note);
    expect(instructionNote('Quran: 59:23')).toBe('');
  });

  it('pages every list on its Arabic, with the notes kept off the reading pages', () => {
    for (const list of ADHKAR_LISTS) {
      for (const dhikr of adhkarForList(list.id)) {
        const pages = dhikrPages(dhikr.arabic, dhikr.translation, {
          note: instructionNote(dhikr.instruction),
        });
        const reading = pages.filter(p => p.arabic.length > 0);
        const letters = reading.reduce((n, p) => n + p.arabicLength, 0);
        const where = `${list.id} ${dhikr.id}`;
        // A dhikr whose Arabic fits one page is never split.
        if (letters <= ARABIC_PAGE_LETTERS) {
          expect([where, reading.length]).toEqual([where, 1]);
        }
        for (const page of reading) {
          // No page of a long dhikr holds only a word or two.
          if (reading.length > 1) {
            expect([where, page.arabicLength >= 20]).toEqual([where, true]);
          }
          // The words to say never sit over notes alone.
          const english = page.translation.filter(r => r.tone !== 'heading');
          const notesOnly =
            english.length > 0 && english.every(r => r.tone === 'narration');
          const allNarration = segmentAdhkarTranslation(
            dhikr.translation,
          ).every(s => s.kind === 'narration');
          if (!allNarration) {
            expect([where, notesOnly]).toEqual([where, false]);
          }
        }
        // Only the last page can be notes alone.
        pages
          .slice(0, -1)
          .forEach(p => expect(p.arabic.length).toBeGreaterThan(0));
      }
    }
  });

  it('pages on the Arabic, adding pages only for a long dhikr', () => {
    expect(pageCount(200, 2000)).toBe(1);
    expect(pageCount(300, 400)).toBe(2);
    expect(pageCount(320, 1900)).toBe(3);
    // Never so many that a page has only a few letters.
    expect(pageCount(270, 5000)).toBe(4);
  });

  it('shows a quoted surah heading on its own line, without verse markers', () => {
    const [, quls] = adhkarForList('morning-adhkar');
    const pages = dhikrPages(quls.arabic, quls.translation);
    const runs = pages[0].translation;
    expect(runs[0]).toEqual({tone: 'heading', text: 'Surah al-Ikhlaas (112)'});
    expect(runText(runs, 1)).toBe('\n1');
    const arabic = pages.flatMap(p => p.arabic.map(r => r.text)).join(' ');
    expect(arabic).not.toMatch(/[*()]/);
    expect(surahHeading('Soorah al-Baqarah, Aayah 255')).toBe(
      'Surah al-Baqarah, Ayah 255',
    );
  });

  it('puts long notes on a page of their own after the dhikr', () => {
    const sleep = adhkarForList('before-sleep').find(d =>
      d.translation.includes('Furqan:'),
    );
    expect(sleep).toBeDefined();
    if (!sleep) return;
    const pages = dhikrPages(sleep.arabic, sleep.translation);
    expect(pages).toHaveLength(2);
    expect(pages[0].translation.map(r => r.text).join(' ')).toMatch(
      /spare us from poverty/,
    );
    expect(pages[1].arabic).toEqual([]);
    expect(pages[1].notes).toMatch(/^Tawrah:/);
    expect(notesFontSize(pages[1].notes.length, true)).toBeGreaterThanOrEqual(
      notesFontSize(pages[1].notes.length, false),
    );
  });

  it('follows a recitation through the reading pages by their Arabic', () => {
    const page = (arabicLength: number) => ({
      arabic: arabicLength ? [{tone: 'dhikr' as const, text: 'x'}] : [],
      translation: [],
      notes: arabicLength ? '' : 'notes',
      arabicLength,
    });
    const pages = [page(100), page(300), page(0)];
    expect(pageAtProgress(pages, 0)).toBe(0);
    expect(pageAtProgress(pages, 0.2)).toBe(0);
    expect(pageAtProgress(pages, 0.3)).toBe(1);
    // The notes page is never reached by the recitation.
    expect(pageAtProgress(pages, 1)).toBe(1);
  });
});

describe('a narration wrapped in parentheses', () => {
  it('is recognised only when one pair wraps it all', () => {
    expect(wrappedInParens('(He would do this three times.)')).toBe(true);
    expect(wrappedInParens('(a) and (b)')).toBe(false);
    expect(wrappedInParens('Say (this).')).toBe(false);
  });

  it('turns its pages at a sentence, not mid-sentence', () => {
    const english =
      '(When retiring to his bed every night, the Prophet would hold his palms together. ' +
      'He would recite the last three chapters (Al-Ikhlas, Al-Falaq, An-Nas) of the Quran. ' +
      'Then he would wipe over his entire body as much as possible with his hands, beginning with his head and face. ' +
      'He would do this three times.)';
    const arabic = Array.from({length: 120}, () => 'كَلِمَةٌ').join(' ');
    const pages = dhikrPages(arabic, english);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages.slice(0, -1)) {
      const text = page.translation
        .map(r => r.text)
        .join(' ')
        .trim();
      if (text) expect(text).toMatch(/[.,]$/);
    }
  });
});
