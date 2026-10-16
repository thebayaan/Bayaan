// writeCarSnapshotNow skips the native write when nothing the car shows
// changed, and the resolve context keeps its own copy of RECITERS.
import type {CarSnapshot} from '@/services/car/types';

const mockWriteSnapshot = jest.fn((_json: string): void => undefined);
jest.mock('@/modules/bayaan-car', () => ({
  BayaanCar: {
    isAvailable: true,
    writeSnapshot: (json: string) => mockWriteSnapshot(json),
  },
}));
jest.mock('@/config/branding', () => ({}));
const mockReciters = [{id: 'r1', name: 'Reciter One'}];
jest.mock('@/data/reciterData', () => ({
  get RECITERS() {
    return mockReciters;
  },
}));
jest.mock('@/data/surahData', () => ({SURAHS: []}));
jest.mock('@/data/systemPlaylists', () => ({getSystemPlaylists: () => []}));
jest.mock('@/data/juzData', () => ({SURAH_TO_JUZ: {}}));
jest.mock('@/utils/reciterImages', () => ({reciterImages: {}}));
jest.mock('@/utils/artworkUtils', () => ({formatReciterName: jest.fn()}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {getState: () => ({recentTracks: []})},
}));
jest.mock('@/services/player/store/lovedStore', () => ({
  useLovedStore: {getState: () => ({tracks: []})},
}));
jest.mock('@/services/player/store/downloadStore', () => ({
  useDownloadStore: {getState: () => ({downloads: []})},
}));
jest.mock('@/services/player/store/favoriteRecitersStore', () => ({
  useFavoriteRecitersStore: {getState: () => ({favoriteReciterIds: []})},
}));
jest.mock('@/store/playlistsStore', () => ({
  usePlaylistsStore: {
    getState: () => ({playlists: [], getPlaylistItems: jest.fn()}),
  },
}));
const mockRecitations = [{id: 'u1'}];
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: {
    getState: () => ({recitations: mockRecitations, customReciters: []}),
  },
}));
const mockGetDailyAggregate = jest.fn((_date: string): unknown => null);
jest.mock('@/services/analytics/LocalAggregationStore', () => ({
  localAggregationStore: {
    getDailyAggregate: (date: string) => mockGetDailyAggregate(date),
  },
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: {getState: () => ({defaultReciter: {id: ''}})},
}));

let mockTopReciterId: string | null = 'r1';
let mockGeneratedAt = '2026-10-09T00:00:00.000Z';
const mockBuildInputs: {playCounts: unknown}[] = [];
jest.mock('@/services/car/snapshot/buildCarSnapshot', () => ({
  buildCarSnapshot: (input: {playCounts: unknown}): CarSnapshot => {
    mockBuildInputs.push(input);
    return {
      version: 1,
      generatedAt: mockGeneratedAt,
      topReciterId: mockTopReciterId,
      home: {sections: []},
      library: [],
      lists: {},
      reciters: [],
      surahs: [],
      juz: [],
      downloadedKeys: [],
    };
  },
}));

import {
  getLastResolveContext,
  writeCarSnapshotNow,
} from '../CarSnapshotService';

describe('writeCarSnapshotNow', () => {
  it('skips the native write when only generatedAt changed', async () => {
    await writeCarSnapshotNow();
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(1);

    mockGeneratedAt = '2026-10-09T00:05:00.000Z';
    await writeCarSnapshotNow();
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(1);

    mockTopReciterId = null;
    await writeCarSnapshotNow();
    expect(mockWriteSnapshot).toHaveBeenCalledTimes(2);
    expect(getLastResolveContext()?.topReciterId).toBeNull();
  });

  it('copies RECITERS into the resolve context', async () => {
    await writeCarSnapshotNow();
    const reciters = getLastResolveContext()?.reciters;
    expect(reciters).toEqual(mockReciters);
    expect(reciters).not.toBe(mockReciters);
  });

  it('freezes the uploads the snapshot was built from', async () => {
    await writeCarSnapshotNow();
    expect(getLastResolveContext()?.uploads).toBe(mockRecitations);
  });

  it('skips an unreadable day of listening history instead of failing', async () => {
    const today = new Date();
    const yesterday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 1,
    );
    const key = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
    mockGetDailyAggregate.mockImplementation(date => {
      if (date === key(today)) throw new SyntaxError('corrupt');
      if (date === key(yesterday)) {
        return {date, surahs: {'18': 5 * 60_000}};
      }
      return null;
    });
    mockBuildInputs.length = 0;
    await writeCarSnapshotNow();
    expect(mockBuildInputs[0]?.playCounts).toEqual([
      {surahId: 18, count: 1, lastPlayed: yesterday.getTime()},
    ]);
    mockGetDailyAggregate.mockImplementation(() => null);
  });
});
