// @ai-generated
/**
 * generateSmartAudioUrl on the real download store: which downloaded file,
 * if any, a recitation plays from.
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

import {RECITERS, type Reciter, type Rewayat} from '@/data/reciterData';
import {
  useDownloadStore,
  type DownloadedSurah,
} from '@/services/player/store/downloadStore';
import {generateSmartAudioUrl} from '../audioUtils';

function rewayah(id: string): Rewayat {
  return {
    id,
    reciter_id: 'reciter',
    name: id,
    style: 'murattal',
    server: `https://cdn.test/${id}`,
    surah_total: 114,
    surah_list: [],
    source_type: 'test',
    created_at: '',
  };
}

// Catalogue order: Warsh first. A download recorded without a rewayah
// therefore holds the Warsh recording.
const reciter: Reciter = {
  id: 'reciter',
  name: 'Reciter',
  date: null,
  image_url: null,
  rewayat: [rewayah('warsh'), rewayah('hafs')],
};

function download(rewayatId: string, filePath: string): DownloadedSurah {
  return {
    reciterId: 'reciter',
    surahId: '2',
    rewayatId,
    filePath,
    fileSize: 10,
    downloadDate: 0,
    status: 'completed',
  };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  RECITERS.splice(0, RECITERS.length, reciter);
  useDownloadStore.setState({downloads: []});
});

afterEach(() => {
  jest.restoreAllMocks();
  RECITERS.splice(0, RECITERS.length);
});

it('streams when nothing is downloaded', () => {
  expect(generateSmartAudioUrl(reciter, '2', 'hafs')).toBe(
    'https://cdn.test/hafs/002.mp3',
  );
});

it('plays the download recorded for the requested rewayah', () => {
  useDownloadStore.setState({downloads: [download('hafs', 'hafs.mp3')]});
  expect(generateSmartAudioUrl(reciter, '2', 'hafs')).toBe(
    'file:///docs/hafs.mp3',
  );
});

it('plays a download recorded without a rewayah when none is requested', () => {
  useDownloadStore.setState({downloads: [download('', 'unkeyed.mp3')]});
  expect(generateSmartAudioUrl(reciter, '2')).toBe('file:///docs/unkeyed.mp3');
});

describe('a download recorded without a rewayah, asked for by rewayah id', () => {
  beforeEach(() => {
    useDownloadStore.setState({downloads: [download('', 'unkeyed.mp3')]});
  });

  it("plays for the reciter's first rewayah, the one it holds", () => {
    expect(generateSmartAudioUrl(reciter, '2', 'warsh')).toBe(
      'file:///docs/unkeyed.mp3',
    );
  });

  it('never plays for another rewayah', () => {
    expect(generateSmartAudioUrl(reciter, '2', 'hafs')).toBe(
      'https://cdn.test/hafs/002.mp3',
    );
  });

  it('goes by catalogue order, not the order of the reciter handed in', () => {
    // The reciter screens pass a copy re-sorted Hafs-first. Hafs must not
    // get the Warsh file because it is first in that copy.
    const resorted: Reciter = {
      ...reciter,
      rewayat: [reciter.rewayat[1], reciter.rewayat[0]],
    };
    expect(generateSmartAudioUrl(resorted, '2', 'hafs')).toBe(
      'https://cdn.test/hafs/002.mp3',
    );
    expect(generateSmartAudioUrl(resorted, '2', 'warsh')).toBe(
      'file:///docs/unkeyed.mp3',
    );
  });

  it('streams when the reciter is not in the catalogue', () => {
    RECITERS.splice(0, RECITERS.length);
    expect(generateSmartAudioUrl(reciter, '2', 'warsh')).toBe(
      'https://cdn.test/warsh/002.mp3',
    );
  });

  it('prefers the download recorded for the rewayah itself', () => {
    useDownloadStore.setState({
      downloads: [download('', 'unkeyed.mp3'), download('warsh', 'warsh.mp3')],
    });
    expect(generateSmartAudioUrl(reciter, '2', 'warsh')).toBe(
      'file:///docs/warsh.mp3',
    );
  });

  it('ignores it while it is not a completed download', () => {
    useDownloadStore.setState({
      downloads: [{...download('', 'unkeyed.mp3'), status: 'error'}],
    });
    expect(generateSmartAudioUrl(reciter, '2', 'warsh')).toBe(
      'https://cdn.test/warsh/002.mp3',
    );
  });
});
