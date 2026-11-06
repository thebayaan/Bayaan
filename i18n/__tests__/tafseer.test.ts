// @ai-generated
jest.mock('../language', () => ({currentLanguage: 'en'}));

import {getTafseerDisplayName} from '../tafseer';

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
