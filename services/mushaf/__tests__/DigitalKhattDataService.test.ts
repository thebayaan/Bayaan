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
import {
  LAYOUT_SOURCE_SHA256,
  REWAYAH_DATA_MANIFEST,
} from '../rewayahDataManifest';
import {
  BASMALLAH_TEXT, // @ai
  contentAddressedDbName,
  dataIdentityKey, // @ai
  dbBaseName,
  DigitalKhattDataService,
  getRewayahDataIdentity, // @ai
  getRewayahDataIdentityKey, // @ai
  isRewayahSwitchSuperseded,
  RewayahLoadError,
  RewayahSwitchSupersededError,
  selectStaleDbFiles,
  type DKLine,
} from '../DigitalKhattDataService';
import {rewayahBasmalaService} from '../RewayahBasmalaService'; // @ai
import {WordReadError} from '../wordStore'; // @ai
import {EXPECTED_BASMALA} from '../__fixtures__/basmalaTexts'; // @ai

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
  // @ai The next chunk read of a base throws, drops its last text, or holds a
  // word whose text is empty (a real value in 7 of the 8 words DBs).
  chunkFaults: Map<string, 'throw' | 'short' | 'blank'>;
}

// The generated tables, for this file's few words (see mockPageRows).
jest.mock('../mushafTables', () => ({
  loadVerseIndex: () =>
    jest
      .requireActual('../wordStore')
      .buildVerseIndex(mockVerseIndexRows(mockWordRows('dk_words', 'asset'))),
  loadPageLineRows: () => mockPageRows(),
}));

jest.mock('expo-sqlite', () => {
  const state: FakeSqliteState = {
    files: new Map(),
    open: new Map(),
    log: [],
    violations: [],
    gates: new Map(),
    readFailures: new Map(),
    chunkFaults: new Map(), // @ai
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
      // @ai-start
      // The words of an open copy (the WordStore's synchronous reads and its
      // integrity counts).
      const wordsOf = () => {
        const file = state.files.get(name);
        if (!file || file.state !== 'ok') throw new Error('no such table');
        return mockWordRows(file.base, file.version);
      };
      // @ai-end
      return {
        async getFirstAsync(sql: string) {
          const file = state.files.get(name);
          if (!file || file.state === 'empty') return null;
          // @ai-start
          // The integrity counts are the read of a load: gates and read
          // failures apply to them.
          if (sql.includes('COUNT(*)')) {
            const held = state.gates.get(file.base);
            if (held) await held;
            const failures = state.readFailures.get(file.base) ?? 0;
            if (failures > 0) {
              state.readFailures.set(file.base, failures - 1);
              throw new Error('database disk image is malformed');
            }
            const n = wordsOf().length;
            state.log.push(`read:${name}`);
            return {n, ids: n, texts: n, locations: n};
          }
          // @ai-end
          const table = /name='(\w+)'/.exec(sql)?.[1];
          const has = table === 'words';
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
          // @ai-start
          // @ai-end
          return mockWordRows(file.base, file.version);
        },
        // @ai-start
        // The WordStore's chunk read: the texts in id order, joined by U+001F.
        getFirstSync(_sql: string, params: unknown[] = []) {
          if (closed) throw new Error('database is closed');
          state.log.push(`chunk:${name}`);
          const base = state.files.get(name)?.base ?? '';
          const fault = state.chunkFaults.get(base);
          state.chunkFaults.delete(base);
          if (fault === 'throw') throw new Error('disk I/O error');
          const [from, to] = params.map(Number);
          const inRange = wordsOf()
            .filter(row => row.id >= from && row.id <= to)
            .sort((a, b) => a.id - b.id)
            .map(row => row.text);
          if (fault === 'short') inRange.pop();
          if (fault === 'blank') inRange[0] = '';
          return {texts: inRange.length ? inRange.join('\u001f') : null};
        },
        // @ai-end
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
  // qcf_v2, showing a non-Hafs rewayah ends a startup fallback, and starting
  // one names Hafs in the same update.
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
        state.rewayah = 'hafs';
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

// @ai-start
// The verse rows of the generated tables: the first and last id of each verse.
function mockVerseIndexRows(rows: {id: number; location: string}[]) {
  const verses = new Map<
    string,
    {surah: number; ayah: number; first: number; last: number}
  >();
  for (const row of rows) {
    const [surah, ayah] = row.location.split(':').map(Number);
    const key = `${surah}:${ayah}`;
    const verse = verses.get(key);
    if (verse) {
      verse.first = Math.min(verse.first, row.id);
      verse.last = Math.max(verse.last, row.id);
    } else {
      verses.set(key, {surah, ayah, first: row.id, last: row.id});
    }
  }
  return [...verses.values()].sort((a, b) => a.first - b.first);
}
// @ai-end

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

// @ai-start
// Like the layout DB, basmallah lines carry no surah number (NULL).
const NO_SURAH = null as unknown as number;
// Set by the basmallah-line tests: the layout then also has pages 3-4.
let mockWithBasmalaPages = false;
// @ai-end

function mockPageRows(): DKLine[] {
  return [
    line(1, 1, 'surah_name', 0, 0, 1),
    line(1, 2, 'ayah', 1, 4, 1),
    line(1, 3, 'ayah', 5, 8, 1),
    line(2, 1, 'surah_name', 0, 0, 2),
    line(2, 2, 'ayah', 9, 10, 2),
    line(2, 3, 'ayah', 11, 12, 2),
    // @ai-start
    // Basmallah lines: one under its header, one at the top of the page
    // after its header (al-Susi writes the basmala of surah 14 'بِّسۡمِ').
    ...(mockWithBasmalaPages
      ? [
          line(3, 1, 'surah_name', 0, 0, 13),
          line(3, 2, 'basmallah', NO_SURAH, NO_SURAH, NO_SURAH),
          line(3, 3, 'surah_name', 0, 0, 14),
          line(4, 1, 'basmallah', NO_SURAH, NO_SURAH, NO_SURAH),
        ]
      : []),
    // @ai-end
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
const LAYOUT_SHA8 = LAYOUT_SOURCE_SHA256.slice(0, 8);
const copyName = (dbName: string, file: AssetFile) =>
  contentAddressedDbName(dbName, REWAYAH_DATA_MANIFEST[file]);

const N = {
  hafs: copyName('dk_words.db', 'digital-khatt-v2.db'),
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
  fake.chunkFaults.clear(); // @ai
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
    const touched = fake.log.filter(
      e => e.startsWith('open:') || e.startsWith('import:'),
    );
    expect(touched.every(e => /\.[0-9a-f]{8}\.db$/.test(e))).toBe(true);
    expect(service.getDataIdentity()).toEqual({
      rewayah: 'hafs',
      wordsSha8: sha8('digital-khatt-v2.db'),
      layoutSha8: LAYOUT_SHA8,
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
      [N.warsh, 'playlists.db', 'wbw-en.db'].sort(),
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

  it('deletes every copy of a retired base', async () => {
    seed('dk_layout.db', 'dk_layout', 'old');
    seed('dk_layout.33333333.db', 'dk_layout', 'old');
    seed('dk_layout.33333333.db-wal', 'dk_layout', 'old');
    const service = await initialized();
    await flush();
    expect(
      [...fake.files.keys()].filter(name => name.startsWith('dk_layout')),
    ).toEqual([]);

    seed('dk_layout.44444444.db', 'dk_layout', 'old');
    await service.resetDatabases();
    expect(fake.files.has('dk_layout.44444444.db')).toBe(false);
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
    // @ai-start
    // Warsh draws its own basmala lines: their data version is in the key.
    expect(service.getLayoutIdentityKey()).toBe(
      `warsh@${sha8('dk_words_warsh.db')}.${LAYOUT_SHA8}` +
        `.${rewayahBasmalaService.getDataVersion('warsh')}`,
    );
    // @ai-end
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
    // fallback (which the real store persists instead of Hafs) by the Hafs
    // commit itself, in the update that names Hafs.
    expect(store.rewayah).toBe('hafs');
    expect(store.rewayahFallbackFrom).toBe('warsh');
    expect(store.startRewayahFallback).toHaveBeenCalledTimes(1);
    expect(store.startRewayahFallback).toHaveBeenCalledWith('warsh');
    expect(store.setRewayah).not.toHaveBeenCalledWith('hafs');
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

  // @ai-start
  it('keeps a copy a mounted surface retains, however often the mushaf switches', async () => {
    // The player shows a Warsh reciter while the mushaf moves on.
    const service = await initialized();
    await service.switchRewayah('warsh');
    const release = service.retainRewayah('warsh');
    await service.switchRewayah('qalun');
    await service.switchRewayah('shubah');
    await service.ensureRewayahLoaded('al-bazzi');
    expect(service.getRewayahLoadState('warsh')).toBe('ready');
    expect(texts(service, '1:1', 'warsh')).toEqual(W);
    expect(count(`read:${N.warsh}`)).toBe(1);

    // Once nothing shows it, it is bounded like any other copy.
    release();
    await service.switchRewayah('qunbul');
    expect(service.getRewayahLoadState('warsh')).toBe('idle');
  });

  it('keeps a copy until every surface that retains it is gone', async () => {
    const service = await initialized();
    await service.ensureRewayahLoaded('warsh');
    const first = service.retainRewayah('warsh');
    const second = service.retainRewayah('warsh');
    first();
    first(); // releasing twice counts once
    await service.ensureRewayahLoaded('qalun');
    await service.ensureRewayahLoaded('shubah');
    expect(service.getRewayahLoadState('warsh')).toBe('ready');
    second();
    await service.ensureRewayahLoaded('al-bazzi');
    expect(service.getRewayahLoadState('warsh')).toBe('idle');
  });

  it('bounds the side copies nothing shows', async () => {
    const service = await initialized();
    await service.ensureRewayahLoaded('warsh');
    await service.ensureRewayahLoaded('qalun');
    await service.ensureRewayahLoaded('shubah');
    expect(service.getRewayahLoadState('shubah')).toBe('ready');
    expect(service.getRewayahLoadState('warsh')).toBe('idle');
    expect(service.getRewayahLoadState('qalun')).toBe('idle');
    // An explicit request makes a copy the most recently used one.
    await service.switchRewayah('al-bazzi');
    await service.ensureRewayahLoaded('hafs');
    await service.ensureRewayahLoaded('qunbul');
    expect(service.getRewayahLoadState('qunbul')).toBe('ready');
    expect(service.getRewayahLoadState('hafs')).toBe('idle');
  });
  // @ai-end

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

// @ai-start
describe('chunk reads (WordStore)', () => {
  it('gives each word its verse and position from the verse index', async () => {
    const service = await initialized();
    expect(service.getWordInfo(7)).toEqual({
      text: 'H7',
      verseKey: '1:2',
      wordPositionInVerse: 3,
    });
    expect(service.getWordText(12)).toBe('H12');
    expect(service.getWordInfo(13)).toBeUndefined();
  });

  describe.each(['throw', 'short'] as const)('a failed read (%s)', fault => {
    it('gives no word on the next getter and reads no more', async () => {
      const service = await initialized();
      fake.chunkFaults.set('dk_words', fault);
      expect(service.getWordText(1)).toBe('');
      // No retry: the fault is spent, so a second read would give H2.
      expect(service.getWordText(2)).toBe('');
      expect(service.getWordInfo(1)).toBeUndefined();
    });

    it('makes the rewayah read error and deletes its copy', async () => {
      const service = await initialized();
      const listener = jest.fn();
      service.subscribeCacheChanges(listener);
      fake.chunkFaults.set('dk_words', fault);
      service.getWordText(1);
      expect(listener).not.toHaveBeenCalled(); // Not inside the render.
      await flush();

      expect(service.initialized).toBe(false);
      expect(service.getRewayahLoadState('hafs')).toBe('error');
      expect(service.getRewayahLoadError('hafs')).toBeInstanceOf(
        RewayahLoadError,
      );
      expect(listener).toHaveBeenCalledTimes(1);
      expect(fake.files.has(N.hafs)).toBe(false);
      expect(fake.violations).toEqual([]);
    });

    it('a retry imports the copy again and reads', async () => {
      const service = await initialized();
      fake.chunkFaults.set('dk_words', fault);
      service.getWordText(1);
      await flush();
      fake.log.length = 0;

      await service.ensureRewayahLoaded('hafs', {retry: true});
      expect(count(`import:${N.hafs}`)).toBe(1);
      expect(service.initialized).toBe(true);
      expect(service.getRewayahLoadState('hafs')).toBe('ready');
      expect(service.getWordText(1)).toBe('H1');
    });

    it('files nothing under the real identity until the words load again', async () => {
      const service = await initialized();
      const identity = service.getLayoutIdentityKey();
      expect(identity).not.toBeNull();
      fake.chunkFaults.set('dk_words', fault);
      service.getWordText(1);
      // In the same turn: the caller saves its layout before the store drops.
      expect(service.getLayoutIdentityKey()).toBeNull();
      await flush();
      expect(service.getLayoutIdentityKey()).toBeNull();

      await service.ensureRewayahLoaded('hafs', {retry: true});
      expect(service.getLayoutIdentityKey()).toBe(identity);
    });

    it('a retry clears the caches of the text, in the same rewayah too', async () => {
      const service = await initialized();
      const listener = jest.fn();
      service.onRewayahChange(listener);
      fake.chunkFaults.set('dk_words', fault);
      service.getWordText(1);
      await flush();
      expect(listener).not.toHaveBeenCalled();

      await service.ensureRewayahLoaded('hafs', {retry: true});
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('hafs');
    });
  });

  it('a failed read of a side rewayah leaves the main rewayah as it is', async () => {
    const service = await initialized();
    await service.ensureRewayahLoaded('warsh');
    fake.chunkFaults.set('dk_words_warsh', 'throw');
    expect(service.getVerseWords('1:1', 'warsh')).toEqual([]);
    await flush();

    expect(service.getRewayahLoadState('warsh')).toBe('error');
    expect(service.tryGetVerseWords('1:1', 'warsh')).toBeNull();
    expect(service.initialized).toBe(true);
    expect(service.getLayoutIdentityKey()).not.toBeNull();
    expect(service.getWordText(1)).toBe('H1');
    expect(fake.violations).toEqual([]);

    await service.ensureRewayahLoaded('warsh', {retry: true});
    expect(service.getRewayahLoadState('warsh')).toBe('ready');
    expect(service.getVerseWords('1:1', 'warsh').map(w => w.text)).toEqual([
      'W1',
      'W2',
      'W3',
      'W4',
    ]);
  });

  describe('the sweep (readWordSlots)', () => {
    it('gives every word in id order, also a word with no text', async () => {
      const service = await initialized();
      fake.chunkFaults.set('dk_words', 'blank');
      const slots = Array.from(service.readWordSlots('hafs')!, s => ({...s}));
      expect(slots).toHaveLength(12);
      expect(slots[0]).toEqual({id: 1, surah: 1, ayah: 1, word: 1, text: ''});
      expect(slots[6]).toEqual({id: 7, surah: 1, ayah: 2, word: 3, text: 'H7'});
    });

    it('reads outside the chunk cache', async () => {
      const service = await initialized();
      expect(service.getWordText(1)).toBe('H1');
      fake.log.length = 0;
      Array.from(service.readWordSlots('hafs')!);
      expect(count(`chunk:${N.hafs}`)).toBe(1);
      expect(service.getWordText(2)).toBe('H2');
      expect(count(`chunk:${N.hafs}`)).toBe(1); // The cached chunk, not a read.
    });

    it('reads a side rewayah without the main one', async () => {
      const service = await initialized();
      await service.ensureRewayahLoaded('warsh');
      const texts = Array.from(service.readWordSlots('warsh')!, s => s.text);
      expect(texts[0]).toBe('W1');
      expect(service.readWordSlots('qalun')).toBeNull();
    });

    it('a failed read throws WordReadError and fails the store', async () => {
      const service = await initialized();
      fake.chunkFaults.set('dk_words', 'throw');
      expect(() => Array.from(service.readWordSlots('hafs')!)).toThrow(
        WordReadError,
      );
      await flush();
      expect(service.getRewayahLoadState('hafs')).toBe('error');
    });
  });

  it('a word whose text is empty is no failure', async () => {
    const service = await initialized();
    fake.chunkFaults.set('dk_words', 'blank');
    expect(service.getWordText(1)).toBe('');
    expect(service.getWordText(2)).toBe('H2');
    await flush();
    expect(service.getRewayahLoadState('hafs')).toBe('ready');
  });

  it('a reset in the same turn wins over the failed read', async () => {
    const service = await initialized();
    fake.chunkFaults.set('dk_words', 'throw');
    service.getWordText(1);
    await service.resetDatabases();
    await flush();
    expect(service.getRewayahLoadError('hafs')).toBeNull();
    expect(fake.violations).toEqual([]);
  });
});
// @ai-end

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

// @ai-start
describe('basmallah lines (contract C6)', () => {
  const SUSI_14 = EXPECTED_BASMALA['al-susi']!.bySurah[14].dk;
  const SUSI = EXPECTED_BASMALA['al-susi']!.dk;
  const WARSH = EXPECTED_BASMALA.warsh!.dk;

  beforeEach(() => {
    mockWithBasmalaPages = true;
  });
  afterEach(() => {
    mockWithBasmalaPages = false;
  });

  function basmalaLines(service: DigitalKhattDataService) {
    return [service.getPageLines(3)[1], service.getPageLines(4)[0]];
  }

  it('finds the surah each basmallah line opens, across a page break', async () => {
    const service = await initialized();
    const [opens13, opens14] = basmalaLines(service);
    expect(service.getBasmalaSurah(opens13)).toBe(13);
    expect(service.getBasmalaSurah(opens14)).toBe(14);
    expect(service.getBasmalaSurah(service.getPageLines(3)[0])).toBeNull();
    expect(service.getBasmalaSurah(service.getPageLines(1)[1])).toBeNull();
  });

  it('Hafs draws BASMALLAH_TEXT on every basmallah line, byte for byte', async () => {
    const service = await initialized();
    for (const basmala of basmalaLines(service)) {
      expect(service.getLineText(basmala)).toBe(BASMALLAH_TEXT);
    }
    expect(BASMALLAH_TEXT).toBe(
      '\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u064E\u0651\u0647\u0650 ' +
        '\u0671\u0644\u0631\u064E\u0651\u062D\u0652\u0645\u064E\u0670\u0646\u0650 ' +
        '\u0671\u0644\u0631\u064E\u0651\u062D\u0650\u064A\u0645\u0650',
    );
  });

  it("another rewayah draws its own basmala, in the surah's own spelling", async () => {
    const service = await initialized();
    await service.switchRewayah('warsh');
    expect(basmalaLines(service).map(l => service.getLineText(l))).toEqual([
      WARSH,
      WARSH,
    ]);
    await service.switchRewayah('al-susi');
    expect(basmalaLines(service).map(l => service.getLineText(l))).toEqual([
      SUSI,
      SUSI_14,
    ]);
    await service.switchRewayah('hafs');
    expect(basmalaLines(service).map(l => service.getLineText(l))).toEqual([
      BASMALLAH_TEXT,
      BASMALLAH_TEXT,
    ]);
  });

  it('a rewayah with its own basmala has its data version in the layout identity; Hafs keeps its key', async () => {
    const service = await initialized();
    const hafsKey = `hafs@${sha8('digital-khatt-v2.db')}.${LAYOUT_SHA8}`;
    expect(service.getLayoutIdentityKey()).toBe(hafsKey);
    expect(getRewayahDataIdentityKey('hafs')).toBe(hafsKey);
    expect(getRewayahDataIdentity('hafs')).not.toHaveProperty('basmalaVersion');

    await service.switchRewayah('al-susi');
    const version = rewayahBasmalaService.getDataVersion('al-susi');
    expect(version).toMatch(/^[0-9a-f]{8}$/);
    expect(service.getDataIdentity()).toEqual({
      rewayah: 'al-susi',
      wordsSha8: sha8('dk_words_soosi.db'),
      layoutSha8: LAYOUT_SHA8,
      basmalaVersion: version,
    });
    // The identity the layout-cache pruning compares with is the same.
    expect(getRewayahDataIdentityKey('al-susi')).toBe(
      service.getLayoutIdentityKey(),
    );
    expect(
      dataIdentityKey({
        rewayah: 'al-susi',
        wordsSha8: 'aaaaaaaa',
        layoutSha8: 'bbbbbbbb',
        basmalaVersion: 'cccccccc',
      }),
    ).toBe('al-susi@aaaaaaaa.bbbbbbbb.cccccccc');
  });
});
// @ai-end
