/**
 * MushafLayoutCacheService: persisted page layouts are filed under the data
 * identity of the text they were computed from (DigitalKhattDataService's
 * `<rewayah>@<wordsSha8>.<layoutSha8>`), never read or written before the data
 * service has loaded, validated before they are persisted or served, and
 * pruned when a data update retires their identity. Schema v10 drops every
 * v9 entry.
 */
type MockGlobals = typeof globalThis & {
  __mmkvStores?: Map<string, Map<string, unknown>>;
  __dkState?: {
    identity: string | null;
    lineCount: number;
    current: Map<string, string>;
  };
};
const globals = globalThis as MockGlobals;
// Shared with the mock factories below, which jest.isolateModules re-runs
// for every fresh copy of the service.
globals.__mmkvStores = globals.__mmkvStores ?? new Map();
globals.__dkState = globals.__dkState ?? {
  identity: null,
  lineCount: 3,
  current: new Map(),
};

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
        set: (key: string, value: unknown) => {
          data.set(key, value);
        },
        remove: (key: string) => data.delete(key),
        getAllKeys: () => [...data.keys()],
        clearAll: () => data.clear(),
      };
    },
  };
});

jest.mock('../DigitalKhattDataService', () => {
  const g = globalThis as MockGlobals;
  g.__dkState = g.__dkState ?? {
    identity: null,
    lineCount: 3,
    current: new Map(),
  };
  const state = g.__dkState;
  return {
    digitalKhattDataService: {
      getLayoutIdentityKey: () => state.identity,
      getPageLines: () => Array.from({length: state.lineCount}, () => ({})),
    },
    getRewayahDataIdentityKey: (rewayah: string) =>
      state.current.get(rewayah) ?? null,
  };
});

// The real module pulls in Skia; only its Map-aware JSON helpers are used.
jest.mock('../JustificationService', () => ({
  replacer: (_key: string, value: unknown) =>
    value instanceof Map
      ? {dataType: 'Map', value: Array.from(value.entries())}
      : value,
  reviver: (_key: string, value: unknown) => {
    const tagged = value as {dataType?: string; value?: [unknown, unknown][]};
    return tagged && typeof tagged === 'object' && tagged.dataType === 'Map'
      ? new Map(tagged.value)
      : value;
  },
}));

type CacheModule = typeof import('../MushafLayoutCacheService');

const ID_A = 'warsh@aaaaaaaa.bbbbbbbb';
const ID_B = 'warsh@cccccccc.bbbbbbbb';

function store(): Map<string, unknown> {
  const stores = globals.__mmkvStores as Map<string, Map<string, unknown>>;
  if (!stores.has('mushaf-layouts')) stores.set('mushaf-layouts', new Map());
  return stores.get('mushaf-layouts') as Map<string, unknown>;
}

function dk() {
  return globals.__dkState as NonNullable<MockGlobals['__dkState']>;
}

function loadModule(): CacheModule {
  let mod: CacheModule | undefined;
  jest.isolateModules(() => {
    mod = require('../MushafLayoutCacheService') as CacheModule;
  });
  return mod as CacheModule;
}

// Same Map encoding as JustificationService.replacer.
function serialize(data: unknown): string {
  return JSON.stringify(data, (_key, value: unknown) =>
    value instanceof Map
      ? {dataType: 'Map', value: Array.from(value.entries())}
      : value,
  );
}

function layout(lines = 3, spacing = 100) {
  return Array.from({length: lines}, () => ({
    fontFeatures: new Map([[0, [{name: 'cv01', value: 1}]]]),
    simpleSpacing: spacing,
    ayaSpacing: spacing,
    fontSizeRatio: 1,
  }));
}

let warnSpy: jest.SpyInstance;
let logSpy: jest.SpyInstance;

beforeEach(() => {
  store().clear();
  dk().identity = null;
  dk().lineCount = 3;
  dk().current = new Map([['warsh', ID_A]]);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
  logSpy.mockRestore();
});

describe('MushafLayoutCacheService', () => {
  it('neither reads nor writes before the data service has loaded', () => {
    const {mushafLayoutCacheService} = loadModule();
    mushafLayoutCacheService.setPageLayout(5, 'DigitalKhattV2', layout());
    expect([...store().keys()]).toEqual(['dk_schema_version']);
    expect(
      mushafLayoutCacheService.getPageLayout(5, 'DigitalKhattV2'),
    ).toBeUndefined();
  });

  it('files each layout under the identity of the text it was computed from', () => {
    const {mushafLayoutCacheService, layoutCacheKey} = loadModule();
    dk().identity = ID_A;
    mushafLayoutCacheService.setPageLayout(5, 'DigitalKhattV2', layout());
    expect(store().has(layoutCacheKey('DigitalKhattV2', ID_A, 5))).toBe(true);
    expect(layoutCacheKey('DigitalKhattV2', ID_A, 5)).toBe(
      `dk:DigitalKhattV2:${ID_A}:5`,
    );

    const hit = mushafLayoutCacheService.getPageLayout(5, 'DigitalKhattV2');
    expect(hit).toHaveLength(3);
    expect(hit?.[0].fontFeatures).toBeInstanceOf(Map);

    // Different text (a corrected DB, or another rewayah): miss.
    dk().identity = ID_B;
    expect(
      mushafLayoutCacheService.getPageLayout(5, 'DigitalKhattV2'),
    ).toBeUndefined();
    // Another font: miss.
    dk().identity = ID_A;
    expect(
      mushafLayoutCacheService.getPageLayout(5, 'DigitalKhattV1'),
    ).toBeUndefined();
    expect(
      mushafLayoutCacheService.getPageLayout(5, 'DigitalKhattV2'),
    ).toHaveLength(3);
  });

  it('refuses to persist unusable layouts', () => {
    const {mushafLayoutCacheService} = loadModule();
    dk().identity = ID_A;
    const infinite = layout(3, Infinity); // justification of an empty line
    mushafLayoutCacheService.setPageLayout(1, 'F', infinite);
    mushafLayoutCacheService.setPageLayout(2, 'F', layout(2)); // page has 3
    mushafLayoutCacheService.setPageLayout(3, 'F', []);
    const nanFeature = layout();
    nanFeature[1].fontFeatures = new Map([[4, [{name: 'cv01', value: NaN}]]]);
    mushafLayoutCacheService.setPageLayout(4, 'F', nanFeature);
    expect([...store().keys()]).toEqual(['dk_schema_version']);
  });

  it('drops a stored entry that is unusable instead of serving it', () => {
    const {mushafLayoutCacheService, layoutCacheKey} = loadModule();
    dk().identity = ID_A;
    const key = layoutCacheKey('F', ID_A, 7);
    store().set(
      key,
      JSON.stringify([
        {fontFeatures: {dataType: 'Map', value: []}, simpleSpacing: null},
      ]),
    );
    expect(mushafLayoutCacheService.getPageLayout(7, 'F')).toBeUndefined();
    expect(store().has(key)).toBe(false);
    store().set(key, '{not json');
    expect(mushafLayoutCacheService.getPageLayout(7, 'F')).toBeUndefined();
    expect(store().has(key)).toBe(false);
  });

  it('clears every v9 entry on the schema bump', () => {
    store().set('dk_schema_version', 9);
    store().set('dk:DigitalKhattV2:warsh:5', serialize(layout()));
    store().set('dk:DigitalKhattV2:hafs:1', serialize(layout()));
    loadModule();
    expect([...store().entries()]).toEqual([['dk_schema_version', 10]]);
  });

  it('prunes layouts whose data identity this build no longer ships', () => {
    store().set('dk_schema_version', 10);
    const keep = `dk:F:${ID_A}:5`;
    store().set(keep, serialize(layout()));
    store().set(`dk:F:${ID_B}:5`, 'x'); // older Warsh data version
    store().set('dk:F:zzz@11111111.22222222:1', 'x'); // unknown rewayah
    store().set('dk:malformed', 'x');
    store().set('unrelated', 'x');
    const {mushafLayoutCacheService} = loadModule();
    dk().identity = ID_A;
    // Pruning runs once, on first use.
    expect(mushafLayoutCacheService.getPageLayout(5, 'F')).toHaveLength(3);
    expect([...store().keys()].sort()).toEqual(
      ['dk_schema_version', keep, 'unrelated'].sort(),
    );
    expect(mushafLayoutCacheService.pruneStaleEntries()).toBe(0);
  });

  it('isUsablePageLayout checks structure, finiteness and line count', () => {
    const {isUsablePageLayout} = loadModule();
    expect(isUsablePageLayout(layout())).toBe(true);
    expect(isUsablePageLayout(layout(), 3)).toBe(true);
    expect(isUsablePageLayout(layout(), 4)).toBe(false);
    expect(isUsablePageLayout([])).toBe(false);
    expect(isUsablePageLayout(null)).toBe(false);
    expect(isUsablePageLayout([{...layout()[0], ayaSpacing: -Infinity}])).toBe(
      false,
    );
    expect(isUsablePageLayout([{...layout()[0], fontFeatures: {}}])).toBe(
      false,
    );
  });
});
