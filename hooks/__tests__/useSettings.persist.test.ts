// @ai-generated
// useSettings saves through persistStorage(). So a failed read of its key must
// not write the defaults over the saved settings, a foreground retry must bring
// them back, and a saved preference of a merged reciter must move to the
// reciter it was merged into.
import {RECITER_MERGES} from '@/utils/reciterMerges';

// `mock`-prefixed so the hoisted jest.mock factory below can use them.
const mockDisk = new Map<string, string>();
let mockReadError: Error | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => {
    if (mockReadError) throw mockReadError;
    return mockDisk.get(key) ?? null;
  },
  setItem: async (key: string, value: string) => {
    mockDisk.set(key, value);
  },
  removeItem: async (key: string) => {
    mockDisk.delete(key);
  },
}));

const KEY = 'settings-storage';

function save(state: object): void {
  mockDisk.set(KEY, JSON.stringify({state, version: 0}));
}

function saved(): {state: Record<string, unknown>; version: number} {
  return JSON.parse(mockDisk.get(KEY) as string);
}

/** A fresh app launch: a new store instance reading the same storage. */
function launch(): typeof import('../useSettings').useSettings {
  let store!: typeof import('../useSettings').useSettings;
  jest.isolateModules(() => {
    store = require('../useSettings').useSettings;
  });
  return store;
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  mockDisk.clear();
  mockReadError = null;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('keeps the saved settings when the read fails', async () => {
  save({askEveryTime: false, browseViewMode: 'list'});
  mockReadError = new Error('NSCocoaErrorDomain Code=257');
  const settings = launch();
  await settle();
  expect(settings.persist.hasHydrated()).toBe(false);

  settings.getState().setBrowseSortOption('desc');
  await settle();

  expect(saved().state).toEqual({askEveryTime: false, browseViewMode: 'list'});
});

it('takes the saved settings when the read is retried, then saves again', async () => {
  save({askEveryTime: false, browseViewMode: 'list'});
  mockReadError = new Error('NSCocoaErrorDomain Code=257');
  const settings = launch();
  await settle();
  expect(settings.getState().askEveryTime).toBe(true);

  mockReadError = null;
  await settings.persist.rehydrate();
  expect(settings.persist.hasHydrated()).toBe(true);
  expect(settings.getState().askEveryTime).toBe(false);
  expect(settings.getState().browseViewMode).toBe('list');

  settings.getState().setBrowseSortOption('desc');
  await settle();
  expect(saved().state).toMatchObject({
    askEveryTime: false,
    browseViewMode: 'list',
    browseSortOption: 'desc',
  });
});

it('saves the same key and JSON shape as before', async () => {
  const settings = launch();
  await settle();

  settings.getState().setReciterPreference('reciter-a', 'rewayah-a');
  await settle();

  expect(saved().version).toBe(0);
  expect(saved().state).toMatchObject({
    askEveryTime: true,
    reciterPreferences: {'reciter-a': 'rewayah-a'},
  });
});

it('moves a saved preference of a merged reciter to the kept reciter', async () => {
  const {fromId, toId} = RECITER_MERGES[0];
  save({reciterPreferences: {[fromId]: 'rewayah-a'}});
  const settings = launch();
  await settle();

  expect(settings.getState().getReciterPreference(toId)).toBe('rewayah-a');
  expect(settings.getState().getReciterPreference(fromId)).toBeUndefined();
});
