// services/widgets/__tests__/snapshotListeners.test.ts
const mockWrite = jest.fn();
const mockReload = jest.fn();
const mockBuild = jest.fn();

jest.mock('bayaan-widgets', () => ({
  changedWidgetKinds: (prev: unknown) => (prev ? [] : ['ContinueListening']),
  isWidgetsAvailable: () => true,
  reloadWidgets: (k: unknown) => mockReload(k),
  writeSnapshot: (s: unknown) => mockWrite(s),
  cacheArtwork: jest.fn(async () => false),
  hasArtwork: () => true,
  addWidgetCommandListener: jest.fn(() => ({remove: jest.fn()})),
  takeQueuedCommands: () => [],
  selectFreshCommands: () => [],
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {subscribe: jest.fn()},
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {subscribe: jest.fn()},
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: {subscribe: jest.fn()},
}));
jest.mock('@/store/themeStore', () => ({
  useThemeStore: {subscribe: jest.fn()},
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => undefined,
}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => ''}));
jest.mock('../buildSnapshot', () => ({
  buildSnapshot: () => mockBuild(),
  artworkFileName: (id: string) => `reciter-${id}.jpg`,
  cardSurahId: () => null,
  surahArtworkFileName: (id: number) => `surah-${id}.jpg`,
  surahArtworkUrl: (id: number) => `https://cdn/surah/${id}.png`,
}));
jest.mock('../live-activity/syncLiveActivity', () => ({
  noteSnapshotForLiveActivity: jest.fn(),
}));
jest.mock('../collectSnapshotInput', () => ({
  collectSnapshotInput: () => ({}),
}));
jest.mock('../handleWidgetCommand', () => ({handleWidgetCommand: jest.fn()}));

import {addSnapshotListener, flushWidgetSnapshot} from '../syncWidgets';

const snapshot = (n: number): unknown => ({
  generatedAt: n,
  nowPlaying: null,
  upNext: [],
  recent: [],
  defaultReciter: null,
});

it('tells listeners about each written snapshot with the previous one', () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const seen: unknown[][] = [];
  const remove = addSnapshotListener((prev, next) => seen.push([prev, next]));
  const throwing = addSnapshotListener(() => {
    throw new Error('listener failed');
  });
  mockBuild.mockReturnValueOnce(snapshot(1));
  flushWidgetSnapshot();
  mockBuild.mockReturnValueOnce(snapshot(2));
  flushWidgetSnapshot(true);
  expect(seen).toEqual([
    [null, snapshot(1)],
    [snapshot(1), snapshot(2)],
  ]);
  expect(mockWrite).toHaveBeenCalledTimes(2);
  remove();
  throwing();
  mockBuild.mockReturnValueOnce(snapshot(3));
  flushWidgetSnapshot(true);
  expect(seen).toHaveLength(2);
});
