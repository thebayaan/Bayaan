// @ai-generated
/**
 * lineFitCache: a line fit is kept for the session and for the next launch of
 * the same bundle, read from the store once, and never opened or cleared
 * inside a render. Each launch is a fresh copy of the module over one native
 * store, as on a device.
 */
const mockNative = {
  data: new Map<string, unknown>(),
  calls: [] as string[],
  failOpen: false,
  failSetCalls: 0,
};
const mockBundle: {updateId: string | null; version: unknown} = {
  updateId: null,
  version: undefined,
};

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    mockNative.calls.push('createMMKV');
    if (mockNative.failOpen) throw new Error('no space');
    return {
      get length() {
        return mockNative.data.size;
      },
      getString: (key: string) => {
        mockNative.calls.push('getString');
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

type CacheModule = typeof import('../lineFitCache');

const KEY = 'DigitalKhattV2|23.4|360|1|240|300|3:jt=1,;|بِسْمِ ٱللَّهِ';
const UPDATE_A = 'aaaaaaaa-0000-4000-8000-000000000000';
const UPDATE_B = 'bbbbbbbb-0000-4000-8000-000000000000';
const devFlag = globalThis as unknown as {__DEV__: boolean};
const devAtStart = devFlag.__DEV__;

/** A fresh copy of the module; `open` runs MushafPreloadService's open. */
function launch(open = true): CacheModule {
  let cache: CacheModule | undefined;
  jest.isolateModules(() => {
    cache = require('../lineFitCache') as CacheModule;
  });
  if (open) cache?.openLineFitCache();
  return cache as CacheModule;
}

const fitKeys = () => [...mockNative.data.keys()].filter(k => k !== '#version');
const count = (call: string) => mockNative.calls.filter(c => c === call).length;

afterAll(() => {
  devFlag.__DEV__ = devAtStart;
});

beforeEach(() => {
  devFlag.__DEV__ = false; // release and preview builds
  mockNative.data.clear();
  mockNative.calls.length = 0;
  mockNative.failOpen = false;
  mockNative.failSetCalls = 0;
  mockBundle.updateId = UPDATE_A;
  mockBundle.version = undefined;
});

describe('the same bundle', () => {
  it('keeps a fit across a relaunch, a zero and a negative spaceExtra too', () => {
    const fits = [
      {wordSize: 23.456789012345, spaceExtra: 0.000123456789},
      {wordSize: 21, spaceExtra: 0},
      {wordSize: 22, spaceExtra: -0.5},
    ];
    const first = launch();
    fits.forEach((fit, i) => first.setLineFit(`${KEY}${i}`, fit, true));
    expect(first.getLineFit(`${KEY}0`)).toEqual(fits[0]);

    const next = launch();
    fits.forEach((fit, i) =>
      expect(next.getLineFit(`${KEY}${i}`)).toEqual(fit),
    );
    expect(next.getLineFit('another line')).toBeUndefined();
  });

  it('getLineFit promotes a stored fit, so five calls read MMKV once', () => {
    launch().setLineFit(KEY, {wordSize: 20, spaceExtra: 1}, true);
    const next = launch();
    mockNative.calls.length = 0;
    for (let i = 0; i < 5; i++) {
      expect(next.getLineFit(KEY)).toEqual({wordSize: 20, spaceExtra: 1});
    }
    expect(count('getString')).toBe(1);
  });
});

describe('the open', () => {
  it('getLineFit and setLineFit never open or clear the store', () => {
    // An earlier update left fits behind; a new update launches.
    launch().setLineFit(KEY, {wordSize: 20, spaceExtra: 1}, true);
    mockBundle.updateId = UPDATE_B;
    const cache = launch(false);
    mockNative.calls.length = 0;

    // Before the open: the session map only.
    expect(cache.getLineFit(KEY)).toBeUndefined();
    cache.setLineFit(`${KEY}x`, {wordSize: 21, spaceExtra: 0}, true);
    expect(mockNative.calls).toEqual([]);

    cache.openLineFitCache();
    mockNative.calls.length = 0;
    cache.getLineFit(KEY);
    cache.setLineFit(KEY, {wordSize: 22, spaceExtra: 0}, true);
    expect(count('createMMKV') + count('clearAll')).toBe(0);
  });

  it('a new update id starts empty', () => {
    launch().setLineFit(KEY, {wordSize: 20, spaceExtra: 1}, true);
    mockBundle.updateId = UPDATE_B;
    expect(launch().getLineFit(KEY)).toBeUndefined();
    expect(fitKeys()).toHaveLength(0);
  });

  it('a build from another commit with the same commit count starts empty', () => {
    mockBundle.updateId = null; // updates off
    mockBundle.version = {semanticVersion: '2.3.0', buildNumber: '1900'};
    launch().setLineFit(KEY, {wordSize: 20, spaceExtra: 1}, true);
    expect(fitKeys()).toHaveLength(0); // no git hash: no store

    mockBundle.version = {...mockBundle.version, gitHash: 'aaaa111'};
    launch().setLineFit(KEY, {wordSize: 20, spaceExtra: 1}, true);
    expect(launch().getLineFit(KEY)).toEqual({wordSize: 20, spaceExtra: 1});

    mockBundle.version = {...mockBundle.version, gitHash: 'bbbb222'};
    expect(launch().getLineFit(KEY)).toBeUndefined();
  });

  it('a store over the limit starts again at the next launch', () => {
    launch().setLineFit(KEY, {wordSize: 20, spaceExtra: 1}, true);
    for (let i = 0; i < 30000; i++) mockNative.data.set(`k${i}`, '20,1');
    expect(launch().getLineFit(KEY)).toBeUndefined();
    expect(fitKeys()).toHaveLength(0);
  });

  it('a dev bundle has no store', () => {
    devFlag.__DEV__ = true;
    const cache = launch();
    cache.setLineFit(KEY, {wordSize: 20, spaceExtra: 1}, true);
    expect(cache.getLineFit(KEY)).toEqual({wordSize: 20, spaceExtra: 1});
    expect(mockNative.calls).toEqual([]);
  });
});

describe('what is stored', () => {
  it('a fit that did not change the line stays in the session', () => {
    const cache = launch();
    cache.setLineFit(KEY, {wordSize: 20, spaceExtra: 0}, false);
    expect(cache.getLineFit(KEY)).toEqual({wordSize: 20, spaceExtra: 0});
    expect(fitKeys()).toHaveLength(0);
  });
});

describe('a bad value', () => {
  it.each([NaN, Infinity, 0, -1])(
    'a word size of %p stays in the session',
    w => {
      const cache = launch();
      cache.setLineFit(KEY, {wordSize: w, spaceExtra: 0}, true);
      expect(cache.getLineFit(KEY)).toEqual({wordSize: w, spaceExtra: 0});
      expect(fitKeys()).toHaveLength(0);
    },
  );

  it.each(['20abc,1xyz', '20,', ',1', '0,1', '20', '20,1,2', 'x,y'])(
    'a stored %p is never served',
    value => {
      launch().setLineFit(KEY, {wordSize: 20, spaceExtra: 1}, true);
      mockNative.data.set(fitKeys()[0], value);
      expect(launch().getLineFit(KEY)).toBeUndefined();
    },
  );
});

describe('a failure in the store never reaches the caller', () => {
  it('at the open, the session map still serves', () => {
    mockNative.failOpen = true;
    const cache = launch();
    cache.setLineFit(KEY, {wordSize: 20, spaceExtra: 1}, true);
    expect(cache.getLineFit(KEY)).toEqual({wordSize: 20, spaceExtra: 1});
  });

  it('one failing write does not drop the later writes of the same render', () => {
    const first = launch();
    mockNative.failSetCalls = 1;
    expect(() => {
      first.setLineFit(`${KEY}0`, {wordSize: 20, spaceExtra: 1}, true);
      first.setLineFit(`${KEY}1`, {wordSize: 21, spaceExtra: 0}, true);
      first.setLineFit(`${KEY}2`, {wordSize: 22, spaceExtra: -0.5}, true);
    }).not.toThrow();

    const next = launch();
    expect(next.getLineFit(`${KEY}0`)).toBeUndefined();
    expect(next.getLineFit(`${KEY}1`)).toEqual({wordSize: 21, spaceExtra: 0});
    expect(next.getLineFit(`${KEY}2`)).toEqual({
      wordSize: 22,
      spaceExtra: -0.5,
    });
  });
});
