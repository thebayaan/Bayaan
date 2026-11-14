// @ai-generated
/**
 * Repro for PR 488 review, finding 1.
 *
 * The native projects in this repo run with expo-updates off, so
 * Updates.updateId is null and the store key falls back to semanticVersion
 * plus buildNumber. buildNumber is the git commit count, so two different
 * builds with the same count (two branches at the same depth, for example)
 * share one store, and the second build serves fits the first build measured.
 *
 * Expected: a build from another commit (another gitHash in
 * expoConfig.extra.version) starts with an empty store.
 * On the PR head: the second build serves the first build's fit, because
 * gitHash is not part of the key.
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

function fitKeys(): string[] {
  return [...mockNative.data.keys()].filter(key => key !== VERSION_KEY);
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

describe('finding 1: with updates off, the store key can repeat across builds', () => {
  it('a build from another commit with the same commit count starts empty', () => {
    // Updates off, as in ios/Bayaan/Supporting/Expo.plist and AndroidManifest.
    mockBundle.updateId = null;

    // Build A: develop at commit count 1900.
    mockBundle.version = {
      semanticVersion: '2.3.0',
      buildNumber: '1900',
      gitHash: 'aaaa111',
    };
    const buildA = launch().store;
    buildA.storeLineFit(KEY, {wordSize: 20, spaceExtra: 1});
    endRender();
    expect(fitKeys()).toHaveLength(1);

    // Build B: a PR branch, also at commit count 1900, with a changed fit pass.
    mockBundle.version = {
      semanticVersion: '2.3.0',
      buildNumber: '1900',
      gitHash: 'bbbb222',
    };
    const buildB = launch().store;
    expect(buildB.readStoredLineFit(KEY)).toBeUndefined();
  });
});
