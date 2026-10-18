import {
  clearLovedSurahs,
  getLovedSurahs,
  isLovedIn,
  isLovedSurah,
  migrateLovedSurahs,
  normalizeLoved,
  toggleLovedSurah,
} from './lovedSurahsStore';
import {readJSON, storage, writeJSON} from './storage';

describe('lovedSurahsStore', () => {
  beforeEach(() => clearLovedSurahs());

  it('starts empty', () => {
    expect(getLovedSurahs()).toEqual([]);
    expect(isLovedSurah(18, 'r1')).toBe(false);
  });

  it('loves a surah with its recitation, newest first', () => {
    expect(toggleLovedSurah(18, 'r1', 'rw1')).toBe(true);
    expect(toggleLovedSurah(67, 'r2', 'rw2')).toBe(true);
    const loved = getLovedSurahs();
    expect(loved.map(e => e.surahNumber)).toEqual([67, 18]);
    expect(loved[1]).toMatchObject({reciterId: 'r1', rewayahId: 'rw1'});
    expect(isLovedSurah(18, 'r1')).toBe(true);
  });

  it('keys loves by surah and reciter', () => {
    toggleLovedSurah(1, 'minshawi', 'rw1');
    // The same surah in another voice is not loved yet...
    expect(isLovedSurah(1, 'sudais')).toBe(false);
    // ...and loving it there keeps the first voice's love.
    expect(toggleLovedSurah(1, 'sudais', 'rw2')).toBe(true);
    expect(getLovedSurahs().map(e => e.reciterId)).toEqual([
      'sudais',
      'minshawi',
    ]);
    // Un-loving one voice leaves the other.
    expect(toggleLovedSurah(1, 'sudais', 'rw2')).toBe(false);
    expect(isLovedSurah(1, 'minshawi')).toBe(true);
    expect(isLovedSurah(1, 'sudais')).toBe(false);
  });

  it('un-loves a voice whatever rewayah it was loved in', () => {
    toggleLovedSurah(18, 'r1', 'rw1');
    expect(toggleLovedSurah(18, 'r1', 'rw9')).toBe(false);
    expect(getLovedSurahs()).toEqual([]);
  });

  it('isLovedIn checks a list it is given', () => {
    const list = [{surahNumber: 2, reciterId: 'a', rewayahId: '', addedAt: 1}];
    expect(isLovedIn(list, 2, 'a')).toBe(true);
    expect(isLovedIn(list, 2, 'b')).toBe(false);
    expect(isLovedIn(list, 3, 'a')).toBe(false);
  });

  it('drops malformed saved entries', () => {
    writeJSON('bayaan_tv_loved_surahs', [
      {surahNumber: 0, reciterId: 'x', rewayahId: '', addedAt: 1},
      {surahNumber: 2, reciterId: 'x', rewayahId: '', addedAt: 1},
      {surahNumber: 3, reciterId: '', rewayahId: '', addedAt: 1},
      null,
    ]);
    expect(getLovedSurahs().map(e => e.surahNumber)).toEqual([2]);
  });

  it('normalizes old entries: missing fields filled, one per voice', () => {
    expect(
      normalizeLoved([
        {surahNumber: 2, reciterId: 'x', addedAt: 5},
        {surahNumber: 2, reciterId: 'x', rewayahId: 'old', addedAt: 1},
        {surahNumber: 2, reciterId: 'y', rewayahId: 'r'},
      ]),
    ).toEqual([
      {surahNumber: 2, reciterId: 'x', rewayahId: '', addedAt: 5},
      {surahNumber: 2, reciterId: 'y', rewayahId: 'r', addedAt: 0},
    ]);
    expect(normalizeLoved('nope')).toEqual([]);
  });

  it('migrates saved data once', () => {
    storage.remove('bayaan_tv_loved_surahs_version');
    writeJSON('bayaan_tv_loved_surahs', [
      {surahNumber: 18, reciterId: 'r1'},
      {surahNumber: 999, reciterId: 'r1'},
    ]);
    migrateLovedSurahs();
    expect(readJSON('bayaan_tv_loved_surahs')).toEqual([
      {surahNumber: 18, reciterId: 'r1', rewayahId: '', addedAt: 0},
    ]);
    // Already migrated: later data is left as written.
    writeJSON('bayaan_tv_loved_surahs', [{surahNumber: 999}]);
    migrateLovedSurahs();
    expect(readJSON('bayaan_tv_loved_surahs')).toEqual([{surahNumber: 999}]);
  });
});
