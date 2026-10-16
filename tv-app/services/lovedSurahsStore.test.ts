import {
  clearLovedSurahs,
  getLovedSurahs,
  isLovedSurah,
  toggleLovedSurah,
} from './lovedSurahsStore';
import {writeJSON} from './storage';

describe('lovedSurahsStore', () => {
  beforeEach(() => clearLovedSurahs());

  it('starts empty', () => {
    expect(getLovedSurahs()).toEqual([]);
    expect(isLovedSurah(18)).toBe(false);
  });

  it('loves a surah with its recitation, newest first', () => {
    expect(toggleLovedSurah(18, 'r1', 'rw1')).toBe(true);
    expect(toggleLovedSurah(67, 'r2', 'rw2')).toBe(true);
    const loved = getLovedSurahs();
    expect(loved.map(e => e.surahNumber)).toEqual([67, 18]);
    expect(loved[1]).toMatchObject({reciterId: 'r1', rewayahId: 'rw1'});
    expect(isLovedSurah(18)).toBe(true);
  });

  it('un-loves a surah whatever reciter it was loved with', () => {
    toggleLovedSurah(18, 'r1', 'rw1');
    expect(toggleLovedSurah(18, 'r9', 'rw9')).toBe(false);
    expect(isLovedSurah(18)).toBe(false);
  });

  it('drops malformed saved entries', () => {
    writeJSON('bayaan_tv_loved_surahs', [
      {surahNumber: 0, reciterId: 'x', rewayahId: '', addedAt: 1},
      {surahNumber: 2, reciterId: 'x', rewayahId: '', addedAt: 1},
      null,
    ]);
    expect(getLovedSurahs().map(e => e.surahNumber)).toEqual([2]);
  });
});
