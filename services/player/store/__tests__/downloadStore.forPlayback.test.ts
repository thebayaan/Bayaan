/**
 * isDownloadedForPlayback decides the downloaded badge, the surah menus and
 * what "Download all" skips. It must count exactly the downloads playback
 * plays (findDownloadForPlayback), or a row says one thing and plays another.
 */
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {
    trackDownloadCompleted: jest.fn(),
    trackDownloadStarted: jest.fn(),
  },
}));
jest.mock('@/services/downloadService', () => ({
  resolveFilePath: (name: string) => `file:///docs/${name}`,
  clearAllDownloads: jest.fn(async () => undefined),
  removeDownload: jest.fn(async () => undefined),
  extractFilename: (path: string) => path,
}));

import {RECITERS, type Reciter} from '@/data/reciterData';
import {findDownloadForPlayback} from '@/utils/audioUtils';
import {useDownloadStore, type DownloadedSurah} from '../downloadStore';

// Catalogue order: Warsh first, so a download recorded without a rewayah
// holds the Warsh recording.
const reciter = {
  id: 'reciter',
  rewayat: [{id: 'warsh'}, {id: 'hafs'}],
} as unknown as Reciter;

function download(
  rewayatId: string,
  status: DownloadedSurah['status'] = 'completed',
): DownloadedSurah {
  return {
    reciterId: 'reciter',
    surahId: '2',
    rewayatId,
    filePath: `${rewayatId || 'unkeyed'}.mp3`,
    fileSize: 10,
    downloadDate: 0,
    status,
  };
}

const isDownloadedForPlayback = (rewayatId?: string) =>
  useDownloadStore
    .getState()
    .isDownloadedForPlayback('reciter', '2', rewayatId);

beforeEach(() => {
  RECITERS.splice(0, RECITERS.length, reciter);
});

afterEach(() => {
  RECITERS.splice(0, RECITERS.length);
  useDownloadStore.setState({downloads: []});
});

it.each<[string, DownloadedSurah[], string | undefined, boolean]>([
  ['nothing downloaded', [], 'warsh', false],
  ['the rewayah itself', [download('warsh')], 'warsh', true],
  ['only another rewayah', [download('hafs')], 'warsh', false],
  ["'' for the first rewayah", [download('')], 'warsh', true],
  ["'' for another rewayah", [download('')], 'hafs', false],
  ["'' with no rewayah asked for", [download('')], undefined, true],
  ['a rewayah with none asked for', [download('warsh')], undefined, false],
  ["'' that failed", [download('', 'error')], 'warsh', false],
  ["'' still downloading", [download('', 'downloading')], 'warsh', false],
])('%s', (_case, downloads, rewayatId, expected) => {
  useDownloadStore.setState({downloads});

  expect(isDownloadedForPlayback(rewayatId)).toBe(expected);
  expect(!!findDownloadForPlayback('reciter', '2', rewayatId)).toBe(expected);
});

it("counts no '' download for a reciter missing from the catalogue", () => {
  RECITERS.splice(0, RECITERS.length);
  useDownloadStore.setState({downloads: [download('')]});

  expect(isDownloadedForPlayback('warsh')).toBe(false);
  expect(findDownloadForPlayback('reciter', '2', 'warsh')).toBeUndefined();
});
