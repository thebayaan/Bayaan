import {aliasesFor} from '../aliases';

describe('aliases', () => {
  it('returns surah aliases by number', () => {
    expect(aliasesFor('surah', 36)).toEqual(
      expect.arrayContaining(['yasin', 'yaseen', 'يس']),
    );
  });

  it('returns surah aliases for Al-Fatihah', () => {
    expect(aliasesFor('surah', 1)).toEqual(
      expect.arrayContaining(['fatiha', 'fateha', 'fatihah', 'الفاتحه']),
    );
  });

  it('returns empty array when no aliases are registered', () => {
    expect(aliasesFor('surah', 999)).toEqual([]);
  });

  it('returns rewayat aliases', () => {
    expect(aliasesFor('rewayat', 'hafs-an-assem')).toEqual(
      expect.arrayContaining(['hafs', 'حفص']),
    );
  });
});
