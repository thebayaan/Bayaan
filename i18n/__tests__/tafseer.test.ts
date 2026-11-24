// @ai-generated
jest.mock('../language', () => ({currentLanguage: 'en'}));

import {
  getTafseerDisplayName,
  getTafseerLanguageDisplayName,
  isPreferredTafseerLanguage,
  shownActiveTafseerId,
} from '../tafseer';

const ibnKathir = {
  identifier: '169',
  name: 'ابن كثير',
  englishName: 'Ibn Kathir',
};
const unknownEdition = {
  identifier: 'unknown',
  name: 'تفسير مجهول',
  englishName: 'Unknown Tafsir',
};

describe('getTafseerDisplayName', () => {
  it('uses the localized catalogue title', () => {
    expect(getTafseerDisplayName(ibnKathir, 'en')).toBe(
      'Ibn Kathir (Abridged)',
    );
    expect(getTafseerDisplayName(ibnKathir, 'ar')).toBe(
      'تفسير ابن كثير (مختصر)',
    );
  });

  it("falls back to the edition's own name by bilingual content", () => {
    expect(getTafseerDisplayName(unknownEdition, 'en')).toBe('Unknown Tafsir');
    expect(getTafseerDisplayName(unknownEdition, 'ar')).toBe('تفسير مجهول');
  });
});

describe('getTafseerLanguageDisplayName', () => {
  it('names catalogue languages in the UI language', () => {
    expect(getTafseerLanguageDisplayName('Arabic', 'en')).toBe('Arabic');
    expect(getTafseerLanguageDisplayName('english', 'ar')).toBe('الإنجليزية');
  });

  it('keeps unknown languages as given', () => {
    expect(getTafseerLanguageDisplayName('Klingon', 'en')).toBe('Klingon');
  });
});

describe('isPreferredTafseerLanguage', () => {
  it("matches the UI language's code or English name", () => {
    expect(isPreferredTafseerLanguage('Arabic', 'ar')).toBe(true);
    expect(isPreferredTafseerLanguage('ar', 'ar')).toBe(true);
    expect(isPreferredTafseerLanguage('english', 'en')).toBe(true);
    expect(isPreferredTafseerLanguage('arabic', 'en')).toBe(false);
  });
});

describe('shownActiveTafseerId', () => {
  it('is the selection when it is downloaded', () => {
    expect(shownActiveTafseerId('94', new Set(['94', '169']))).toBe('94');
  });

  it('is null for a selection that is not downloaded, so it stays in its group', () => {
    expect(shownActiveTafseerId('94', new Set(['169']))).toBeNull();
  });

  it('is null with nothing selected', () => {
    expect(shownActiveTafseerId(null, new Set(['169']))).toBeNull();
  });
});
