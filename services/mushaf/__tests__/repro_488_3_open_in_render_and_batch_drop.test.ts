// @ai-generated
/**
 * Repro for PR 488 review, finding 3.
 *
 * Part one: the store opens lazily, so the first getLineFit of a launch (called
 * from SkiaLine's useMemo, on the first Mushaf page) runs createMMKV and, after
 * a new build or update, clearAll() on the old fits, inside the render.
 * Expected: the store is opened and cleared outside getLineFit (at import, or
 * from MushafPreloadService), so getLineFit itself runs no open and no clear.
 * On the PR head: createMMKV and clearAll both run inside that first
 * getLineFit call.
 *
 * Part two: flushWrites wraps the whole loop in one try, so when one write of
 * a batch throws, every later write of that batch is dropped.
 * Expected: only the failing fit is lost; the other fits of the same render
 * are kept for the next launch.
 * On the PR head: the two fits queued after the failing one are never written.
 */
const mockNative = {
  data: new Map<string, unknown>(),
  calls: [] as string[],
  failSetCalls: 0,
};
const mockBundle: {updateId: string | null; version: unknown} = {
  updateId: null,
  version: undefined,
};

// One native store shared by every launch, as on a device. Copied from the
// PR's lineFitStore.test.ts, with call recording added.
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    mockNative.calls.push('createMMKV');
    return {
      get length() {
        return mockNative.data.size;
      },
      getString: (key: string) => {
        const value = mockNative.data.get(key);
        return typeof value === 'string' ? value : undefined;
      },
      set: (key: string, value: unknown) => {
        mockNative.calls.push('set');
        if (mockNative.failSetCalls > 0) {
          mockNative.failSetCalls -= 1;
          throw new Error('disk full');
        }
        mockNative.data.set(key, value);
      },
      clearAll: () => {
        mockNative.calls.push('clearAll');
        mockNative.data.clear();
      },
    };
  },
}));

jest.mock('expo-updates', () => ({
  __esModule: true,
  get updateId() {
    return mockBundle.updateId;
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return {extra: {version: mockBundle.version}};
    },
  },
}));

// The real module pulls in Skia; justifiedSpace only needs its two constants.
jest.mock('@/services/mushaf/QuranTextService', () => ({
  FONTSIZE: 1000,
  SPACEWIDTH: 100,
}));

type StoreModule = typeof import('../lineFitStore');
type SpaceModule = typeof import('@/components/mushaf/skia/justifiedSpace');

const KEY = 'DigitalKhattV2|23.4|360|1|240|300|3:jt=1,;|بِسْمِ ٱللَّهِ';
const VERSION_KEY = '#version';

const devFlag = globalThis as unknown as {__DEV__: boolean};
const devAtStart = devFlag.__DEV__;

/** A fresh copy of the modules over the same native store, as a relaunch is. */
function launch(): {store: StoreModule; space: SpaceModule} {
  let loaded: {store: StoreModule; space: SpaceModule} | undefined;
  jest.isolateModules(() => {
    loaded = {
      store: require('../lineFitStore') as StoreModule,
      space: require('@/components/mushaf/skia/justifiedSpace') as SpaceModule,
    };
  });
  return loaded as {store: StoreModule; space: SpaceModule};
}

/** Ends the render: the waiting writes run. */
function endRender(): void {
  jest.runOnlyPendingTimers();
}

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
  devFlag.__DEV__ = devAtStart;
});

beforeEach(() => {
  jest.clearAllTimers();
  // Release and preview builds: the store is off when __DEV__ is true.
  devFlag.__DEV__ = false;
  mockNative.data.clear();
  mockNative.calls.length = 0;
  mockNative.failSetCalls = 0;
  mockBundle.updateId = null;
  mockBundle.version = undefined;
});

const UPDATE_OLD = 'aaaaaaaa-0000-4000-8000-000000000000';
const UPDATE_NEW = 'bbbbbbbb-0000-4000-8000-000000000000';

describe('finding 3: open in render, and the write batch', () => {
  it('the first getLineFit of a launch runs no open and no clear', () => {
    // An earlier update left 100 fits behind.
    mockNative.data.set(VERSION_KEY, `1:${UPDATE_OLD}`);
    for (let i = 0; i < 100; i++) mockNative.data.set(`k${i}`, '20,1');

    // A new update launches. Importing the modules is not part of the render.
    mockBundle.updateId = UPDATE_NEW;
    const {space} = launch();
    mockNative.calls.length = 0;

    // SkiaLine's useMemo asks for the first line's fit.
    space.getLineFit(KEY);
    const openWorkInRender = mockNative.calls.filter(
      call => call === 'createMMKV' || call === 'clearAll',
    );
    expect(openWorkInRender).toEqual([]);
  });

  it('one failing write does not drop the later writes of the same batch', () => {
    mockBundle.updateId = UPDATE_NEW;
    const first = launch().store;
    // Open the store now, so its version write is not part of the batch.
    expect(first.readStoredLineFit('open')).toBeUndefined();

    // One render fits three lines; the first write of the flush fails.
    first.storeLineFit(`${KEY}0`, {wordSize: 20, spaceExtra: 1});
    first.storeLineFit(`${KEY}1`, {wordSize: 21, spaceExtra: 0});
    first.storeLineFit(`${KEY}2`, {wordSize: 22, spaceExtra: -0.5});
    mockNative.failSetCalls = 1;
    expect(() => endRender()).not.toThrow();

    // The next launch: the first fit is lost, the other two should be kept.
    const next = launch().store;
    expect(next.readStoredLineFit(`${KEY}0`)).toBeUndefined();
    expect({
      second: next.readStoredLineFit(`${KEY}1`),
      third: next.readStoredLineFit(`${KEY}2`),
    }).toEqual({
      second: {wordSize: 21, spaceExtra: 0},
      third: {wordSize: 22, spaceExtra: -0.5},
    });
  });
});
