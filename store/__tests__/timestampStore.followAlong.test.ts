// @ai-generated
// Follow Along on / off is the user's choice: it must survive a restart (it
// came back on at every launch), and it is the only part of the timestamp
// store that is saved.

// `mock`-prefixed so the hoisted jest.mock factory below can use them.
const mockDisk = new Map<string, string>();
let mockWrites = 0;
let mockReadError: Error | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => {
    if (mockReadError) throw mockReadError;
    return mockDisk.get(key) ?? null;
  },
  setItem: async (key: string, value: string) => {
    mockWrites += 1;
    mockDisk.set(key, value);
  },
  removeItem: async (key: string) => {
    mockDisk.delete(key);
  },
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: jest.fn(async () => null)},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => false, hasSource: () => false},
}));

const KEY = 'follow-along-store';

type Stores = {
  timestamps: typeof import('../timestampStore').useTimestampStore;
  choice: typeof import('../timestampStore').useFollowAlongChoice;
};

/** A fresh app launch: new store instances reading the same storage. */
function launch(): Stores {
  let stores!: Stores;
  jest.isolateModules(() => {
    const module = require('../timestampStore');
    stores = {
      timestamps: module.useTimestampStore,
      choice: module.useFollowAlongChoice,
    };
  });
  return stores;
}

/** Lets storage reads and writes settle. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

const saved = () => JSON.parse(mockDisk.get(KEY) as string).state;

beforeEach(() => {
  mockDisk.clear();
  mockWrites = 0;
  mockReadError = null;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('is on for a new install', async () => {
  const {timestamps} = launch();
  await settle();
  expect(timestamps.getState().followAlongEnabled).toBe(true);
});

it('stays off after a restart, and on again once switched back', async () => {
  const first = launch();
  await settle();
  first.timestamps.getState().toggleFollowAlong();
  expect(first.timestamps.getState().followAlongEnabled).toBe(false);
  await settle();

  const second = launch();
  await settle();
  expect(second.timestamps.getState().followAlongEnabled).toBe(false);

  second.timestamps.getState().toggleFollowAlong();
  await settle();
  const third = launch();
  await settle();
  expect(third.timestamps.getState().followAlongEnabled).toBe(true);
});

it('saves the choice and nothing else from the store', async () => {
  const {timestamps} = launch();
  await settle();
  timestamps.getState().toggleFollowAlong();
  await settle();
  expect(saved()).toEqual({followAlongEnabled: false});
});

// The store changes with every verse recited; none of that reaches storage.
it('writes nothing while verses are tracked', async () => {
  const {timestamps} = launch();
  await settle();
  const store = timestamps.getState();
  store.setCurrentAyah({
    surahNumber: 2,
    ayahNumber: 5,
    verseKey: '2:5',
    timestampFrom: 1000,
    timestampTo: 2000,
  });
  store.setIsLocked(false);
  store.setBasmalaIntroSurah(2);
  store.clearCurrentAyah();
  await settle();
  expect(mockWrites).toBe(0);
});

it('keeps the saved choice when the read fails, and takes it on a retry', async () => {
  mockDisk.set(
    KEY,
    JSON.stringify({state: {followAlongEnabled: false}, version: 0}),
  );
  mockReadError = new Error('NSCocoaErrorDomain Code=257');
  const {timestamps, choice} = launch();
  await settle();
  expect(choice.persist.hasHydrated()).toBe(false);
  expect(timestamps.getState().followAlongEnabled).toBe(true);

  mockReadError = null;
  await choice.persist.rehydrate();
  expect(timestamps.getState().followAlongEnabled).toBe(false);
  expect(saved()).toEqual({followAlongEnabled: false});
});
