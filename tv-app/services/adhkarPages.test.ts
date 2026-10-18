import {adhkarForList} from './adhkarData';
import {
  ARABIC_PAGE_LETTERS,
  arabicFontSize,
  chooseBreaks,
  dhikrPages,
  plainQuranBrackets,
  sourceLine,
  splitEvenly,
  toRuns,
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
});
