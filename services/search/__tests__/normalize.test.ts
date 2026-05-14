import {normalize, tokenize} from '../normalize';

describe('normalize', () => {
  it('lowercases Latin', () => {
    expect(normalize('Yasin')).toBe('yasin');
  });

  it('strips Latin diacritics', () => {
    expect(normalize('Yāsīn')).toBe('yasin');
  });

  it('strips Arabic tashkeel', () => {
    expect(normalize('يَاسِين')).toBe('ياسين');
  });

  it('folds alef variants to ا', () => {
    expect(normalize('أحمد')).toBe('احمد');
    expect(normalize('إبراهيم')).toBe('ابراهيم');
    expect(normalize('آدم')).toBe('ادم');
  });

  it('folds ى to ي and ة to ه', () => {
    expect(normalize('مصطفى')).toBe('مصطفي');
    expect(normalize('فاطمة')).toBe('فاطمه');
  });

  it('collapses whitespace and trims', () => {
    expect(normalize('  Al   Fatihah ')).toBe('al fatihah');
  });
});

describe('tokenize', () => {
  it('splits on whitespace and punctuation', () => {
    expect(tokenize('Ya-Sin Surah')).toEqual(['ya', 'sin', 'surah']);
  });

  it('handles Arabic and Latin together', () => {
    expect(tokenize('Surah يس')).toEqual(['surah', 'يس']);
  });

  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});
