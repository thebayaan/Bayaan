// @ai-generated
import {pickRewayatId} from '../rewayatPreference';

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
