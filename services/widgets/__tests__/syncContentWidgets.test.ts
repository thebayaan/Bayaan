// services/widgets/__tests__/syncContentWidgets.test.ts
import type {WidgetContent} from 'bayaan-widgets';
import type {DownloadedSurah} from '@/services/player/store/downloadStore';

const mockWriteContent = jest.fn();
const mockReload = jest.fn();
const mockAppStateHandlers: ((state: string) => void)[] = [];
const mockCacheArtwork = jest.fn<Promise<boolean>, [string, string]>(
  async () => true,
);
const mockCached = new Set<string>();
let mockDownloads: DownloadedSurah[] = [];
let mockSleepEnd: number | null = null;
const mockGetAll = jest.fn();
const mockGetItems = jest.fn();

jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  isWidgetsAvailable: () => true,
  writeContent: (c: unknown) => mockWriteContent(c),
  reloadWidgets: (k: unknown) => mockReload(k),
  cacheArtwork: (u: string, f: string) => mockCacheArtwork(u, f),
  hasArtwork: (f: string) => mockCached.has(f),
}));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const appState = {
    addEventListener: (_: string, handler: (state: string) => void) => {
      mockAppStateHandlers.push(handler);
      return {remove: jest.fn()};
    },
  };
  return new Proxy(actual, {
    get: (target, prop) => (prop === 'AppState' ? appState : target[prop]),
  });
});
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {
    getState: () => ({downloads: mockDownloads}),
    subscribe: jest.fn(() => jest.fn()),
  },
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({settings: {sleepTimerEnd: mockSleepEnd}}),
    subscribe: jest.fn(() => jest.fn()),
  },
}));
jest.mock('@/store/playlistsStore', () => ({
  usePlaylistsStore: {subscribe: jest.fn(() => jest.fn())},
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: {subscribe: jest.fn(() => jest.fn())},
}));
jest.mock('@/services/playlist/PlaylistService', () => ({
  playlistService: {
    getAllPlaylists: () => mockGetAll(),
    getPlaylistItems: (id: string) => mockGetItems(id),
  },
}));
jest.mock('@/data/reciterCollections', () => ({
  getFeaturedReciters: () => [
    {
      id: 'r-basfar',
      name: 'Albaraa Basfar',
      date: null,
      image_url: null,
      rewayat: [],
    },
  ],
  getBayaanOriginalsReciters: () => [],
  getTrendingReciters: () => [],
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: (id: string) => ({id, name: `Name ${id}`, rewayat: []}),
  getSurahById: (id: number) => ({id, name: `Surah ${id}`}),
}));
jest.mock('@/utils/artworkUtils', () => ({
  getReciterArtwork: (r: {id: string}) =>
    r.id === 'inline' ? 'data:image/png;base64,x' : `https://img/${r.id}.jpg`,
}));
jest.mock('../handleWidgetCommand', () => ({
  setContentCommandRunner: jest.fn(),
}));
jest.mock('../contentCommands', () => ({
  runContentCommand: jest.fn(),
}));
jest.mock('../syncWidgets', () => ({
  addSnapshotListener: jest.fn(() => jest.fn()),
}));

import {
  contentArtworkJobs,
  flushContent,
  resetContentSync,
  startContentWidgetSync,
} from '../syncContentWidgets';

function download(surahId: string, date: number): DownloadedSurah {
  return {
    reciterId: 'r1',
    surahId,
    rewayatId: 'rw',
    filePath: '',
    fileSize: 1,
    downloadDate: date,
    status: 'completed',
  };
}

beforeEach(() => {
  resetContentSync();
  mockWriteContent.mockReset();
  mockReload.mockReset();
  mockAppStateHandlers.length = 0;
  mockCacheArtwork.mockClear();
  mockCached.clear();
  mockDownloads = [download('67', 2)];
  mockSleepEnd = null;
  mockGetAll.mockReset().mockResolvedValue([
    {
      id: 'p1',
      name: 'Night',
      color: '#000',
      createdAt: 0,
      updatedAt: 1,
      itemCount: 1,
    },
  ]);
  mockGetItems.mockReset().mockResolvedValue([
    {
      id: 'i1',
      playlistId: 'p1',
      surahId: '36',
      reciterId: 'r1',
      orderIndex: 0,
      addedAt: 0,
    },
  ]);
});

it('writes content and reloads every content kind on the first flush', async () => {
  await flushContent(true);
  const written: WidgetContent = mockWriteContent.mock.calls[0][0];
  expect(written.downloads.map(d => d.surahId)).toEqual([67]);
  expect(written.playlists[0].items.map(i => i.itemId)).toEqual(['i1']);
  expect(written.spotlight.map(s => s.id)).toEqual(['r-basfar']);
  expect(mockReload).toHaveBeenNthCalledWith(1, [
    'LibraryShelf',
    'ReciterSpotlight',
    'Bedtime',
    'BayaanNow',
  ]);
});

it('writes nothing when nothing changed, and reloads only what changed', async () => {
  mockCached
    .add('surah-67.jpg')
    .add('surah-36.jpg')
    .add('reciter-r-basfar.jpg');
  await flushContent(true);
  mockWriteContent.mockClear();
  mockReload.mockClear();
  await flushContent();
  expect(mockWriteContent).not.toHaveBeenCalled();
  mockSleepEnd = Date.now() + 60_000;
  await flushContent();
  expect(mockReload).toHaveBeenCalledWith(['Bedtime', 'BayaanNow']);
});

it('keeps the last playlists when reading them fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await flushContent(true);
  mockGetAll.mockRejectedValueOnce(new Error('db closed'));
  mockDownloads = [download('67', 2), download('18', 3)];
  await flushContent(true);
  const latest: WidgetContent =
    mockWriteContent.mock.calls[mockWriteContent.mock.calls.length - 1][0];
  expect(latest.playlists.map(p => p.id)).toEqual(['p1']);
  expect(latest.downloads.map(d => d.surahId)).toEqual([18, 67]);
});

it('caches missing cards and spotlight photos, skipping cached files and inline images', () => {
  const content: WidgetContent = {
    version: 1,
    generatedAt: 0,
    downloadCount: 1,
    sleepTimerEndsAt: null,
    downloads: [
      {
        surahId: 67,
        surahName: 'Al-Mulk',
        reciterId: 'r1',
        reciterName: '',
        rewayatId: null,
        itemId: null,
      },
    ],
    playlists: [
      {
        id: 'p',
        name: 'n',
        itemCount: 1,
        items: [
          {
            surahId: 36,
            surahName: 'Ya-Sin',
            reciterId: 'r1',
            reciterName: '',
            rewayatId: null,
            itemId: 'i',
          },
        ],
      },
    ],
    spotlight: [
      {id: 'r-a', name: 'A', artworkFile: 'reciter-r-a.jpg', surahIds: []},
      {
        id: 'inline',
        name: 'B',
        artworkFile: 'reciter-inline.jpg',
        surahIds: [],
      },
      {id: 'r-c', name: 'C', artworkFile: 'reciter-r-c.jpg', surahIds: []},
    ],
  };
  const cached = new Set(['surah-36.jpg', 'reciter-r-c.jpg']);
  const jobs = contentArtworkJobs(
    content,
    f => cached.has(f),
    id => (id === 'inline' ? null : `https://img/${id}.jpg`),
  );
  expect([...jobs.entries()]).toEqual([
    ['surah-67.jpg', 'https://cdn.thebayaan.com/assets/car/surah/67.png'],
    ['reciter-r-a.jpg', 'https://img/r-a.jpg'],
  ]);
});

it('registers runContentCommand with the command handler on import', () => {
  const {setContentCommandRunner} = jest.requireMock('../handleWidgetCommand');
  const {runContentCommand} = jest.requireMock('../contentCommands');
  expect(setContentCommandRunner).toHaveBeenCalledWith(runContentCommand);
});

it('reloads the date-only widgets on launch and on every foreground', async () => {
  const stop = startContentWidgetSync();
  const dateKinds = ['Adhkar', 'HijriDate', 'Occasion'];
  expect(mockReload).toHaveBeenCalledWith(dateKinds);
  mockReload.mockClear();
  mockAppStateHandlers[0]('background');
  expect(mockReload).not.toHaveBeenCalledWith(dateKinds);
  mockAppStateHandlers[0]('active');
  expect(mockReload).toHaveBeenCalledWith(dateKinds);
  stop();
  await flushContent();
});
