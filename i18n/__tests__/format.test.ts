// @ai-generated
jest.mock('../language', () => ({currentLanguage: 'en'}));

import {
  decimalSeparator,
  localizeDigits,
  formatNumber,
  getSurahDisplayName,
  getSurahMeaning,
  getReciterDisplayName,
  getTrackDisplayTitle,
} from '../format';

const fatiha = {
  name: 'Al-Fatihah',
  name_arabic: 'الفاتحة',
  translated_name_english: 'The Opener',
};

describe('localizeDigits', () => {
  it('leaves English untouched', () => {
    expect(localizeDigits('Surah 114, 2:255', 'en')).toBe('Surah 114, 2:255');
  });

  it('converts ASCII digits to Arabic-Indic digits in Arabic', () => {
    expect(localizeDigits('2:255', 'ar')).toBe('٢:٢٥٥');
    expect(localizeDigits(1090, 'ar')).toBe('١٠٩٠');
  });
});

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(6236, 'en')).toBe('6,236');
    expect(formatNumber(6236, 'ar')).toBe('٦٬٢٣٦');
    expect(formatNumber(999, 'ar')).toBe('٩٩٩');
  });
});

describe('surah and reciter names', () => {
  it('picks the Arabic surah name in Arabic', () => {
    expect(getSurahDisplayName(fatiha, 'ar')).toBe('الفاتحة');
    expect(getSurahDisplayName(fatiha, 'en')).toBe('Al-Fatihah');
  });

  it('hides the English meaning in Arabic', () => {
    expect(getSurahMeaning(fatiha, 'ar')).toBeNull();
    expect(getSurahMeaning(fatiha, 'en')).toBe('The Opener');
  });

  it('resolves Arabic track titles from surahId but keeps upload titles', () => {
    const track = {title: 'Al-Fatihah', surahId: '1'};
    expect(getTrackDisplayTitle(track, 'ar')).toBe('الفاتحة');
    expect(getTrackDisplayTitle(track, 'en')).toBe('Al-Fatihah');
    expect(
      getTrackDisplayTitle(
        {...track, title: 'My Fatiha', isUserUpload: true},
        'ar',
      ),
    ).toBe('My Fatiha');
  });

  it('uses the bundled Arabic reciter name', () => {
    expect(
      getReciterDisplayName(
        {id: 'b3bca7d8-b004-4511-b46e-f3527f6b1f67', name: 'Mishary Alafasi'},
        'ar',
      ),
    ).toBe('مشاري العفاسي');
    expect(getReciterDisplayName({name: 'Mishary Alafasi'}, 'en')).toBe(
      'Mishary Alafasi',
    );
  });

  it('falls back to the English reciter name without an Arabic one', () => {
    expect(getReciterDisplayName({name: 'Mishary'}, 'ar')).toBe('Mishary');
    expect(
      getReciterDisplayName({name: 'Mishary', name_arabic: 'مشاري'}, 'ar'),
    ).toBe('مشاري');
  });
});

describe('decimalSeparator', () => {
  it("matches the language's digits", () => {
    expect(decimalSeparator('en')).toBe('.');
    expect(decimalSeparator('ar')).toBe('٫');
  });
});
