// @ai-generated
import {
  pickRewayatId,
  reciterHasSurah,
  rewayahHasSurah,
} from '../rewayatPreference';

const hafs = {id: 'hafs', surah_list: [1, 2, 3]};
const warsh = {id: 'warsh', surah_list: [1, 2]};
const qalun = {id: 'qalun', surah_list: [3]};
const rewayat = [hafs, warsh, qalun];

describe('pickRewayatId', () => {
  it('prefers the id passed by navigation', () => {
    expect(pickRewayatId(rewayat, ['qalun', 'warsh'])).toBe('qalun');
  });

  it('uses the saved pick when navigation passes none', () => {
    expect(pickRewayatId(rewayat, [undefined, 'warsh'])).toBe('warsh');
  });

  it('skips a saved pick the reciter no longer has', () => {
    expect(pickRewayatId(rewayat, [undefined, 'removed'])).toBe('hafs');
  });

  it('falls back to the first rewayat with no candidates', () => {
    expect(pickRewayatId(rewayat, [])).toBe('hafs');
  });

  it('returns undefined for a reciter with no rewayat', () => {
    expect(pickRewayatId([], ['warsh'])).toBeUndefined();
  });

  it('skips a saved pick that lacks the surah being played', () => {
    expect(pickRewayatId(rewayat, ['warsh'], 3)).toBe('hafs');
    expect(pickRewayatId([warsh, qalun], ['warsh'], 3)).toBe('qalun');
  });

  it('keeps the saved pick when it has the surah', () => {
    expect(pickRewayatId(rewayat, ['warsh'], 2)).toBe('warsh');
  });

  it('ignores the surah when no rewayat has it', () => {
    expect(pickRewayatId(rewayat, ['warsh'], 114)).toBe('warsh');
  });
});

describe('reciterHasSurah', () => {
  it('is true when any rewayah lists the surah', () => {
    expect(reciterHasSurah(rewayat, 3)).toBe(true);
    expect(rewayahHasSurah(warsh, 3)).toBe(false);
    expect(rewayahHasSurah(qalun, 3)).toBe(true);
  });

  // The case pickRewayatId cannot report: it still returns a rewayah.
  it('is false when no rewayah lists the surah', () => {
    expect(reciterHasSurah(rewayat, 114)).toBe(false);
    expect(reciterHasSurah([], 1)).toBe(false);
  });

  it('treats a rewayah without a list as complete', () => {
    expect(reciterHasSurah([{surah_list: undefined as never}], 114)).toBe(true);
  });
});
