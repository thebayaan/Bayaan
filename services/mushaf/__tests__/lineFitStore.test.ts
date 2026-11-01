// @ai-generated
/**
 * lineFitStore (RFC-023 step 4): a fit stays for the next launch of the same
 * bundle. A new update id, build version or format starts empty and removes the
 * old store. A bad value is never stored and never served. Each launch() is a
 * fresh copy of the modules over the same native stores, as a relaunch is.
 */
type NativeStores = Map<string, Map<string, unknown>>;

const mockNative = {
  stores: new Map() as NativeStores,
  configs: [] as {id: string; path?: string}[],
  deleted: [] as string[],
  failCreate: false,
  failDelete: false,
  failSet: false,
};
const mockBundle: {updateId: string | null; version: unknown} = {
  updateId: null,
  version: undefined,
};

jest.mock('react-native-mmkv', () => ({
  createMMKV: (config: {id: string; path?: string}) => {
    if (mockNative.failCreate) throw new Error('no MMKV');
    mockNative.configs.push(config);
    if (!mockNative.stores.has(config.id)) {
      mockNative.stores.set(config.id, new Map());
    }
    const data = mockNative.stores.get(config.id) as Map<string, unknown>;
    return {
      get length() {
        return data.size;
      },
      getString: (key: string) => {
        const value = data.get(key);
        return typeof value === 'string' ? value : undefined;
      },
      set: (key: string, value: unknown) => {
        if (mockNative.failSet) throw new Error('disk full');
        data.set(key, value);
      },
      clearAll: () => data.clear(),
    };
  },
  deleteMMKV: (id: string) => {
    if (mockNative.failDelete) throw new Error('no delete');
    mockNative.deleted.push(id);
    return mockNative.stores.delete(id);
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
const POINTER = 'mushaf-line-fits';

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

/** Ends the render: the waiting writes run. */
function endRender(): void {
  jest.runOnlyPendingTimers();
}

function storeName(store: StoreModule, bundle = UPDATE_A): string {
  return store.lineFitStoreName(store.LINE_FIT_FORMAT, bundle);
}

function nativeStore(name: string): Map<string, unknown> | undefined {
  return mockNative.stores.get(name);
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
  mockNative.stores.clear();
  mockNative.configs.length = 0;
  mockNative.deleted.length = 0;
  mockNative.failCreate = false;
  mockNative.failDelete = false;
  mockNative.failSet = false;
  mockBundle.updateId = UPDATE_A;
  mockBundle.version = {semanticVersion: '2.3.0', buildNumber: 1900};
});

describe('a fit across launches', () => {
  it('keeps the same fit for the same key after a relaunch', () => {
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
    const {store, space} = launch();
    space.setLineFit(KEY, {wordSize: 22.5, spaceExtra: 0});
    expect(space.getLineFit(KEY)).toEqual({wordSize: 22.5, spaceExtra: 0});
    expect(nativeStore(storeName(store))?.size).toBe(0);
    endRender();
    expect(nativeStore(storeName(store))?.size).toBe(1);
  });

  it('keeps no key text in the store', () => {
    const {store} = launch();
    store.storeLineFit(KEY, {wordSize: 20, spaceExtra: 0});
    endRender();
    const keys = [...(nativeStore(storeName(store))?.keys() ?? [])];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^[0-9a-z]{1,11}$/);
  });
});

describe('a store from another bundle', () => {
  function storeOneFit(): StoreModule {
    const {store} = launch();
    store.storeLineFit(KEY, {wordSize: 20, spaceExtra: 1});
    endRender();
    return store;
  }

  it('a new update id starts empty and removes the old store', () => {
    const store = storeOneFit();
    const oldName = storeName(store);
    expect(nativeStore(oldName)?.size).toBe(1);

    mockBundle.updateId = UPDATE_B;
    const next = launch().store;
    expect(next.readStoredLineFit(KEY)).toBeUndefined();
    expect(mockNative.deleted).toEqual([oldName]);
    expect(nativeStore(oldName)).toBeUndefined();
    expect(nativeStore(POINTER)?.get('store')).toBe(storeName(next, UPDATE_B));
  });

  it('a new format starts empty and removes the old store', () => {
    // A store that an earlier LINE_FIT_FORMAT left, for the same update id.
    const {store} = launch();
    const oldName = store.lineFitStoreName(store.LINE_FIT_FORMAT - 1, UPDATE_A);
    expect(oldName).not.toBe(storeName(store));
    mockNative.stores.set(POINTER, new Map([['store', oldName]]));
    mockNative.stores.set(oldName, new Map([['hash', '20,1']]));

    expect(store.readStoredLineFit(KEY)).toBeUndefined();
    expect(mockNative.deleted).toEqual([oldName]);
    expect(nativeStore(oldName)).toBeUndefined();
    expect(nativeStore(POINTER)?.get('store')).toBe(storeName(store));
  });

  it('with updates off, a new build version starts empty', () => {
    mockBundle.updateId = null;
    const store = storeOneFit();
    const oldName = storeName(store, '2.3.0-1900');
    expect(nativeStore(oldName)?.size).toBe(1);

    mockBundle.version = {semanticVersion: '2.3.0', buildNumber: 1901};
    const next = launch().store;
    expect(next.readStoredLineFit(KEY)).toBeUndefined();
    expect(mockNative.deleted).toEqual([oldName]);
    expect(nativeStore(storeName(next, '2.3.0-1901'))).toBeDefined();
  });

  it('deletes nothing when the bundle stays the same', () => {
    storeOneFit();
    launch().store.readStoredLineFit(KEY);
    expect(mockNative.deleted).toEqual([]);
  });

  it('a failed delete keeps the pointer, and the next launch tries again', () => {
    const store = storeOneFit();
    const oldName = storeName(store);

    mockBundle.updateId = UPDATE_B;
    mockNative.failDelete = true;
    const failed = launch().store;
    expect(failed.readStoredLineFit(KEY)).toBeUndefined();
    expect(nativeStore(POINTER)?.get('store')).toBe(oldName);
    expect(nativeStore(storeName(failed, UPDATE_B))).toBeUndefined();

    mockNative.failDelete = false;
    launch().store.readStoredLineFit(KEY);
    expect(nativeStore(oldName)).toBeUndefined();
    expect(mockNative.deleted).toEqual([oldName]);
  });

  it("opens every instance in MMKV's own directory, so a delete finds it", () => {
    storeOneFit();
    expect(mockNative.configs.length).toBeGreaterThan(0);
    for (const config of mockNative.configs) expect(config.path).toBe('');
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
    const {store} = launch();
    expect(store.readStoredLineFit(KEY)).toBeUndefined(); // opens the store
    store.storeLineFit(KEY, {wordSize, spaceExtra});
    endRender();
    expect(nativeStore(storeName(store))?.size).toBe(0);
    expect(store.readStoredLineFit(KEY)).toBeUndefined();
  });

  it('stays in the session map only, as before', () => {
    const {store, space} = launch();
    expect(space.getLineFit(KEY)).toBeUndefined(); // opens the store
    const fit = {wordSize: 0, spaceExtra: 0};
    space.setLineFit(KEY, fit);
    endRender();
    expect(space.getLineFit(KEY)).toEqual(fit);
    expect(nativeStore(storeName(store))?.size).toBe(0);
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
    const {store} = launch();
    store.storeLineFit(KEY, {wordSize: 20, spaceExtra: 1});
    endRender();
    const data = nativeStore(storeName(store)) as Map<string, unknown>;
    const [hash] = [...data.keys()];
    data.set(hash, bad);
    expect(launch().store.readStoredLineFit(KEY)).toBeUndefined();
    expect(launch().space.getLineFit(KEY)).toBeUndefined();
  });

  it('a new measure replaces a bad stored value', () => {
    const {store} = launch();
    store.storeLineFit(KEY, {wordSize: 20, spaceExtra: 1});
    endRender();
    const data = nativeStore(storeName(store)) as Map<string, unknown>;
    data.set([...data.keys()][0], 'NaN,1');

    const next = launch().store;
    next.storeLineFit(KEY, {wordSize: 21, spaceExtra: 0});
    endRender();
    expect(next.readStoredLineFit(KEY)).toEqual({wordSize: 21, spaceExtra: 0});
    expect(data.size).toBe(1);
  });
});

describe('the limits of the store', () => {
  it('starts again at the launch after it passes the limit', () => {
    const {store} = launch();
    const name = storeName(store);
    const full = new Map<string, unknown>();
    for (let i = 0; i <= store.LINE_FIT_STORE_LIMIT; i++) {
      full.set(`k${i}`, '20,1');
    }
    mockNative.stores.set(POINTER, new Map([['store', name]]));
    mockNative.stores.set(name, full);

    store.readStoredLineFit(KEY);
    expect(full.size).toBe(0);
  });

  it('keeps a store at the limit', () => {
    const {store} = launch();
    const name = storeName(store);
    const full = new Map<string, unknown>();
    for (let i = 0; i < store.LINE_FIT_STORE_LIMIT; i++) {
      full.set(`k${i}`, '20,1');
    }
    mockNative.stores.set(POINTER, new Map([['store', name]]));
    mockNative.stores.set(name, full);

    store.readStoredLineFit(KEY);
    expect(full.size).toBe(store.LINE_FIT_STORE_LIMIT);
  });

  it('writes once for each key of a render', () => {
    const {store} = launch();
    store.storeLineFit(KEY, {wordSize: 20, spaceExtra: 0});
    store.storeLineFit(KEY, {wordSize: 21, spaceExtra: 0});
    store.storeLineFit(`${KEY}x`, {wordSize: 22, spaceExtra: 0});
    expect(jest.getTimerCount()).toBe(1);
    endRender();
    expect(nativeStore(storeName(store))?.size).toBe(2);
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
    expect(mockNative.stores.size).toBe(0);
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
    expect(mockNative.stores.size).toBe(0);
  });

  it('a native failure at the open only turns the store off', () => {
    mockNative.failCreate = true;
    const {store, space} = launch();
    expect(store.readStoredLineFit(KEY)).toBeUndefined();
    expect(() => {
      space.setLineFit(KEY, {wordSize: 20, spaceExtra: 1});
      endRender();
    }).not.toThrow();
    expect(space.getLineFit(KEY)).toEqual({wordSize: 20, spaceExtra: 1});
  });

  it('a native failure at a write loses the fits of that write only', () => {
    const {store} = launch();
    expect(store.readStoredLineFit(KEY)).toBeUndefined(); // opens the store
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
