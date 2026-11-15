// @ai-generated
// The Mushaf data loads after the splash, so a widget snapshot can come before
// it. The Continue Reading line that the last published snapshot showed stays
// in the Mushaf session store, so the widget keeps it.
import type {WidgetSnapshot} from 'bayaan-widgets';

type Stores = Map<string, Map<string, unknown>>;
type MockGlobals = typeof globalThis & {__mmkvStores?: Stores};

// Shared by every module registry below, so a fresh registry reads what an
// earlier one wrote, the way a new process reads the same MMKV files.
jest.mock('react-native-mmkv', () => {
  const g = globalThis as MockGlobals;
  g.__mmkvStores = g.__mmkvStores ?? new Map();
  const stores = g.__mmkvStores;
  return {
    createMMKV: ({id}: {id: string}) => {
      if (!stores.has(id)) stores.set(id, new Map());
      const data = stores.get(id) as Map<string, unknown>;
      return {
        getString: (key: string) => {
          const value = data.get(key);
          return typeof value === 'string' ? value : undefined;
        },
        getNumber: (key: string) => {
          const value = data.get(key);
          return typeof value === 'number' ? value : undefined;
        },
        getBoolean: (key: string) => {
          const value = data.get(key);
          return typeof value === 'boolean' ? value : undefined;
        },
        set: (key: string, value: unknown) => data.set(key, value),
      };
    },
  };
});

const mockWrites: WidgetSnapshot[] = [];
jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  writeSnapshot: (s: WidgetSnapshot) => mockWrites.push(s),
  reloadWidgets: () => undefined,
  hasArtwork: () => false,
  cacheArtwork: async () => false,
}));

const mockDk = {initialized: true};
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    get initialized() {
      return mockDk.initialized;
    },
    getVerseText: () => 'one two three four five six seven',
    getPageToSurah: () => ({295: 18, 296: 18}),
  },
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {getOrderedVerseKeysForPage: () => ['18:75']},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: {tracks: [], currentIndex: 0},
      playback: {state: 'paused', position: 0, duration: 0, rate: 1},
    }),
  },
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {getState: () => ({recentTracks: []})},
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: {getState: () => ({defaultReciter: {id: ''}})},
}));
jest.mock('@/store/themeStore', () => ({
  useThemeStore: {getState: () => ({themeMode: 'system'})},
}));
jest.mock('@/store/adhkarStore', () => ({
  useAdhkarStore: {getState: () => ({dhikrCounts: {}})},
}));
jest.mock('@/store/adhkarSessionStore', () => ({
  useAdhkarSessionStore: {getState: () => ({session: null})},
}));
jest.mock('../enabledWidgets', () => ({
  isWidgetEnabled: () => false,
  enabledKinds: (kinds: string[]) => kinds,
}));
jest.mock('@/services/dataService', () => ({
  getReciterByIdSync: () => null,
}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => ''}));
jest.mock('../handleWidgetCommand', () => ({
  handleWidgetCommand: async () => undefined,
}));
jest.mock('../live-activity/syncLiveActivity', () => ({
  noteSnapshotForLiveActivity: () => undefined,
}));

const LINE = 'one two three four five six';

type Modules = {
  sync: typeof import('../syncWidgets');
  collect: typeof import('../collectSnapshotInput');
  build: typeof import('../buildSnapshot');
};

// A fresh module registry: a new process with the same MMKV files.
function newProcess(lastReadPage: number): Modules {
  let mods: Modules | null = null;
  jest.isolateModules(() => {
    const {mushafSessionStore} =
      require('@/services/mushaf/MushafSessionStore') as typeof import('@/services/mushaf/MushafSessionStore');
    mushafSessionStore.setLastReadPage(lastReadPage);
    mods = {
      sync: require('../syncWidgets'),
      collect: require('../collectSnapshotInput'),
      build: require('../buildSnapshot'),
    };
  });
  if (!mods) throw new Error('modules failed to load');
  return mods;
}

function storeContents(): string {
  const stores = (globalThis as MockGlobals).__mmkvStores ?? new Map();
  return JSON.stringify([...stores].map(([id, m]) => [id, [...m]]));
}

beforeEach(() => {
  (globalThis as MockGlobals).__mmkvStores?.clear();
  mockWrites.length = 0;
  mockDk.initialized = true;
});

it('keeps the line when a snapshot comes before the Mushaf data loads', () => {
  newProcess(295).sync.flushWidgetSnapshot();
  expect(mockWrites[0].lastRead?.openingText).toBe(LINE);

  mockDk.initialized = false;
  newProcess(295).sync.flushWidgetSnapshot();
  expect(mockWrites).toHaveLength(2);
  expect(mockWrites[1].lastRead).toEqual(mockWrites[0].lastRead);
});

it('shows no line for a page whose line was not published', () => {
  newProcess(295).sync.flushWidgetSnapshot();
  mockDk.initialized = false;
  newProcess(296).sync.flushWidgetSnapshot();
  expect(mockWrites[1].lastRead?.page).toBe(296);
  expect(mockWrites[1].lastRead?.openingText).toBe('');
});

it('a snapshot that is only built writes nothing', () => {
  const {collect, build} = newProcess(295);
  const before = storeContents();
  const snapshot = build.buildSnapshot(
    collect.collectSnapshotInput(new Date()),
  );
  expect(snapshot.lastRead?.openingText).toBe(LINE);
  expect(storeContents()).toBe(before);
});
