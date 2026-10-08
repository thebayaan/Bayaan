// Characterization of develop's startup sequence (spec Layer 1). Pins the
// registration order, the critical flags and the failure tolerance of the
// services that touch content databases, so the content-sync rewiring of the
// Translation DB and Tafseer DB block cannot change them unnoticed.
const mockCalls: string[] = [];
const mockFailing = new Set<string>();

function mockStep(name: string): () => Promise<void> {
  return async (): Promise<void> => {
    mockCalls.push(name);
    if (mockFailing.has(name)) throw new Error(`${name} failed`);
  };
}

function mockSyncStep(name: string): () => void {
  return (): void => {
    mockCalls.push(name);
  };
}

function mockStore(state: Record<string, unknown>): {
  getState: () => Record<string, unknown>;
} {
  return {getState: () => state};
}

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {initialize: mockStep('analytics.initialize')},
}));
jest.mock('@/services/database/DatabaseService', () => ({
  databaseService: {initialize: mockStep('database.initialize')},
}));
jest.mock('@/services/adhkar/AdhkarService', () => ({
  adhkarService: {initialize: mockStep('adhkar.initialize')},
}));
jest.mock('@/services/playlist/PlaylistService', () => ({
  playlistService: {initialize: mockStep('playlist.initialize')},
}));
jest.mock('@/services/uploads/UploadsService', () => ({
  uploadsService: {
    initialize: mockStep('uploads.initialize'),
    maybeRunOrphanCleanup: mockStep('uploads.maybeRunOrphanCleanup'),
  },
}));
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {initialize: mockStep('annotations.initialize')},
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialize: mockStep('mushafPreload.initialize')},
}));
jest.mock('@/services/mushaf/QulDataService', () => ({
  qulDataService: {initialize: mockStep('qul.initialize')},
}));
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {initialize: mockStep('translationDb.initialize')},
}));
jest.mock('@/services/tafseer/TafseerDbService', () => ({
  tafseerDbService: {
    initialize: mockStep('tafseerDb.initialize'),
    importBundledIbnKathir: mockStep('tafseerDb.importBundledIbnKathir'),
  },
}));
jest.mock('@/store/tafseerStore', () => ({
  useTafseerStore: mockStore({
    loadDownloadedMeta: mockStep('tafseerStore.loadDownloadedMeta'),
  }),
}));
jest.mock('@/services/wbw/WBWDataService', () => ({
  wbwDataService: {initialize: mockStep('wbw.initialize')},
}));
jest.mock('@/components/mushaf/BookmarkChips', () => ({
  warmBookmarkCache: mockStep('bookmarkChips.warmBookmarkCache'),
}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {initialize: mockStep('timestamps.initialize')},
}));
jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {init: mockSyncStep('themeData.init')},
}));
jest.mock('@/store/timestampStore', () => ({
  useTimestampStore: mockStore({
    loadFollowAlongRegistry: mockSyncStep(
      'timestampStore.loadFollowAlongRegistry',
    ),
  }),
}));
jest.mock('@/store/adhkarStore', () => ({
  useAdhkarStore: mockStore({
    loadCategories: mockStep('adhkarStore.loadCategories'),
  }),
}));
jest.mock('@/store/playlistsStore', () => ({
  usePlaylistsStore: mockStore({
    loadPlaylists: mockStep('playlistsStore.loadPlaylists'),
  }),
}));
jest.mock('@/store/uploadsStore', () => ({
  useUploadsStore: mockStore({
    loadRecitations: mockStep('uploadsStore.loadRecitations'),
    loadCustomReciters: mockStep('uploadsStore.loadCustomReciters'),
  }),
}));
jest.mock('@/store/reciterStore', () => ({useReciterStore: mockStore({})}));
jest.mock('@/store/ambientStore', () => ({useAmbientStore: mockStore({})}));
jest.mock('@/store/adhkarSettingsStore', () => ({
  useAdhkarSettingsStore: mockStore({}),
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: mockStore({}),
}));
jest.mock('@/store/themeStore', () => ({useThemeStore: mockStore({})}));
jest.mock('@/store/playCountStore', () => ({
  usePlayCountStore: mockStore({}),
}));
jest.mock('@/services/player/store/lovedStore', () => ({
  useLovedStore: mockStore({}),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: mockStore({}),
}));
jest.mock('@/services/player/store/favoriteRecitersStore', () => ({
  useFavoriteRecitersStore: mockStore({}),
}));
jest.mock('expo-font', () => ({loadAsync: mockStep('fonts.loadAsync')}));

type Initializer = typeof import('../AppInitializer').appInitializer;

function freshInitializer(): Initializer {
  let initializer: Initializer | undefined;
  jest.isolateModules(() => {
    initializer = require('../AppInitializer').appInitializer;
  });
  if (!initializer) throw new Error('AppInitializer not loaded');
  return initializer;
}

function indexOf(step: string): number {
  const i = mockCalls.indexOf(step);
  if (i < 0) throw new Error(`step not called: ${step}`);
  return i;
}

// Develop's registrations after the priority sort (stable for equal
// priorities, so registration order breaks ties).
const REGISTRATIONS = [
  {name: 'Analytics', priority: 0, critical: false},
  {name: 'Database', priority: 1, critical: true},
  {name: 'Playlist Service', priority: 2, critical: true},
  {name: 'Playlists Data', priority: 3, critical: false},
  {name: 'Store Hydration', priority: 3, critical: false},
  {name: 'Adhkar Service', priority: 4, critical: false},
  {name: 'Mushaf Preload', priority: 5, critical: false},
  {name: 'Adhkar Store Data', priority: 6, critical: false},
  {name: 'Uploads Service', priority: 6, critical: false},
  {name: 'Verse Annotations', priority: 7, critical: false},
  {name: 'Timestamps', priority: 9, critical: false},
  {name: 'Theme Data', priority: 10, critical: false},
  {name: 'Arabic Fonts', priority: 10, critical: false},
  {name: 'QUL Data', priority: 10, critical: false},
  {name: 'Translation DB', priority: 10, critical: false},
  {name: 'Tafseer DB', priority: 10, critical: false},
  {name: 'WBW Data', priority: 10, critical: false},
];

// The first step each non-critical service runs, in registration order.
const NON_CRITICAL_FIRST_STEPS = [
  'analytics.initialize',
  'playlistsStore.loadPlaylists',
  'adhkar.initialize',
  'mushafPreload.initialize',
  'adhkarStore.loadCategories',
  'uploads.initialize',
  'annotations.initialize',
  'timestamps.initialize',
  'themeData.init',
  'fonts.loadAsync',
  'qul.initialize',
  'translationDb.initialize',
  'tafseerDb.initialize',
  'wbw.initialize',
];

beforeEach(() => {
  mockCalls.length = 0;
  mockFailing.clear();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AppInitializer startup (characterization, develop behavior)', () => {
  it('registers services in this priority order with these critical flags', () => {
    const services = freshInitializer().getServices();
    expect(
      services.map(s => ({
        name: s.name,
        priority: s.priority,
        critical: s.critical,
      })),
    ).toEqual(REGISTRATIONS);
  });

  it('runs critical services first in order, then starts every non-critical service', async () => {
    const initializer = freshInitializer();
    await initializer.initialize();
    expect(initializer.isInitialized()).toBe(true);
    expect(mockCalls.slice(0, 2)).toEqual([
      'database.initialize',
      'playlist.initialize',
    ]);
    // Non-critical services start in parallel: their first steps run
    // synchronously in registration order before any of them awaits.
    expect(mockCalls.slice(2, 2 + NON_CRITICAL_FIRST_STEPS.length)).toEqual(
      NON_CRITICAL_FIRST_STEPS,
    );
  });

  it('runs the Tafseer DB steps in order: open, bundled import, store meta', async () => {
    await freshInitializer().initialize();
    const open = indexOf('tafseerDb.initialize');
    const bundled = indexOf('tafseerDb.importBundledIbnKathir');
    const meta = indexOf('tafseerStore.loadDownloadedMeta');
    expect(open).toBeLessThan(bundled);
    expect(bundled).toBeLessThan(meta);
  });

  it('runs every content-touching step exactly once', async () => {
    await freshInitializer().initialize();
    for (const step of [
      'translationDb.initialize',
      'tafseerDb.initialize',
      'tafseerDb.importBundledIbnKathir',
      'tafseerStore.loadDownloadedMeta',
      'annotations.initialize',
      'database.initialize',
      'uploads.initialize',
      'adhkar.initialize',
    ]) {
      expect(mockCalls.filter(c => c === step)).toHaveLength(1);
    }
  });

  it('completes startup when the Tafseer DB fails to open, skipping its later steps', async () => {
    mockFailing.add('tafseerDb.initialize');
    const initializer = freshInitializer();
    await expect(initializer.initialize()).resolves.toBeUndefined();
    expect(initializer.isInitialized()).toBe(true);
    expect(mockCalls).not.toContain('tafseerDb.importBundledIbnKathir');
    expect(mockCalls).not.toContain('tafseerStore.loadDownloadedMeta');
    expect(mockCalls).toContain('translationDb.initialize');
    expect(mockCalls).toContain('annotations.initialize');
    expect(mockCalls).toContain('wbw.initialize');
    expect(console.warn).toHaveBeenCalledWith(
      '[AppInitializer] Non-critical service Tafseer DB failed, continuing...',
      expect.any(Error),
    );
  });

  it('completes startup when the bundled Ibn Kathir import fails, skipping store meta', async () => {
    mockFailing.add('tafseerDb.importBundledIbnKathir');
    const initializer = freshInitializer();
    await initializer.initialize();
    expect(initializer.isInitialized()).toBe(true);
    expect(mockCalls).not.toContain('tafseerStore.loadDownloadedMeta');
  });

  it('completes startup when the Translation DB fails to open', async () => {
    mockFailing.add('translationDb.initialize');
    const initializer = freshInitializer();
    await initializer.initialize();
    expect(initializer.isInitialized()).toBe(true);
    expect(mockCalls).toContain('tafseerStore.loadDownloadedMeta');
  });

  it('aborts startup when a critical service fails, before any non-critical service runs', async () => {
    mockFailing.add('database.initialize');
    const initializer = freshInitializer();
    await expect(initializer.initialize()).rejects.toThrow(
      'database.initialize failed',
    );
    expect(initializer.isInitialized()).toBe(false);
    expect(mockCalls).toEqual(['database.initialize']);
  });
});
