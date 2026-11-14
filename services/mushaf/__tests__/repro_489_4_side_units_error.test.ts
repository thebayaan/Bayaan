/**
 * Repro for finding 4 of the PR 489 review (RFC-023 step 2).
 *
 * After step 2 each rewayah's store has its own verse index, so a side
 * rewayah's verse units no longer need the main cache. But
 * RewayahVerseUnitsService.getStatus and request still check
 * dk.initialized, and a failed chunk read of the active rewayah sets
 * initialized to false (dropFailedStore). So one failed read of the mushaf's
 * words turns off verse numbering for a healthy side rewayah, such as the
 * player's Warsh.
 *
 * What the tests expect: after the Hafs store fails, Warsh is still 'ready'
 * and readable, its units status stays 'idle', and request('warsh') starts a
 * build (status 'loading').
 *
 * What happens on the PR head: the preconditions hold (Hafs reads 'error',
 * Warsh reads 'ready' and readWordSlots('warsh') yields its words), but
 * getStatus('warsh') is 'error' and request('warsh') resolves to null at once
 * without starting a build.
 *
 * Run: npx jest services/mushaf/__tests__/repro_489_4_side_units_error -w 1
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
          return {texts: inRange.length ? inRange.join('\^_') : null};
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

import {DigitalKhattDataService} from '../DigitalKhattDataService';
import {
  RewayahVerseUnitsService,
  type VerseUnitsBuildScheduler,
} from '../RewayahVerseUnitsService';

// A scheduler that never runs a chunk: a build that starts stays 'loading'.
const PAUSED: VerseUnitsBuildScheduler = {
  afterInteractions: () => undefined,
  nextChunk: () => undefined,
};

async function hafsFailedWarshReady() {
  const dk = new DigitalKhattDataService();
  await dk.initialize();
  await dk.ensureRewayahLoaded('warsh');
  const units = new RewayahVerseUnitsService(dk, undefined, undefined, {
    scheduler: PAUSED,
  });
  expect(units.getStatus('warsh')).toBe('idle');

  // The next chunk read of the Hafs words DB fails.
  fake.chunkFaults.set('dk_words', 'throw');
  dk.getWordText(1);
  await flush();

  expect(dk.getRewayahLoadState('hafs')).toBe('error');
  expect(dk.getRewayahLoadState('warsh')).toBe('ready');
  const slots = dk.readWordSlots('warsh');
  expect(slots).not.toBeNull();
  expect(Array.from(slots!, slot => slot.text).slice(0, 2)).toEqual([
    'dk_words_warsh-1',
    'dk_words_warsh-2',
  ]);
  return {dk, units};
}

describe("finding 4: a main store failure and a side rewayah's verse units", () => {
  it("a healthy side rewayah's units status does not turn to 'error'", async () => {
    const {units} = await hafsFailedWarshReady();
    expect(units.getStatus('warsh')).toBe('idle');
  });

  it('request() still builds the units of a healthy side rewayah', async () => {
    const {units} = await hafsFailedWarshReady();
    let settled = false;
    units.request('warsh').then(() => (settled = true));
    await flush();
    // A build started (paused by the scheduler), not an instant null.
    expect({settled, status: units.getStatus('warsh')}).toEqual({
      settled: false,
      status: 'loading',
    });
  });
});
