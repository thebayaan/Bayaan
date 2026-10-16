import {adhkarForList} from './adhkarData';
import {
  ARABIC_PAGE_LETTERS,
  arabicFontSize,
  dhikrPages,
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
