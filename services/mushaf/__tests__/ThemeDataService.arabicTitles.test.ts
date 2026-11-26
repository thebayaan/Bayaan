/**
 * Arabic theme titles (data/quran-themes.ar.json): one title for every
 * passage of data/quran-themes.json, keyed by the passage's first verse, and
 * attached to the verse theme info next to the English title.
 */
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {getOrderedVerseKeysForPage: () => []},
}));

interface Passage {
  theme: string;
  verseKeyFrom: string;
}

const english: {
  metadata: {totalThemes: number};
  themes: Passage[];
} = require('@/data/quran-themes.json');
const arabic: {
  metadata: {totalThemes: number};
  themes: Record<string, string>;
} = require('@/data/quran-themes.ar.json');

describe('data/quran-themes.ar.json', () => {
  it('has one title for every English passage, keyed by its first verse', () => {
    expect(Object.keys(arabic.themes)).toEqual(
      english.themes.map(passage => passage.verseKeyFrom),
    );
    expect(arabic.metadata.totalThemes).toBe(english.metadata.totalThemes);
  });

  it('writes every title in Arabic, with no Latin letters or Western digits', () => {
    const notArabic = Object.entries(arabic.themes).filter(
      ([, title]) =>
        title.trim() !== title ||
        !/[ء-ي]/.test(title) ||
        /[A-Za-z0-9]/.test(title),
    );
    expect(notArabic).toEqual([]);
  });
});

describe('themeDataService', () => {
  it('gives every verse of a passage its Arabic and English titles', () => {
    const {themeDataService} = require('../ThemeDataService');
    const passage = english.themes.find(p => p.verseKeyFrom === '18:60');
    expect(passage).toBeDefined();
    for (const verseKey of ['18:60', '18:65', '18:70']) {
      expect(themeDataService.getThemeForVerse(verseKey)).toMatchObject({
        theme: passage?.theme,
        themeAr: arabic.themes['18:60'],
        verseKeyFrom: '18:60',
      });
    }
  });

  it('leaves the Arabic title out of a passage the Arabic file has none for', () => {
    jest.isolateModules(() => {
      jest.doMock('@/data/quran-themes.ar.json', () => ({
        themes: {'1:1': 'دعاء'},
      }));
      const {themeDataService} = require('../ThemeDataService');
      expect(themeDataService.getThemeForVerse('1:7').themeAr).toBe('دعاء');
      const baqarah = themeDataService.getThemeForVerse('2:3');
      expect(baqarah.theme).toBe(english.themes[1].theme);
      expect(baqarah.themeAr).toBeUndefined();
    });
  });
});
