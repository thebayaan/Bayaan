/**
 * Repro for finding 1 of the PR 489 review (RFC-023 step 2).
 *
 * The mushaf's words and a side rewayah's words are now the same thing, an
 * open WordStore, but they live in two fields. When the mushaf switches back
 * to a rewayah whose store is still open as the side copy (hafs -> warsh ->
 * hafs), or to a rewayah the player already has open, loadMainSnapshot always
 * calls openWordStore. So the service opens a second connection to the same
 * database file and reads its verse index again, and only then closes the
 * first connection in swapMain.
 *
 * What the tests expect: a switch to a rewayah that is already open reuses
 * that store, so the file never has two connections open at once and its
 * verse index is not read again.
 *
 * What happens on the PR head: the same file is open twice at the same time
 * (maxOpen is 2), its verse index is read a second time, and then the first
 * connection is closed. Two connections to one SQLite file is the double
 * open that the PR author has since seen fail on Android.
 *
 * Run: npx jest services/mushaf/__tests__/repro_489_1_switch_back_double_open -w 1
 */
// The expo-sqlite fake of DigitalKhattDataService.test.ts at the PR head,
// trimmed to what this file needs, with three additions: `maxOpen` (the most
// connections a DB name ever had open at once), a log line for each close,
// and `closeGates` (a closeAsync that waits on a per-base promise).
interface FakeFile {
  base: string;
  version: 'asset' | 'old' | 'none';
  state: 'ok' | 'empty';
}

interface FakeSqliteState {
  files: Map<string, FakeFile>;
  open: Map<string, number>;
  maxOpen: Map<string, number>;
  log: string[];
  violations: string[];
  chunkFaults: Map<string, 'throw'>;
  closeGates: Map<string, Promise<void>>;
}

jest.mock('expo-sqlite', () => {
  const state: FakeSqliteState = {
    files: new Map(),
    open: new Map(),
    maxOpen: new Map(),
    log: [],
    violations: [],
    chunkFaults: new Map(),
    closeGates: new Map(),
  };
  const baseOf = (name: string) =>
    name.replace(/\.db$/, '').replace(/\.[0-9a-f]{8}$/, '');
  const openCount = (name: string) => state.open.get(name) ?? 0;
  const LOCATIONS = [
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
  const wordRows = (base: string) =>
    LOCATIONS.map((location, i) => ({
      id: i + 1,
      text: `${base}-${i + 1}`,
      location,
    }));
  const verseIndexRows = (rows: {id: number; location: string}[]) => {
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
  };
  const pageRows = () => {
    const line = (
      page: number,
      lineNumber: number,
      type: string,
      first: number,
      last: number,
      surah: number,
    ) => ({
      page_number: page,
      line_number: lineNumber,
      line_type: type,
      is_centered: 0,
      first_word_id: first,
      last_word_id: last,
      surah_number: surah,
    });
    return [
      line(1, 1, 'surah_name', 0, 0, 1),
      line(1, 2, 'ayah', 1, 4, 1),
      line(1, 3, 'ayah', 5, 8, 1),
      line(2, 1, 'surah_name', 0, 0, 2),
      line(2, 2, 'ayah', 9, 10, 2),
      line(2, 3, 'ayah', 11, 12, 2),
    ];
  };
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
      state.maxOpen.set(
        name,
        Math.max(state.maxOpen.get(name) ?? 0, openCount(name)),
      );
      let closed = false;
      const wordsOf = () => {
        const file = state.files.get(name);
        if (!file || file.state !== 'ok') throw new Error('no such table');
        return wordRows(file.base);
      };
      return {
        async getFirstAsync(sql: string) {
          const file = state.files.get(name);
          if (!file || file.state === 'empty') return null;
          if (sql.includes('COUNT(*)')) {
            const n = wordsOf().length;
            return {n, ids: n, texts: n, locations: n};
          }
          const table = /name='(\w+)'/.exec(sql)?.[1];
          const has =
            file.base === 'dk_layout' ? table === 'pages' : table === 'words';
          return has ? {name: table} : null;
        },
        async getAllAsync(sql: string) {
          const file = state.files.get(name);
          if (!file) throw new Error(`no such file ${name}`);
          if (file.state !== 'ok') throw new Error('no such table');
          state.log.push(`read:${name}`);
          if (sql.includes('GROUP BY')) {
            state.log.push(`index:${name}`);
            return verseIndexRows(wordsOf());
          }
          return sql.includes('FROM pages') ? pageRows() : wordsOf();
        },
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
          return {texts: inRange.length ? inRange.join('\u001f') : null};
        },
        async closeAsync() {
          if (closed) throw new Error('already closed');
          closed = true;
          const held = state.closeGates.get(baseOf(name));
          if (held) await held;
          state.open.set(name, openCount(name) - 1);
          if (openCount(name) <= 0) state.open.delete(name);
          state.log.push(`closed:${name}`);
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
  readDirectoryAsync: jest.fn(async () => {
    const sqlite = jest.requireMock('expo-sqlite') as {
      __fake: FakeSqliteState;
    };
    return [...sqlite.__fake.files.keys()];
  }),
}));

jest.mock('@/store/mushafSettingsStore', () => {
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
  return {
    useMushafSettingsStore: {
      getState: () => state,
      subscribe: () => () => undefined,
    },
    rendererPinsHafs: (renderer: string) => renderer === 'qcf_v2',
    __state: state,
  };
});

const fake = (jest.requireMock('expo-sqlite') as {__fake: FakeSqliteState})
  .__fake;
const settings = (
  jest.requireMock('@/store/mushafSettingsStore') as {
    __state: {rewayah: string; mushafRenderer: string};
  }
).__state;

async function flush(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

let consoleSpies: jest.SpyInstance[] = [];

beforeEach(() => {
  fake.files.clear();
  fake.open.clear();
  fake.maxOpen.clear();
  fake.log.length = 0;
  fake.violations.length = 0;
  fake.chunkFaults.clear();
  fake.closeGates.clear();
  settings.rewayah = 'hafs';
  settings.mushafRenderer = 'dk_v2';
  consoleSpies = [
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
    jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    jest.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
});

afterEach(async () => {
  await flush();
  for (const spy of consoleSpies) spy.mockRestore();
});

import {REWAYAH_DATA_MANIFEST} from '../rewayahDataManifest';
import {
  contentAddressedDbName,
  DigitalKhattDataService,
} from '../DigitalKhattDataService';

const N = {
  hafs: contentAddressedDbName(
    'dk_words.db',
    REWAYAH_DATA_MANIFEST['digital-khatt-v2.db'],
  ),
  warsh: contentAddressedDbName(
    'dk_words_warsh.db',
    REWAYAH_DATA_MANIFEST['dk_words_warsh.db'],
  ),
};

const count = (entry: string) => fake.log.filter(e => e === entry).length;

async function initialized(): Promise<DigitalKhattDataService> {
  const service = new DigitalKhattDataService();
  await service.initialize();
  return service;
}

describe('finding 1: a switch to a rewayah whose store is still open', () => {
  it('switching back to Hafs (kept open as the side copy) never opens a second connection to the Hafs copy', async () => {
    const service = await initialized();
    await service.switchRewayah('warsh'); // Hafs stays open as the side copy
    expect(service.getRewayahLoadState('hafs')).toBe('ready');
    expect(fake.open.get(N.hafs)).toBe(1);
    fake.maxOpen.clear();
    fake.log.length = 0;

    await service.switchRewayah('hafs');
    await flush();

    expect(service.rewayah).toBe('hafs');
    // The Hafs copy must never be open twice at the same time.
    expect(fake.maxOpen.get(N.hafs)).toBe(1);
  });

  it('switching back to Hafs reads no verse index and closes nothing', async () => {
    const service = await initialized();
    await service.switchRewayah('warsh');
    fake.log.length = 0;

    await service.switchRewayah('hafs');
    await flush();

    expect({
      hafsOpens: count(`open:${N.hafs}`),
      hafsIndexReads: count(`index:${N.hafs}`),
      hafsCloses: count(`closed:${N.hafs}`),
    }).toEqual({hafsOpens: 0, hafsIndexReads: 0, hafsCloses: 0});
  });

  it('switching the mushaf to a rewayah the player already has open never opens a second connection to it', async () => {
    const service = await initialized();
    await service.ensureRewayahLoaded('warsh'); // the player's side copy
    const release = service.retainRewayah('warsh');
    expect(fake.open.get(N.warsh)).toBe(1);
    fake.maxOpen.clear();
    fake.log.length = 0;

    await service.switchRewayah('warsh');
    await flush();

    expect(service.rewayah).toBe('warsh');
    expect(fake.maxOpen.get(N.warsh)).toBe(1);
    expect(count(`index:${N.warsh}`)).toBe(0);
    release();
  });
});
