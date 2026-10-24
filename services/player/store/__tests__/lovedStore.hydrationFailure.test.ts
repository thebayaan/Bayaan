// @ai-generated
/**
 * A failed hydrating read must never let the store's defaults overwrite the
 * user's saved data. zustand's `persist` writes the whole store on every
 * `set()`, so without a guard the first change after a failed read replaces
 * the stored loved tracks with that one change.
 */

// `mock`-prefixed so the hoisted jest.mock factory below can use them.
let mockDisk: Record<string, string> = {};
let mockFailingReads = new Set<string>();
const mockReadError = new Error('storage read failed');

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) =>
    mockFailingReads.has(key)
      ? Promise.reject(mockReadError)
      : Promise.resolve(
          Object.prototype.hasOwnProperty.call(mockDisk, key)
            ? mockDisk[key]
            : null,
        ),
  ),
  setItem: jest.fn((key: string, value: string) => {
    mockDisk[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockDisk[key];
    return Promise.resolve();
  }),
}));

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackFavoriteToggled: jest.fn()},
}));

const LOVED_KEY = 'loved-tracks-store';
const DEV_SETTINGS_KEY = 'dev-settings-store';

const savedTrack = {
  reciterId: 'reciter-a',
  surahId: '1',
  rewayatId: 'rewayah-a',
  timestamp: 1,
};

function seedLovedTracks(): void {
  mockDisk[LOVED_KEY] = JSON.stringify({
    state: {tracks: [savedTrack], lastSynced: null},
    version: 0,
  });
}

function storedTracks(): Array<{reciterId: string; surahId: string}> {
  return JSON.parse(mockDisk[LOVED_KEY]).state.tracks;
}

/** A fresh module registry for each test, because persist hydrates on load. */
function loadStores() {
  let loved!: typeof import('../lovedStore').useLovedStore;
  let devSettings!: typeof import('@/store/devSettingsStore').useDevSettingsStore;
  jest.isolateModules(() => {
    loved = require('../lovedStore').useLovedStore;
    devSettings = require('@/store/devSettingsStore').useDevSettingsStore;
  });
  return {loved, devSettings};
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setImmediate(resolve));
  }
}

describe('persisted store when the hydrating read fails', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDisk = {};
    mockFailingReads = new Set();
    // The default error handler warns in development; keep test output clean.
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does not overwrite saved loved tracks after a failed read', async () => {
    seedLovedTracks();
    mockFailingReads.add(LOVED_KEY);
    const {loved} = loadStores();
    await settle();

    expect(loved.persist.hasHydrated()).toBe(false);
    expect(loved.getState().tracks).toEqual([]);

    loved.getState().toggleLoved('reciter-b', '2', 'rewayah-b');
    await settle();

    expect(storedTracks()).toEqual([savedTrack]);
  });

  it('does not save a change made while the failing read is in flight', async () => {
    seedLovedTracks();
    mockFailingReads.add(LOVED_KEY);
    const {loved} = loadStores();

    // No await yet, so the hydrating read has not settled.
    loved.getState().toggleLoved('reciter-b', '2', 'rewayah-b');
    await settle();

    expect(storedTracks()).toEqual([savedTrack]);
  });

  it('merges saved data and persists again after a later successful read', async () => {
    seedLovedTracks();
    mockFailingReads.add(LOVED_KEY);
    const {loved} = loadStores();
    await settle();

    mockFailingReads.delete(LOVED_KEY);
    await loved.persist.rehydrate();
    expect(loved.getState().tracks).toEqual([savedTrack]);

    loved.getState().toggleLoved('reciter-b', '2', 'rewayah-b');
    await settle();

    expect(storedTracks().map(t => t.reciterId)).toEqual([
      'reciter-b',
      'reciter-a',
    ]);
  });

  it('restores and saves normally when the read succeeds', async () => {
    seedLovedTracks();
    const {loved} = loadStores();
    await settle();

    expect(loved.persist.hasHydrated()).toBe(true);
    expect(loved.getState().tracks).toEqual([savedTrack]);

    loved.getState().toggleLoved('reciter-b', '2', 'rewayah-b');
    await settle();

    expect(storedTracks().map(t => t.reciterId)).toEqual([
      'reciter-b',
      'reciter-a',
    ]);
  });

  it('saves on a fresh install, where the read resolves with null', async () => {
    const {loved} = loadStores();
    await settle();

    expect(loved.persist.hasHydrated()).toBe(true);

    loved.getState().toggleLoved('reciter-b', '2', 'rewayah-b');
    await settle();

    expect(storedTracks().map(t => t.reciterId)).toEqual(['reciter-b']);
  });

  it('replaces a stored value that is not valid JSON on the next save', async () => {
    mockDisk[LOVED_KEY] = '{not json';
    const {loved} = loadStores();
    await settle();

    loved.getState().toggleLoved('reciter-b', '2', 'rewayah-b');
    await settle();

    expect(storedTracks().map(t => t.reciterId)).toEqual(['reciter-b']);
  });

  it("does not block another store's writes", async () => {
    seedLovedTracks();
    mockFailingReads.add(LOVED_KEY);
    const {loved, devSettings} = loadStores();
    await settle();

    loved.getState().toggleLoved('reciter-b', '2', 'rewayah-b');
    devSettings.getState().setShowFloatingDevMenu(true);
    await settle();

    expect(storedTracks()).toEqual([savedTrack]);
    expect(JSON.parse(mockDisk[DEV_SETTINGS_KEY]).state).toMatchObject({
      showFloatingDevMenu: true,
    });
  });
});
