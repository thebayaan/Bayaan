// @ai-generated
/**
 * Where the mushaf player's verse-by-verse audio comes from
 * (utils/mushafAudioUtils.ts): the downloaded file when the surah was
 * downloaded, as the main player (the real utils/audioUtils.ts here), except
 * for recordings replaced on the CDN, whose old downloads no longer fit the
 * verse timings.
 */

const SERVER = 'https://cdn.example.com/quran/recitations/x/hafs/murattal';
// Listed in utils/audioFileUrl.ts: every surah / only al-Fatihah replaced.
const REPLACED_REWAYAT = '65962996-0864-4ef9-9001-932fdc87c8f8';
const FATIHAH_REPLACED_REWAYAT = 'f877d4f8-0834-4401-a169-f1435a7dff09';

interface MockDownload {
  reciterId: string;
  surahId: string;
  rewayatId: string;
  filePath: string;
  status: 'completed';
}
const mockDownloads: {list: MockDownload[]; broken: boolean} = {
  list: [],
  broken: false,
};

jest.mock('@/data/reciterData', () => ({
  RECITERS: [
    {
      id: 'reciter-a',
      name: 'Reciter A',
      rewayat: [{id: 'plain-rewayat', server: `${SERVER}/a`}],
    },
    {
      id: 'reciter-b',
      name: 'Reciter B',
      rewayat: [
        {id: REPLACED_REWAYAT, server: `${SERVER}/b`},
        {id: FATIHAH_REPLACED_REWAYAT, server: `${SERVER}/c`},
      ],
    },
  ],
}));

jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {
    getState: () => {
      if (mockDownloads.broken) throw new Error('download store unavailable');
      return {
        getDownloadWithRewayat: (
          reciterId: string,
          surahId: string,
          rewayatId: string,
        ) =>
          mockDownloads.list.find(
            d =>
              d.reciterId === reciterId &&
              d.surahId === surahId &&
              d.rewayatId === rewayatId,
          ),
        getDownload: () => undefined,
      };
    },
  },
}));

jest.mock('@/services/downloadService', () => ({
  resolveFilePath: (file: string) => `file:///documents/${file}`,
}));

import {resolveMushafAudioUrl} from '../mushafAudioUtils';

const downloaded = (
  reciterId: string,
  rewayatId: string,
  surah: number,
): MockDownload => ({
  reciterId,
  surahId: String(surah),
  rewayatId,
  filePath: `${reciterId}-${surah}-${rewayatId}.mp3`,
  status: 'completed',
});

beforeEach(() => {
  mockDownloads.list = [];
  mockDownloads.broken = false;
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('resolveMushafAudioUrl', () => {
  it('streams a surah that was not downloaded', () => {
    expect(resolveMushafAudioUrl('plain-rewayat', 2)).toBe(
      `${SERVER}/a/002.mp3`,
    );
  });

  it('plays the downloaded file of a downloaded surah', () => {
    mockDownloads.list = [downloaded('reciter-a', 'plain-rewayat', 2)];
    expect(resolveMushafAudioUrl('plain-rewayat', 2)).toBe(
      'file:///documents/reciter-a-2-plain-rewayat.mp3',
    );
    // another surah of the same reciter is still streamed
    expect(resolveMushafAudioUrl('plain-rewayat', 3)).toBe(
      `${SERVER}/a/003.mp3`,
    );
  });

  it('streams a recording that was replaced, even when downloaded', () => {
    mockDownloads.list = [
      downloaded('reciter-b', REPLACED_REWAYAT, 24),
      downloaded('reciter-b', FATIHAH_REPLACED_REWAYAT, 1),
      downloaded('reciter-b', FATIHAH_REPLACED_REWAYAT, 2),
    ];
    // the download may be the old recording, which the timings do not fit
    expect(resolveMushafAudioUrl(REPLACED_REWAYAT, 24)).toBe(
      `${SERVER}/b/024.mp3?v=2`,
    );
    expect(resolveMushafAudioUrl(FATIHAH_REPLACED_REWAYAT, 1)).toBe(
      `${SERVER}/c/001.mp3?v=2`,
    );
    // only al-Fatihah was replaced for this one
    expect(resolveMushafAudioUrl(FATIHAH_REPLACED_REWAYAT, 2)).toBe(
      'file:///documents/reciter-b-2-f877d4f8-0834-4401-a169-f1435a7dff09.mp3',
    );
  });

  it('streams when the downloads cannot be looked up', () => {
    mockDownloads.broken = true;
    expect(resolveMushafAudioUrl('plain-rewayat', 2)).toBe(
      `${SERVER}/a/002.mp3`,
    );
  });

  it('throws for a rewayah no reciter has', () => {
    expect(() => resolveMushafAudioUrl('unknown', 2)).toThrow(
      'Cannot resolve audio URL',
    );
  });
});
