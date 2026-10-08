/**
 * DigitalKhattDataService: delivery of corrected DBs to installed apps
 * (content-addressed copies + stale-copy cleanup), atomic and serialized
 * rewayah switching, error handling, and the side cache.
 *
 * expo-sqlite is replaced by an in-memory fake that mirrors the native
 * behaviour of expo-sqlite 56 (ios/SQLiteModule.swift, android SQLiteModule.kt):
 * - importDatabaseFromAssetAsync is a no-op when the target file exists;
 * - openDatabaseAsync creates a missing file (empty, no tables);
 * - deleteDatabaseAsync throws when the file is open or missing.
 * Every word DB holds the same 12 word slots (Hafs ids/locations) with text
 * tagged by its rewayah (H1.., W1.., Q1..), or "old-" text for copies an
 * older release left on the device.
 */
import {REWAYAH_DATA_MANIFEST} from '../rewayahDataManifest';
import {
  contentAddressedDbName,
  dbBaseName,
  DigitalKhattDataService,
  isRewayahSwitchSuperseded,
  RewayahLoadError,
  RewayahSwitchSupersededError,
  selectStaleDbFiles,
  type DKLine,
} from '../DigitalKhattDataService';

interface FakeFile {
  base: string;
  version: 'asset' | 'old' | 'none';
  state: 'ok' | 'empty';
}

interface FakeSqliteState {
  files: Map<string, FakeFile>;
  open: Map<string, number>;
  log: string[];
  violations: string[];
  gates: Map<string, Promise<void>>;
  readFailures: Map<string, number>;
}

jest.mock('expo-sqlite', () => {
  const state: FakeSqliteState = {
    files: new Map(),
    open: new Map(),
    log: [],
    violations: [],
    gates: new Map(),
    readFailures: new Map(),
  };
  const baseOf = (name: string) =>
    name.replace(/\.db$/, '').replace(/\.[0-9a-f]{8}$/, '');
  const openCount = (name: string) => state.open.get(name) ?? 0;
  return {
    __fake: state,
    defaultDatabaseDirectory: '/data/user/0/app.test/files/SQLite',
    async openDatabaseAsync(name: string) {
      state.log.push(`open:${name}`);
      if (!state.files.has(name)) {
        state.files.set(name, {
          base: baseOf(name),
          version: 'none',
          state: 'empty',
        });
      }
      state.open.set(name, openCount(name) + 1);
      let closed = false;
      return {
        async getFirstAsync(sql: string) {
          const file = state.files.get(name);
          if (!file || file.state === 'empty') return null;
          const table = /name='(\w+)'/.exec(sql)?.[1];
          const has =
            file.base === 'dk_layout' ? table === 'pages' : table === 'words';
          return has ? {name: table} : null;
        },
        async getAllAsync(sql: string) {
          const file = state.files.get(name);
          if (!file) throw new Error(`no such file ${name}`);
          const held = state.gates.get(file.base);
          if (held) await held;
          const failures = state.readFailures.get(file.base) ?? 0;
          if (failures > 0) {
            state.readFailures.set(file.base, failures - 1);
            throw new Error('database disk image is malformed');
          }
          if (file.state !== 'ok') throw new Error('no such table');
          state.log.push(`read:${name}`);
          return sql.includes('FROM pages')
            ? mockPageRows()
            : mockWordRows(file.base, file.version);
        },
        async closeAsync() {
          if (closed) throw new Error('already closed');
          closed = true;
          state.open.set(name, openCount(name) - 1);
          if (openCount(name) <= 0) state.open.delete(name);
        },
      };
    },
    async importDatabaseFromAssetAsync(
      name: string,
      source: {assetId: unknown},
    ) {
      state.log.push(`import:${name}`);
      if (state.files.has(name)) return; // native: no-op when the file exists
      if (source?.assetId === undefined) throw new Error('missing assetId');
      state.files.set(name, {
        base: baseOf(name),
        version: 'asset',
        state: 'ok',
      });
    },
    async deleteDatabaseAsync(name: string) {
      state.log.push(`delete:${name}`);
      if (openCount(name) > 0) {
        state.violations.push(name);
        throw new Error(`DeleteDatabaseException: ${name} is open`);
      }
      if (!state.files.has(name)) {
        throw new Error(`DatabaseNotFoundException: ${name}`);
      }
      state.files.delete(name);
    },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app.test/files/',
  readDirectoryAsync: jest.fn(async (uri: string) => {
    if (uri !== 'file:///data/user/0/app.test/files/SQLite/') {
      throw new Error(`unexpected directory ${uri}`);
    }
    const sqlite = jest.requireMock('expo-sqlite') as {
      __fake: FakeSqliteState;
    };
    return [...sqlite.__fake.files.keys()];
  }),
}));

jest.mock('@/store/mushafSettingsStore', () => {
  // @ai-start
  // Mirrors the real store's rewayah rules: setRewayah is refused under
  // qcf_v2, and showing a non-Hafs rewayah ends a startup fallback.
  const state = {
    rewayah: 'hafs',
    mushafRenderer: 'dk_v2',
    rewayahFallbackFrom: null as string | null,
    setRewayah: jest.fn((rewayah: string) => {
      if (state.mushafRenderer === 'qcf_v2') return;
      state.rewayah = rewayah;
      if (rewayah !== 'hafs') state.rewayahFallbackFrom = null;
    }),
    startRewayahFallback: jest.fn((from: string) => {
      if (from !== 'hafs' && state.mushafRenderer !== 'qcf_v2') {
        state.rewayahFallbackFrom = from;
      }
    }),
    clearRewayahFallback: jest.fn(() => {
      state.rewayahFallbackFrom = null;
    }),
  };
  // @ai-end
  return {
    useMushafSettingsStore: {
      getState: () => state,
      subscribe: () => () => undefined, // @ai
    },
    rendererPinsHafs: (renderer: string) => renderer === 'qcf_v2', // @ai
    __state: state,
  };
});

const WORD_LOCATIONS = [
  '1:1:1',
  '1:1:2',
  '1:1:3',
  '1:1:4',
  '1:2:1',
  '1:2:2',
  '1:2:3',
  '1:2:4',
  '2:1:1',
  '2:1:2',
  '2:2:1',
  '2:2:2',
];

const PREFIX: Record<string, string> = {
  dk_words: 'H',
  dk_words_warsh: 'W',
  dk_words_qaloon: 'Q',
  dk_words_shouba: 'S',
  dk_words_bazzi: 'B',
  dk_words_qumbul: 'K',
  dk_words_doori: 'D',
  dk_words_soosi: 'O',
};

function mockWordRows(base: string, version: string) {
  const prefix = `${version === 'old' ? 'old-' : ''}${PREFIX[base] ?? '?'}`;
  return WORD_LOCATIONS.map((location, i) => ({
    id: i + 1,
    text: `${prefix}${i + 1}`,
    location,
  }));
}

function line(
  page: number,
  lineNumber: number,
  type: DKLine['line_type'],
  first: number,
  last: number,
  surah: number,
): DKLine {
  return {
    page_number: page,
    line_number: lineNumber,
    line_type: type,
    is_centered: 0,
    first_word_id: first,
    last_word_id: last,
    surah_number: surah,
  };
}

function mockPageRows(): DKLine[] {
  return [
    line(1, 1, 'surah_name', 0, 0, 1),
    line(1, 2, 'ayah', 1, 4, 1),
    line(1, 3, 'ayah', 5, 8, 1),
    line(2, 1, 'surah_name', 0, 0, 2),
    line(2, 2, 'ayah', 9, 10, 2),
    line(2, 3, 'ayah', 11, 12, 2),
  ];
}

const fake = (jest.requireMock('expo-sqlite') as {__fake: FakeSqliteState})
  .__fake;
const store = (
  jest.requireMock('@/store/mushafSettingsStore') as {
    __state: {
      rewayah: string;
      mushafRenderer: string;
      setRewayah: jest.Mock;
      // @ai-start
      rewayahFallbackFrom: string | null;
      startRewayahFallback: jest.Mock;
      clearRewayahFallback: jest.Mock;
      // @ai-end
    };
  }
).__state;

type AssetFile = keyof typeof REWAYAH_DATA_MANIFEST;
const sha8 = (file: AssetFile) => REWAYAH_DATA_MANIFEST[file].slice(0, 8);
const copyName = (dbName: string, file: AssetFile) =>
  contentAddressedDbName(dbName, REWAYAH_DATA_MANIFEST[file]);

const N = {
  hafs: copyName('dk_words.db', 'digital-khatt-v2.db'),
  layout: copyName('dk_layout.db', 'digital-khatt-15-lines.db'),
  warsh: copyName('dk_words_warsh.db', 'dk_words_warsh.db'),
  qaloon: copyName('dk_words_qaloon.db', 'dk_words_qaloon.db'),
};

const H = ['H1', 'H2', 'H3', 'H4'];
const W = ['W1', 'W2', 'W3', 'W4'];

function seed(name: string, base: string, version: FakeFile['version']) {
  fake.files.set(name, {base, version, state: 'ok'});
}

// Holds every read of `base` until the returned function is called.
function gate(base: string): () => void {
  let release: () => void = () => undefined;
  const promise = new Promise<void>(resolve => {
    release = () => {
      fake.gates.delete(base);
      resolve();
    };
  });
  fake.gates.set(base, promise);
  return release;
}

async function flush(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

function texts(
  service: DigitalKhattDataService,
  verseKey: string,
  rewayah?: Parameters<DigitalKhattDataService['getVerseWords']>[1],
): string[] {
  return service.getVerseWords(verseKey, rewayah).map(w => w.text);
}

function count(entry: string): number {
  return fake.log.filter(e => e === entry).length;
}

async function initialized(): Promise<DigitalKhattDataService> {
  const service = new DigitalKhattDataService();
  await service.initialize();
  return service;
}

let consoleSpies: jest.SpyInstance[] = [];

beforeEach(() => {
  fake.files.clear();
  fake.open.clear();
  fake.log.length = 0;
  fake.violations.length = 0;
  fake.gates.clear();
  fake.readFailures.clear();
  store.rewayah = 'hafs';
  store.mushafRenderer = 'dk_v2';
  store.setRewayah.mockClear();
  // @ai-start
  store.rewayahFallbackFrom = null;
  store.startRewayahFallback.mockClear();
  store.clearRewayahFallback.mockClear();
  // @ai-end
  consoleSpies = [
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
    jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    jest.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
});

afterEach(async () => {
  await flush();
  for (const spy of consoleSpies) spy.mockRestore();
  // The service never tries to delete a DB that is open.
  expect(fake.violations).toEqual([]);
});

describe('content-addressed copies', () => {
  it('names on-device copies <base>.<sha8>.db', () => {
    expect(dbBaseName('dk_words_warsh.db')).toBe('dk_words_warsh');
    expect(
      contentAddressedDbName('dk_words_warsh.db', 'ABCDEF0123456789'),
    ).toBe('dk_words_warsh.abcdef01.db');
    expect(() => contentAddressedDbName('dk_words.db', 'not-a-hash')).toThrow();
    expect(N.hafs).toBe(`dk_words.${sha8('digital-khatt-v2.db')}.db`);
  });

  it('selects only stale copies (and their sidecars) of known bases', () => {
    const current = new Map([
      ['dk_words', 'dk_words.11111111.db'],
      ['dk_words_warsh', 'dk_words_warsh.22222222.db'],
      ['dk_layout', 'dk_layout.33333333.db'],
    ]);
    const listing = [
      'dk_words.db', // legacy Hafs copy
      'dk_words.11111111.db', // current
      'dk_words.aaaaaaaa.db', // another data version
      'dk_words.aaaaaaaa.db-journal', // its sidecar
      'dk_words.11111111.db-wal', // sidecar of the current copy
      'dk_words_warsh.db', // legacy Warsh copy
      'dk_words_warsh.22222222.db', // current
      'dk_words_warsh.bbbbbbbb.db', // stale but busy
      'dk_words_warsh.db-shm', // sidecar of the legacy copy
      'dk_layout.db', // legacy layout copy
      'dk_words_qaloon.db', // base not being swept
      'dk_words_warshx.db', // different base
      'dk_words.ABCDEF12.db', // not a content hash
      'dk_words.1111111.db', // 7 hex chars: not a content hash
      'playlists.db',
      'wbw-en.db',
      'timestamps_v3.db',
      'notes.txt',
    ];
    expect(
      selectStaleDbFiles(
        listing,
        current,
        new Set(['dk_words_warsh.bbbbbbbb.db']),
      ),
    ).toEqual([
      'dk_words.db',
      'dk_words.aaaaaaaa.db',
      'dk_words.aaaaaaaa.db-journal',
      'dk_words_warsh.db',
      'dk_words_warsh.db-shm',
      'dk_layout.db',
    ]);
  });
});

describe('delivery to installed apps', () => {
  it('imports content-addressed copies on a fresh install', async () => {
    const service = await initialized();
    expect(service.initialized).toBe(true);
    expect(texts(service, '1:1')).toEqual(H);
    expect(count(`import:${N.hafs}`)).toBe(1);
    expect(count(`import:${N.layout}`)).toBe(1);
    const touched = fake.log.filter(
      e => e.startsWith('open:') || e.startsWith('import:'),
    );
    expect(touched.every(e => /\.[0-9a-f]{8}\.db$/.test(e))).toBe(true);
    expect(service.getDataIdentity()).toEqual({
      rewayah: 'hafs',
      wordsSha8: sha8('digital-khatt-v2.db'),
      layoutSha8: sha8('digital-khatt-15-lines.db'),
    });
  });

  it('replaces the copies an older release left behind, then removes them', async () => {
    // A device upgraded from a release that imported unversioned copies.
    seed('dk_words.db', 'dk_words', 'old');
    seed('dk_layout.db', 'dk_layout', 'old');
    seed('dk_words_warsh.db', 'dk_words_warsh', 'old');
    seed('dk_words_warsh.0badc0de.db', 'dk_words_warsh', 'old');
    seed('dk_words_warsh.db-journal', 'dk_words_warsh', 'old');
    seed('dk_words_qaloon.db', 'dk_words_qaloon', 'old'); // not opened now
    seed('wbw-en.db', 'wbw-en', 'old');
    seed('playlists.db', 'playlists', 'old');
    store.rewayah = 'warsh';

    const service = await initialized();
    expect(service.rewayah).toBe('warsh');
    expect(texts(service, '1:1')).toEqual(W); // not 'old-W1'...
    expect(count('open:dk_words_warsh.db')).toBe(0);

    await flush();
    expect([...fake.files.keys()].sort()).toEqual(
      [N.layout, N.warsh, 'playlists.db', 'wbw-en.db'].sort(),
    );
  });

  it('never deletes the copy a loader has open', async () => {
    seed('dk_words_warsh.db', 'dk_words_warsh', 'old');
    const service = new DigitalKhattDataService();
    const release = gate('dk_words_warsh');
    const side = service.ensureRewayahLoaded('warsh');
    await flush();
    expect(fake.open.get(N.warsh)).toBe(1);

    await service.initialize(); // commits Hafs and sweeps every base
    await flush();
    expect(fake.files.has('dk_words_warsh.db')).toBe(false);
    expect(fake.files.has(N.warsh)).toBe(true);

    release();
    await side;
    expect(texts(service, '1:1', 'warsh')).toEqual(W);
  });

  it('leaves a stale copy that something else holds open and keeps sweeping', async () => {
    seed('dk_words.db', 'dk_words', 'old');
    seed('dk_layout.db', 'dk_layout', 'old');
    fake.open.set('dk_words.db', 1);
    await initialized();
    await flush();
    expect(fake.files.has('dk_words.db')).toBe(true); // SQLite refused
    expect(fake.files.has('dk_layout.db')).toBe(false);
    fake.violations.length = 0; // that refusal is SQLite's, by design
    fake.open.delete('dk_words.db');
  });

  it('re-imports once when the existing copy cannot be read', async () => {
    const service = await initialized();
    seed(N.warsh, 'dk_words_warsh', 'asset');
    fake.readFailures.set('dk_words_warsh', 1);
    await service.switchRewayah('warsh');
    expect(service.rewayah).toBe('warsh');
    expect(texts(service, '1:1')).toEqual(W);
    expect(count(`delete:${N.warsh}`)).toBeGreaterThanOrEqual(1);
    expect(count(`import:${N.warsh}`)).toBe(1);
  });

  it('keeps the previous rewayah intact and reports the error when a DB stays unreadable', async () => {
    const service = await initialized();
    const listener = jest.fn();
    service.onRewayahChange(listener);
    const version = service.getCacheVersion();
    fake.readFailures.set('dk_words_warsh', Infinity);

    const failed = service.switchRewayah('warsh');
    await expect(failed).rejects.toBeInstanceOf(RewayahLoadError);
    await expect(failed).rejects.toMatchObject({rewayah: 'warsh'});
    expect(count(`import:${N.warsh}`)).toBe(2); // first try + one re-import
    expect(service.rewayah).toBe('hafs');
    expect(texts(service, '1:1')).toEqual(H);
    expect(service.getPageLines(1)).toHaveLength(3);
    expect(service.getRewayahLoadState('warsh')).toBe('error');
    expect(service.getRewayahLoadError('warsh')).not.toBeNull();
    expect(service.getCacheVersion()).toBeGreaterThan(version);
    expect(listener).not.toHaveBeenCalled();
    expect(store.rewayah).toBe('hafs');

    // Retrying once the file is readable works.
    fake.readFailures.delete('dk_words_warsh');
    await service.switchRewayah('warsh');
    expect(service.rewayah).toBe('warsh');
    expect(service.getRewayahLoadState('warsh')).toBe('ready');
    expect(service.getRewayahLoadError('warsh')).toBeNull();
  });
});

describe('switchRewayah', () => {
  it('serves the previous rewayah, intact, until the new one commits atomically', async () => {
    const service = await initialized();
    const events: string[] = [];
    service.onRewayahChange(rewayah =>
      events.push(
        `rewayah:${rewayah}:${service.rewayah}:${
          texts(service, '1:1')[0]
        }:${service.getCacheVersion()}`,
      ),
    );
    service.subscribeCacheChanges(() =>
      events.push(`cache:${service.getCacheVersion()}`),
    );
    const version = service.getCacheVersion();
    const release = gate('dk_words_warsh');

    const switching = service.switchRewayah('warsh');
    await flush();
    expect(service.isSwitching).toBe(true);
    expect(service.pendingRewayah).toBe('warsh');
    expect(service.rewayah).toBe('hafs');
    expect(texts(service, '1:1')).toEqual(H);
    expect(service.getLineText(service.getPageLines(1)[1])).toBe('H1 H2 H3 H4');
    expect(service.getPageForVerse('2:1')).toBe(2);
    expect(service.getRewayahLoadState('warsh')).toBe('loading');
    expect(service.getCacheVersion()).toBe(version);
    expect(store.rewayah).toBe('hafs');

    release();
    await switching;
    expect(service.rewayah).toBe('warsh');
    expect(service.isSwitching).toBe(false);
    expect(texts(service, '1:1')).toEqual(W);
    expect(service.getVerseWords('1:2')).toHaveLength(4);
    expect(service.getLineText(service.getPageLines(2)[1])).toBe('W9 W10');
    expect(service.getPageForVerse('2:1')).toBe(2);
    expect(service.getCacheVersion()).toBe(version + 1);
    expect(store.rewayah).toBe('warsh');
    expect(service.getLayoutIdentityKey()).toBe(
      `warsh@${sha8('dk_words_warsh.db')}.${sha8('digital-khatt-15-lines.db')}`,
    );
    // Shared layout DB: not read again.
    expect(count(`read:${N.layout}`)).toBe(1);
    // Listener first (after the swap, version already bumped), then cache
    // subscribers; each exactly once.
    expect(events).toEqual([
      `rewayah:warsh:warsh:W1:${version + 1}`,
      `cache:${version + 1}`,
    ]);
  });

  it.each([
    ['the first load is slow', 'dk_words_warsh'],
    ['the second load is slow', 'dk_words_qaloon'],
  ])('lets the latest request win when %s', async (_label, slowBase) => {
    const service = await initialized();
    const listener = jest.fn();
    service.onRewayahChange(listener);
    const release = gate(slowBase);

    // Second tap lands while the Warsh load is still in flight.
    const toWarsh = service.switchRewayah('warsh');
    const warshOutcome = toWarsh.catch((error: unknown) => error);
    await Promise.resolve();
    expect(service.pendingRewayah).toBe('warsh');
    const toQalun = service.switchRewayah('qalun');
    const error = await warshOutcome;
    expect(error).toBeInstanceOf(RewayahSwitchSupersededError);
    expect(isRewayahSwitchSuperseded(error)).toBe(true);

    release();
    await toQalun;
    expect(service.rewayah).toBe('qalun');
    expect(listener.mock.calls).toEqual([['qalun']]);
    for (const verseKey of ['1:1', '1:2', '2:1', '2:2']) {
      const words = texts(service, verseKey);
      expect(words.every(t => t.startsWith('Q'))).toBe(true);
    }
    expect(service.getVerseWords('1:1')).toHaveLength(4);
    expect(store.rewayah).toBe('qalun');
  });

  it('shares one load between repeated requests for the same rewayah', async () => {
    const service = await initialized();
    const release = gate('dk_words_warsh');
    const first = service.switchRewayah('warsh');
    const second = service.switchRewayah('warsh');
    await flush();
    expect(service.rewayah).toBe('hafs');
    release();
    await Promise.all([first, second]);
    expect(service.rewayah).toBe('warsh');
    expect(count(`read:${N.warsh}`)).toBe(1);
  });

  it('re-selecting the active rewayah resolves at once and cancels the pending switch', async () => {
    const service = await initialized();
    const release = gate('dk_words_warsh');
    const toWarsh = service.switchRewayah('warsh');
    const warshOutcome = toWarsh.catch((error: unknown) => error);
    await flush();
    await service.switchRewayah('hafs');
    expect(await warshOutcome).toBeInstanceOf(RewayahSwitchSupersededError);
    release();
    await flush();
    expect(service.rewayah).toBe('hafs');
    expect(service.isSwitching).toBe(false);
    expect(texts(service, '1:1')).toEqual(H);
  });

  it('a switch before initialize() loads a complete cache without doubling words', async () => {
    const service = new DigitalKhattDataService();
    await service.switchRewayah('warsh');
    expect(service.initialized).toBe(true);
    expect(service.getPageLines(1)).toHaveLength(3);
    expect(service.getSurahStartPages()).toEqual({1: 1, 2: 2});
    await service.initialize(); // already initialized: no-op
    expect(service.rewayah).toBe('warsh');
    expect(service.getVerseWords('1:1')).toHaveLength(4);
    expect(store.rewayah).toBe('warsh');
  });

  it('a switch requested while initialization loads wins, and initialize() settles on it', async () => {
    store.rewayah = 'warsh';
    const service = new DigitalKhattDataService();
    const release = gate('dk_words_warsh');
    const init = service.initialize();
    await flush();
    const toQalun = service.switchRewayah('qalun');
    release();
    await Promise.all([init, toQalun]);
    expect(service.rewayah).toBe('qalun');
    expect(store.rewayah).toBe('qalun');
    expect(service.getVerseWords('1:1')).toHaveLength(4);
    expect(texts(service, '1:1')[0]).toBe('Q1');
  });

  it('never caches an empty verse→page map', async () => {
    const service = new DigitalKhattDataService();
    expect(service.getPageForVerse('2:1')).toBeUndefined();
    await service.initialize();
    expect(service.getPageForVerse('2:1')).toBe(2);
    const release = gate('dk_words_warsh');
    const switching = service.switchRewayah('warsh');
    await flush();
    expect(service.getPageForVerse('2:2')).toBe(2);
    release();
    await switching;
    expect(service.getPageForVerse('1:2')).toBe(1);
    expect(service.getPageForVerse('2:2')).toBe(2);
  });

  it('bumps the cache version on init, switch, side load and failed side load', async () => {
    const service = new DigitalKhattDataService();
    const versions = [service.getCacheVersion()];
    await service.initialize();
    versions.push(service.getCacheVersion());
    await service.switchRewayah('warsh');
    versions.push(service.getCacheVersion());
    await service.ensureRewayahLoaded('qalun');
    versions.push(service.getCacheVersion());
    fake.readFailures.set('dk_words_bazzi', Infinity);
    await expect(service.ensureRewayahLoaded('al-bazzi')).rejects.toThrow();
    versions.push(service.getCacheVersion());
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).toBeGreaterThan(versions[i - 1]);
    }
  });
});

describe('initialization failures', () => {
  // @ai-start
  it('falls back to Hafs when the persisted rewayah cannot load, keeping the saved rewayah', async () => {
    store.rewayah = 'warsh';
    fake.readFailures.set('dk_words_warsh', Infinity);
    const service = await initialized();
    expect(service.rewayah).toBe('hafs');
    expect(texts(service, '1:1')).toEqual(H);
    expect(service.getRewayahLoadState('warsh')).toBe('error');
    // The label names the Hafs on screen; the saved Warsh is recorded as a
    // fallback (which the real store persists instead of Hafs) before the
    // commit relabels the store.
    expect(store.rewayah).toBe('hafs');
    expect(store.rewayahFallbackFrom).toBe('warsh');
    expect(store.startRewayahFallback).toHaveBeenCalledWith('warsh');
    expect(store.setRewayah).toHaveBeenCalledWith('hafs');
    expect(store.startRewayahFallback.mock.invocationCallOrder[0]).toBeLessThan(
      store.setRewayah.mock.invocationCallOrder[0],
    );
  });

  it('retries the saved rewayah on demand after a startup fallback', async () => {
    store.rewayah = 'warsh';
    fake.readFailures.set('dk_words_warsh', 2);
    const service = await initialized();
    expect(store.rewayahFallbackFrom).toBe('warsh');

    await service.switchRewayah('warsh');
    expect(service.rewayah).toBe('warsh');
    expect(texts(service, '1:1')).toEqual(W);
    expect(store.rewayah).toBe('warsh');
    expect(store.rewayahFallbackFrom).toBeNull();
  });

  it('records no fallback when Hafs cannot load either', async () => {
    store.rewayah = 'warsh';
    fake.readFailures.set('dk_words_warsh', Infinity);
    fake.readFailures.set('dk_words', Infinity);
    const service = new DigitalKhattDataService();
    await expect(service.initialize()).rejects.toBeInstanceOf(RewayahLoadError);
    expect(service.initialized).toBe(false);
    // Nothing is on screen: the saved rewayah stays, with no Hafs notice.
    expect(store.rewayah).toBe('warsh');
    expect(store.rewayahFallbackFrom).toBeNull();
  });

  it('starts with Hafs and no fallback when the persisted rewayah has no bundled text', async () => {
    store.rewayah = 'hisham';
    const service = await initialized();
    expect(service.rewayah).toBe('hafs');
    expect(store.rewayah).toBe('hafs');
    expect(store.startRewayahFallback).not.toHaveBeenCalled();
  });

  it('records no fallback when the persisted rewayah loads', async () => {
    store.rewayah = 'warsh';
    const service = await initialized();
    expect(service.rewayah).toBe('warsh');
    expect(store.startRewayahFallback).not.toHaveBeenCalled();
    expect(store.rewayahFallbackFrom).toBeNull();
  });
  // @ai-end

  it('rejects when Hafs cannot load, then can be retried', async () => {
    fake.readFailures.set('dk_words', Infinity);
    const service = new DigitalKhattDataService();
    await expect(service.initialize()).rejects.toBeInstanceOf(RewayahLoadError);
    expect(service.initialized).toBe(false);
    expect(service.getLayoutIdentityKey()).toBeNull();
    expect(service.getPageForVerse('1:1')).toBeUndefined();

    fake.readFailures.delete('dk_words');
    await service.initialize();
    expect(service.initialized).toBe(true);
    expect(service.getPageForVerse('2:2')).toBe(2);
  });

  it('recovers through a switch after a failed initialization (words and layout)', async () => {
    fake.readFailures.set('dk_words', Infinity);
    const service = new DigitalKhattDataService();
    await expect(service.initialize()).rejects.toThrow();
    await service.switchRewayah('warsh');
    expect(service.initialized).toBe(true);
    expect(service.getPageLines(2)).toHaveLength(3);
    expect(texts(service, '2:2')).toEqual(['W11', 'W12']);
  });
});

describe('side cache', () => {
  it('loads another rewayah without touching the active one and notifies when ready', async () => {
    const service = await initialized();
    const notified = jest.fn();
    service.subscribeCacheChanges(notified);
    expect(service.getRewayahLoadState('warsh')).toBe('idle');
    expect(service.tryGetVerseWords('1:1', 'warsh')).toBeNull();

    const release = gate('dk_words_warsh');
    const load = service.ensureRewayahLoaded('warsh');
    await flush();
    expect(service.getRewayahLoadState('warsh')).toBe('loading');
    expect(service.tryGetVerseText('1:1', 'warsh')).toBeNull();
    release();
    await load;

    expect(notified).toHaveBeenCalledTimes(1);
    expect(service.rewayah).toBe('hafs');
    expect(texts(service, '1:1')).toEqual(H);
    expect(service.tryGetVerseWords('1:1', 'warsh')?.map(w => w.text)).toEqual(
      W,
    );
    expect(service.tryGetVerseText('1:1', 'warsh')).toBe('W1 W2 W3 W4');
  });

  it('reports a failed load as an error and never substitutes another text', async () => {
    const service = await initialized();
    const notified = jest.fn();
    service.subscribeCacheChanges(notified);
    fake.readFailures.set('dk_words_warsh', Infinity);

    await expect(service.ensureRewayahLoaded('warsh')).rejects.toThrow();
    expect(notified).toHaveBeenCalled();
    expect(service.getRewayahLoadState('warsh')).toBe('error');
    expect(service.tryGetVerseWords('1:1', 'warsh')).toBeNull();
    expect(service.tryGetVerseText('1:1', 'warsh')).toBeNull();
    expect(service.getVerseWords('1:1', 'warsh')).toEqual([]);

    fake.readFailures.delete('dk_words_warsh');
    await service.ensureRewayahLoaded('warsh'); // explicit retry
    expect(service.getRewayahLoadState('warsh')).toBe('ready');
  });

  it('rejects rewayat without bundled text', async () => {
    const service = await initialized();
    expect(service.getRewayahLoadState('hisham')).toBe('unavailable');
    await expect(service.ensureRewayahLoaded('hisham')).rejects.toThrow(
      /No text data bundled/,
    );
  });

  it('waits for the main load of the same rewayah instead of reading it twice', async () => {
    store.rewayah = 'warsh';
    const service = new DigitalKhattDataService();
    const release = gate('dk_words_warsh');
    const init = service.initialize();
    await flush();
    expect(service.getRewayahLoadState('warsh')).toBe('loading');
    const side = service.ensureRewayahLoaded('warsh');
    release();
    await Promise.all([init, side]);
    expect(service.rewayah).toBe('warsh');
    expect(count(`read:${N.warsh}`)).toBe(1);
  });

  it('serializes a side load and a switch on the same DB (one import, both succeed)', async () => {
    const service = await initialized();
    const release = gate('dk_words_qaloon');
    const side = service.ensureRewayahLoaded('qalun');
    await flush();
    const switching = service.switchRewayah('qalun');
    await flush();
    release();
    await Promise.all([side, switching]);
    expect(service.rewayah).toBe('qalun');
    expect(count(`import:${N.qaloon}`)).toBe(1);
    expect(texts(service, '1:1')[0]).toBe('Q1');
  });

  it('keeps the previously active rewayah readable after a switch (one retained copy)', async () => {
    const service = await initialized();
    await service.switchRewayah('warsh');
    expect(service.getRewayahLoadState('hafs')).toBe('ready');
    expect(service.tryGetVerseWords('1:1', 'hafs')?.map(w => w.text)).toEqual(
      H,
    );

    await service.switchRewayah('qalun');
    expect(service.tryGetVerseWords('1:1', 'warsh')?.map(w => w.text)).toEqual(
      W,
    );
    expect(service.getRewayahLoadState('hafs')).toBe('idle');
  });

  it('pins a retained copy that a consumer requested explicitly', async () => {
    const service = await initialized();
    await service.switchRewayah('warsh');
    await service.ensureRewayahLoaded('hafs');
    await service.switchRewayah('qalun');
    expect(service.getRewayahLoadState('hafs')).toBe('ready');
    expect(service.getRewayahLoadState('warsh')).toBe('ready');
  });

  it('before initialization the placeholder rewayah waits for init instead of loading a copy', async () => {
    const service = new DigitalKhattDataService();
    expect(service.getRewayahLoadState('hafs')).toBe('loading');
    expect(service.tryGetVerseWords('1:1', 'hafs')).toBeNull();
    const ready = service.ensureRewayahLoaded('hafs');
    await flush();
    expect(fake.log.some(e => e.startsWith('open:'))).toBe(false);
    await service.initialize();
    await ready;
    expect(count(`read:${N.hafs}`)).toBe(1);
    expect(service.tryGetVerseWords('1:1', 'hafs')).toHaveLength(4);
  });
});

describe('resetDatabases', () => {
  it('deletes every managed copy, empties the caches and notifies', async () => {
    seed('dk_words_warsh.db', 'dk_words_warsh', 'old');
    seed('wbw-en.db', 'wbw-en', 'old');
    const service = await initialized();
    await service.ensureRewayahLoaded('warsh');
    const version = service.getCacheVersion();
    await service.resetDatabases();
    expect(service.initialized).toBe(false);
    expect(service.getVerseWords('1:1')).toEqual([]);
    expect(service.getLayoutIdentityKey()).toBeNull();
    expect([...fake.files.keys()]).toEqual(['wbw-en.db']);
    expect(service.getCacheVersion()).toBe(version + 1);

    await service.initialize();
    expect(texts(service, '1:1')).toEqual(H);
  });
});
