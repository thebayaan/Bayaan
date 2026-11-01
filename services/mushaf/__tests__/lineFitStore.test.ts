// @ai-generated
/**
 * lineFitStore (RFC-023 step 4): a fit stays for the next launch of the same
 * bundle. A new update id, build version or format starts empty. A bad value is
 * never stored and never served, and a failure in the store never reaches the
 * caller. Each launch() is a fresh copy of the modules over the same native
 * store, as a relaunch is.
 */
const mockNative = {
  data: new Map<string, unknown>(),
  configs: [] as unknown[],
  failCreate: false,
  failGet: false,
  failSet: false,
  failClear: false,
};
const mockBundle: {updateId: string | null; version: unknown} = {
  updateId: null,
  version: undefined,
};

jest.mock('react-native-mmkv', () => ({
  createMMKV: (config: unknown) => {
    if (mockNative.failCreate) throw new Error('no MMKV');
    mockNative.configs.push(config);
    return {
      get length() {
        return mockNative.data.size;
      },
      getString: (key: string) => {
        if (mockNative.failGet) throw new Error('read failed');
        const value = mockNative.data.get(key);
        return typeof value === 'string' ? value : undefined;
      },
      set: (key: string, value: unknown) => {
        if (mockNative.failSet) throw new Error('disk full');
        mockNative.data.set(key, value);
      },
      clearAll: () => {
        if (mockNative.failClear) throw new Error('clear failed');
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

const UPDATE_A = 'aaaaaaaa-0000-4000-8000-000000000000';
const UPDATE_B = 'bbbbbbbb-0000-4000-8000-000000000000';
const KEY = 'DigitalKhattV2|23.4|360|1|240|300|3:jt=1,;|بِسْمِ ٱللَّهِ';
const VERSION_KEY = '#version';

const devFlag = globalThis as unknown as {__DEV__: boolean};
const devAtStart = devFlag.__DEV__;

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

/** Opens the store, as the first getLineFit of a launch does. */
function launchAndOpen(): {store: StoreModule; space: SpaceModule} {
  const loaded = launch();
  expect(loaded.store.readStoredLineFit('open')).toBeUndefined();
  return loaded;
}

/** Ends the render: the waiting writes run. */
function endRender(): void {
  jest.runOnlyPendingTimers();
}

function fitKeys(): string[] {
  return [...mockNative.data.keys()].filter(key => key !== VERSION_KEY);
}

function storeOneFit(): StoreModule {
  const {store} = launch();
  store.storeLineFit(KEY, {wordSize: 20, spaceExtra: 1});
  endRender();
  expect(fitKeys()).toHaveLength(1);
  return store;
}

/** A store that an earlier launch left, with `fits` fits. */
function seedStore(version: string, fits: number): void {
  mockNative.data.set(VERSION_KEY, version);
  for (let i = 0; i < fits; i++) mockNative.data.set(`k${i}`, '20,1');
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
  devFlag.__DEV__ = false;
  mockNative.data.clear();
  mockNative.configs.length = 0;
  mockNative.failCreate = false;
  mockNative.failGet = false;
  mockNative.failSet = false;
  mockNative.failClear = false;
  mockBundle.updateId = UPDATE_A;
  mockBundle.version = {semanticVersion: '2.3.0', buildNumber: 1900};
});

describe('the same bundle', () => {
  it('keeps a fit across a relaunch', () => {
    const fit = {wordSize: 21.873456, spaceExtra: 0.75};
    const first = launch().store;
    first.storeLineFit(KEY, fit);
    endRender();

    const next = launch().store;
    expect(next.readStoredLineFit(KEY)).toEqual(fit);
    expect(next.readStoredLineFit(`${KEY}x`)).toBeUndefined();
  });

  it('keeps every digit, a zero and a negative spaceExtra', () => {
    const fits = [
      {wordSize: 1 / 3, spaceExtra: 0},
      {wordSize: 20, spaceExtra: -0.125},
      {wordSize: 19.999999999999996, spaceExtra: 1e-7},
    ];
    const first = launch().store;
    fits.forEach((fit, i) => first.storeLineFit(`${KEY}${i}`, fit));
    endRender();

    const next = launch().store;
    fits.forEach((fit, i) => {
      expect(next.readStoredLineFit(`${KEY}${i}`)).toEqual(fit);
    });
  });

  it('getLineFit serves a stored fit when the session map has none', () => {
    const fit = {wordSize: 22.5, spaceExtra: 0.75};
    const first = launch().space;
    expect(first.getLineFit(KEY)).toBeUndefined();
    first.setLineFit(KEY, fit);
    endRender();

    const next = launch().space;
    expect(next.getLineFit(KEY)).toEqual(fit);
    expect(next.getLineFit('another line')).toBeUndefined();
  });

  it('setLineFit serves the fit at once and writes after the render', () => {
    const {space} = launch();
    space.setLineFit(KEY, {wordSize: 22.5, spaceExtra: 0});
    expect(space.getLineFit(KEY)).toEqual({wordSize: 22.5, spaceExtra: 0});
    expect(fitKeys()).toHaveLength(0);
    endRender();
    expect(fitKeys()).toHaveLength(1);
  });

  it('clears nothing at a relaunch', () => {
    storeOneFit();
    launchAndOpen();
    expect(fitKeys()).toHaveLength(1);
  });

  it('opens one instance with no path', () => {
    storeOneFit();
    expect(mockNative.configs).toEqual([{id: 'mushaf-line-fits'}]);
  });
});

describe('another bundle', () => {
  it('a new update id starts empty', () => {
    storeOneFit();

    mockBundle.updateId = UPDATE_B;
    const next = launch().store;
    expect(next.readStoredLineFit(KEY)).toBeUndefined();
    expect(fitKeys()).toHaveLength(0);
    expect(mockNative.data.get(VERSION_KEY)).toBe(
      `${next.LINE_FIT_FORMAT}:${UPDATE_B}`,
    );
  });

  it('a new LINE_FIT_FORMAT starts empty', () => {
    const store = storeOneFit();
    // The same update id, written by an earlier format.
    const current = `${store.LINE_FIT_FORMAT}:${UPDATE_A}`;
    expect(mockNative.data.get(VERSION_KEY)).toBe(current);
    mockNative.data.set(
      VERSION_KEY,
      `${store.LINE_FIT_FORMAT - 1}:${UPDATE_A}`,
    );

    const next = launch().store;
    expect(next.readStoredLineFit(KEY)).toBeUndefined();
    expect(fitKeys()).toHaveLength(0);
    expect(mockNative.data.get(VERSION_KEY)).toBe(current);
  });

  it('with updates off, a new build version starts empty', () => {
    mockBundle.updateId = null;
    const store = storeOneFit();
    expect(mockNative.data.get(VERSION_KEY)).toBe(
      `${store.LINE_FIT_FORMAT}:2.3.0-1900`,
    );

    mockBundle.version = {semanticVersion: '2.3.0', buildNumber: 1901};
    const next = launch().store;
    expect(next.readStoredLineFit(KEY)).toBeUndefined();
    expect(fitKeys()).toHaveLength(0);
  });

  it('a store with no version key starts empty', () => {
    mockNative.data.set('a-fit', '20,1');
    launchAndOpen();
    expect(fitKeys()).toHaveLength(0);
  });

  it('if the app stops after the clear, the next launch clears again', () => {
    storeOneFit();

    // The new bundle clears, then stops before it sets the version key.
    mockBundle.updateId = UPDATE_B;
    mockNative.failSet = true;
    expect(launch().store.readStoredLineFit(KEY)).toBeUndefined();
    expect(mockNative.data.has(VERSION_KEY)).toBe(false);

    mockNative.failSet = false;
    mockNative.data.set('a-late-fit', '20,1');
    const {store} = launchAndOpen();
    expect(fitKeys()).toHaveLength(0);
    expect(mockNative.data.get(VERSION_KEY)).toBe(
      `${store.LINE_FIT_FORMAT}:${UPDATE_B}`,
    );
  });
});

describe('the version key', () => {
  it('cannot be a fit: every fit key is a base36 hash', () => {
    const {store} = launch();
    for (let i = 0; i < 200; i++) {
      store.storeLineFit(`${KEY}${i}`, {wordSize: 20, spaceExtra: 0});
    }
    store.storeLineFit(VERSION_KEY, {wordSize: 20, spaceExtra: 0});
    endRender();
    const keys = fitKeys();
    expect(keys).toHaveLength(201);
    for (const key of keys) expect(key).toMatch(/^[0-9a-z]{1,11}$/);
  });

  it('is not read as a fit', () => {
    const {store} = launchAndOpen();
    expect(mockNative.data.has(VERSION_KEY)).toBe(true);
    expect(store.readStoredLineFit(VERSION_KEY)).toBeUndefined();
  });

  it('is not replaced by a fit stored under its name', () => {
    const store = storeOneFit();
    const version = mockNative.data.get(VERSION_KEY);
    store.storeLineFit(VERSION_KEY, {wordSize: 21, spaceExtra: 0});
    endRender();
    expect(mockNative.data.get(VERSION_KEY)).toBe(version);
    expect(store.readStoredLineFit(VERSION_KEY)).toEqual({
      wordSize: 21,
      spaceExtra: 0,
    });
  });
});

describe('a bad value', () => {
  it.each([
    ['a NaN word size', Number.NaN, 1],
    ['an infinite word size', Number.POSITIVE_INFINITY, 1],
    ['a zero word size', 0, 1],
    ['a negative word size', -20, 1],
    ['a NaN spaceExtra', 20, Number.NaN],
    ['an infinite spaceExtra', 20, Number.NEGATIVE_INFINITY],
  ])('is never stored: %s', (_name, wordSize, spaceExtra) => {
    const {store} = launchAndOpen();
    store.storeLineFit(KEY, {wordSize, spaceExtra});
    endRender();
    expect(fitKeys()).toHaveLength(0);
    expect(store.readStoredLineFit(KEY)).toBeUndefined();
  });

  it('stays in the session map only, as before', () => {
    const {space} = launchAndOpen();
    const fit = {wordSize: 0, spaceExtra: 0};
    space.setLineFit(KEY, fit);
    endRender();
    expect(space.getLineFit(KEY)).toEqual(fit);
    expect(fitKeys()).toHaveLength(0);
  });

  it.each([
    ['NaN,1'],
    ['0,1'],
    ['-1,1'],
    ['Infinity,0'],
    ['20,NaN'],
    ['20,Infinity'],
    ['20'],
    ['20,'],
    [',1'],
    ['20,1,5'],
    ['abc,def'],
    [''],
  ])('is never served: "%s"', bad => {
    storeOneFit();
    mockNative.data.set(fitKeys()[0], bad);
    expect(launch().store.readStoredLineFit(KEY)).toBeUndefined();
    expect(launch().space.getLineFit(KEY)).toBeUndefined();
  });

  it('a new measure replaces a bad stored value', () => {
    storeOneFit();
    mockNative.data.set(fitKeys()[0], 'NaN,1');

    const next = launch().store;
    next.storeLineFit(KEY, {wordSize: 21, spaceExtra: 0});
    endRender();
    expect(next.readStoredLineFit(KEY)).toEqual({wordSize: 21, spaceExtra: 0});
    expect(fitKeys()).toHaveLength(1);
  });
});

describe('the limits of the store', () => {
  it('starts again at the launch after it passes the limit', () => {
    const {store} = launch();
    const version = `${store.LINE_FIT_FORMAT}:${UPDATE_A}`;
    seedStore(version, store.LINE_FIT_STORE_LIMIT);

    expect(store.readStoredLineFit(KEY)).toBeUndefined();
    expect(fitKeys()).toHaveLength(0);
    expect(mockNative.data.get(VERSION_KEY)).toBe(version);
  });

  it('keeps a store at the limit, with the version key as one entry', () => {
    const {store} = launch();
    const fits = store.LINE_FIT_STORE_LIMIT - 1;
    seedStore(`${store.LINE_FIT_FORMAT}:${UPDATE_A}`, fits);

    expect(store.readStoredLineFit(KEY)).toBeUndefined();
    expect(fitKeys()).toHaveLength(fits);
  });

  it('writes once for each key of a render', () => {
    const {store} = launchAndOpen();
    store.storeLineFit(KEY, {wordSize: 20, spaceExtra: 0});
    store.storeLineFit(KEY, {wordSize: 21, spaceExtra: 0});
    store.storeLineFit(`${KEY}x`, {wordSize: 22, spaceExtra: 0});
    expect(jest.getTimerCount()).toBe(1);
    endRender();
    expect(fitKeys()).toHaveLength(2);
    expect(store.readStoredLineFit(KEY)).toEqual({wordSize: 21, spaceExtra: 0});
  });
});

describe('when there is no store', () => {
  it('a dev bundle opens nothing', () => {
    devFlag.__DEV__ = true;
    const {store} = launch();
    store.storeLineFit(KEY, {wordSize: 20, spaceExtra: 1});
    expect(jest.getTimerCount()).toBe(0);
    expect(store.readStoredLineFit(KEY)).toBeUndefined();
    expect(mockNative.configs).toHaveLength(0);
  });

  it.each([
    ['no version', undefined],
    ['no build number', {semanticVersion: '2.3.0'}],
    ['no semantic version', {buildNumber: 1900}],
  ])('no update id and %s opens nothing', (_name, version) => {
    mockBundle.updateId = null;
    mockBundle.version = version;
    const {store} = launch();
    store.storeLineFit(KEY, {wordSize: 20, spaceExtra: 1});
    expect(jest.getTimerCount()).toBe(0);
    expect(store.readStoredLineFit(KEY)).toBeUndefined();
    expect(mockNative.configs).toHaveLength(0);
  });
});

describe('a failure in the store never reaches the caller', () => {
  it.each([
    ['the open', 'failCreate'],
    ['the version read', 'failGet'],
    ['the clear', 'failClear'],
    ['the version write', 'failSet'],
  ] as const)('at %s, the store is off for this launch', (_name, flag) => {
    // A store from another bundle, so that the open must clear it.
    seedStore('0:another-bundle', 1);
    mockNative[flag] = true;
    const {store, space} = launch();
    const fit = {wordSize: 20, spaceExtra: 1};
    expect(store.readStoredLineFit(KEY)).toBeUndefined();
    expect(() => {
      space.setLineFit(KEY, fit);
      endRender();
    }).not.toThrow();
    expect(jest.getTimerCount()).toBe(0);
    expect(space.getLineFit(KEY)).toEqual(fit);
  });

  it('at a read, the line counts as not stored', () => {
    storeOneFit();
    const {store} = launchAndOpen();
    mockNative.failGet = true;
    expect(store.readStoredLineFit(KEY)).toBeUndefined();
    mockNative.failGet = false;
    expect(store.readStoredLineFit(KEY)).toEqual({wordSize: 20, spaceExtra: 1});
  });

  it('at a write, only the fits of that write are lost', () => {
    const {store} = launchAndOpen();
    mockNative.failSet = true;
    store.storeLineFit(KEY, {wordSize: 20, spaceExtra: 1});
    expect(() => endRender()).not.toThrow();

    mockNative.failSet = false;
    store.storeLineFit(`${KEY}x`, {wordSize: 21, spaceExtra: 0});
    endRender();
    expect(store.readStoredLineFit(KEY)).toBeUndefined();
    expect(store.readStoredLineFit(`${KEY}x`)).toEqual({
      wordSize: 21,
      spaceExtra: 0,
    });
  });
});
