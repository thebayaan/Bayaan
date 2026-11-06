// @ai-generated
jest.mock('../language', () => ({currentLanguage: 'en'}));

import {
  compareLanguageGroups,
  getEnglishLanguageDisplayName,
  isPreferredLanguage,
} from '../languageNames';

describe('getEnglishLanguageDisplayName', () => {
  it('names an English language name or a code in the UI language', () => {
    expect(getEnglishLanguageDisplayName('Urdu', 'en')).toBe('Urdu');
    expect(getEnglishLanguageDisplayName('Urdu', 'ar')).toBe('الأردية');
    expect(getEnglishLanguageDisplayName('english', 'ar')).toBe('الإنجليزية');
    expect(getEnglishLanguageDisplayName('ar', 'en')).toBe('Arabic');
  });

  it('keeps unknown languages as given', () => {
    expect(getEnglishLanguageDisplayName('Klingon', 'ar')).toBe('Klingon');
  });
});

describe('isPreferredLanguage', () => {
  it("matches the UI language's code or English name", () => {
    expect(isPreferredLanguage('Arabic', 'ar')).toBe(true);
    expect(isPreferredLanguage('ar', 'ar')).toBe(true);
    expect(isPreferredLanguage('english', 'en')).toBe(true);
    expect(isPreferredLanguage('arabic', 'en')).toBe(false);
  });
});

describe('compareLanguageGroups', () => {
  it('puts the UI language first, then sorts by localized name', () => {
    const languages = ['Urdu', 'Arabic', 'French', 'English'];
    expect(
      [...languages].sort((a, b) => compareLanguageGroups(a, b, 'en')),
    ).toEqual(['English', 'Arabic', 'French', 'Urdu']);
    expect(
      [...languages].sort((a, b) => compareLanguageGroups(a, b, 'ar'))[0],
    ).toBe('Arabic');
  });
});
