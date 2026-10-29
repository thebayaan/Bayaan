import type {Reciter, Rewayah} from '../types/reciter';

jest.mock('./tvDataService', () => ({
  ...jest.requireActual('./tvDataService'),
  getCachedRewayat: () => null,
}));

import {
  defaultRewayah,
  reciterPlayRequest,
  surahMenuVoice,
} from './menuChoices';

const rewayah = (
  id: string,
  surahs: number[],
  name = "Hafs A'n Assem",
  style = 'murattal',
): Rewayah =>
  ({id, name, style, surah_list: surahs, server: ''}) as unknown as Rewayah;

const reciter = (id: string, rewayat: Rewayah[]): Reciter =>
  ({id, name: id, rewayat}) as unknown as Reciter;

const all = Array.from({length: 114}, (_, i) => i + 1);
// Alafasi as the API lists him: a short Ad-Duri set before his full Hafs.
const alafasi = [
  rewayah('duri', [1, 2, 3, 4, 5, 6], 'Rewayat Ad-Duri A’n Abi Amr'),
  rewayah('hafs-mujawwad', [1, 2], "Hafs A'n Assem", 'mojawwad'),
  rewayah('hafs', all),
];

describe('defaultRewayah', () => {
  it('picks the fullest rewayah, murattal first, as the reciter page does', () => {
    expect(defaultRewayah(alafasi)?.id).toBe('hafs');
  });

  it('is null with nothing known', () => {
    expect(defaultRewayah([])).toBeNull();
  });
});

describe('reciterPlayRequest', () => {
  it('plays the default recitation from its first surah', () => {
    expect(reciterPlayRequest('alafasi', alafasi, false)).toEqual({
      reciterId: 'alafasi',
      rewayahId: 'hafs',
      surahNumber: 1,
      source: 'reciter-menu',
    });
  });

  it('shuffles within the default recitation', () => {
    const req = reciterPlayRequest('alafasi', alafasi, true);
    expect(req.rewayahId).toBe('hafs');
    expect(req.shuffle).toBe(true);
    expect(all).toContain(req.surahNumber);
  });

  it('leaves the lookup to the player when nothing is known', () => {
    expect(reciterPlayRequest('x', [], false)).toEqual({
      reciterId: 'x',
      surahNumber: 1,
      source: 'reciter-menu',
    });
  });
});

describe('surahMenuVoice', () => {
  const minshawi = reciter('minshawi', [rewayah('m-hafs', all)]);
  const husary = reciter('husary', [rewayah('h-hafs', [1, 2])]);
  const rewayatOf = (r: Reciter) => r.rewayat;

  it('keeps the voice and rewayah it was opened with', () => {
    expect(
      surahMenuVoice(
        {surahNumber: 2, reciterId: 'minshawi', rewayahId: 'old'},
        [minshawi],
        rewayatOf,
      ),
    ).toEqual({surahNumber: 2, reciterId: 'minshawi', rewayahId: 'old'});
  });

  it('fills in the rewayah of a given voice', () => {
    expect(
      surahMenuVoice(
        {surahNumber: 2, reciterId: 'minshawi'},
        [minshawi],
        rewayatOf,
      ),
    ).toEqual({surahNumber: 2, reciterId: 'minshawi', rewayahId: 'm-hafs'});
  });

  it('keeps a voice it does not know without a rewayah', () => {
    expect(
      surahMenuVoice(
        {surahNumber: 2, reciterId: 'gone'},
        [minshawi],
        rewayatOf,
      ),
    ).toEqual({surahNumber: 2, reciterId: 'gone'});
  });

  it('picks the first candidate who has the surah', () => {
    expect(
      surahMenuVoice({surahNumber: 18}, [husary, minshawi], rewayatOf),
    ).toEqual({surahNumber: 18, reciterId: 'minshawi', rewayahId: 'm-hafs'});
  });
});
