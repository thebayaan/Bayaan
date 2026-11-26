// @ai-generated
// The verse timings cache (SQLite, one connection). The first play of a
// Warsh or Qalun reciter downloads five short surahs at once to tell how the
// reciter's verses are numbered, and saves each. withTransactionAsync is not
// exclusive: a save started while another was open failed at BEGIN, and in
// the app its ROLLBACK then undid the first one's work, whose remaining
// INSERTs were saved on their own. Surahs were left with only their last
// verses, counted as cached for good, and the downloads that hit this were
// thrown away. Saves must run one after another, a surah counts as cached
// only once all of it is saved, and a failed save must not lose the timings.
jest.mock('expo-sqlite', () => {
  const sqlite = require('@/test-utils/mockExpoSqlite').expoSqliteModule;
  return {
    ...sqlite,
    // A mock, so a test can make opening the cache fail.
    openDatabaseAsync: jest.fn(sqlite.openDatabaseAsync),
    deleteDatabaseAsync: jest.fn(async () => undefined),
  };
});
jest.mock('@/config/branding', () => ({__esModule: true, default: {}}));
jest.mock('@/data/reciterData', () => ({
  RECITERS: [
    {
      id: 'reciter',
      rewayat: [
        {id: 'warsh-set', has_timestamps: true},
        {id: 'partial-set', has_timestamps: true, timestamps_surah_list: [1]},
      ],
    },
  ],
}));

import type {SqlParams} from '@/test-utils/sqliteAdapter';
import type {AyahTimestamp} from '@/types/timestamps';
import {TIMESTAMP_DATA_VERSION as VERSION} from '../TimestampFetchService';

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type DatabaseService =
  typeof import('../TimestampDatabaseService').timestampDatabaseService;
type FetchService =
  typeof import('../TimestampFetchService').timestampFetchService;
type Service = typeof import('../TimestampService').timestampService;

const REWAYAT = 'warsh-set';
const DB_FILE = 'timestamps_v5.db';
// The surahs of the numbering check, with their verse counts.
const SAMPLE: ReadonlyArray<readonly [number, number]> = [
  [107, 7],
  [106, 4],
  [101, 11],
  [99, 8],
  [96, 19],
];

const timings = (surah: number, count: number): AyahTimestamp[] =>
  Array.from({length: count}, (_, i) => ({
    surahNumber: surah,
    ayahNumber: i + 1,
    timestampFrom: i * 1000,
    timestampTo: (i + 1) * 1000,
    durationMs: 1000,
  }));

const ayahs = (list: AyahTimestamp[] | null): number[] | null =>
  list ? list.map(t => t.ayahNumber) : null;

const upTo = (count: number): number[] =>
  Array.from({length: count}, (_, i) => i + 1);

describe('the verse timings cache', () => {
  let mock: MockModule;
  let sqlite: {deleteDatabaseAsync: jest.Mock; openDatabaseAsync: jest.Mock};
  let database: DatabaseService;
  let fetchService: FetchService;
  let service: Service;
  let fetchMock: jest.Mock;
  let warn: jest.SpyInstance;
  const realFetch = global.fetch;

  const loadServices = () => {
    jest.resetModules();
    mock = require('@/test-utils/mockExpoSqlite');
    sqlite = require('expo-sqlite');
    database = require('../TimestampDatabaseService').timestampDatabaseService;
    fetchService = require('../TimestampFetchService').timestampFetchService;
    service = require('../TimestampService').timestampService;
  };

  // On a device every statement is a round trip to native code, so the
  // statements of two saves started together interleave. The stand-in
  // database answers at once: give each statement a turn of the event loop.
  const openDatabase = async () => {
    await database.initialize();
    const db = await mock.openDatabaseAsync(DB_FILE);
    const runAsync = db.runAsync.bind(db);
    db.runAsync = async (source: string, ...params: SqlParams) => {
      await new Promise(resolve => setImmediate(resolve));
      return runAsync(source, ...params);
    };
  };

  // The app reopened: new service instances over the same database files.
  const reopenApp = async () => {
    await database.close();
    const firstRun = mock;
    const dir = firstRun.databaseDir();
    loadServices();
    mock.useDatabaseDir(dir);
    await openDatabase();
    // The folder is the first run's to remove.
    return () => firstRun.resetDatabases();
  };

  // The CDN: every sample surah, each answer one turn of the event loop away.
  const serveSample = () => {
    fetchMock.mockImplementation(async (url: string) => {
      const surah = Number(/\/(\d{3})\.json/.exec(url)?.[1]);
      const count = SAMPLE.find(([s]) => s === surah)?.[1];
      await new Promise(resolve => setImmediate(resolve));
      return count
        ? {ok: true, status: 200, json: async () => timings(surah, count)}
        : {ok: false, status: 404, json: async () => null};
    });
  };

  beforeEach(async () => {
    loadServices();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await openDatabase();
  });

  afterEach(async () => {
    await database.close();
    await mock.resetDatabases();
    global.fetch = realFetch;
    warn.mockRestore();
  });

  it('saves every surah in full when five are written at once', async () => {
    await Promise.all(
      SAMPLE.map(([surah, count]) =>
        database.writeTimestamps(
          REWAYAT,
          surah,
          timings(surah, count),
          'r2',
          VERSION,
        ),
      ),
    );

    for (const [surah, count] of SAMPLE) {
      expect(
        ayahs(await database.getTimestampsForSurah(REWAYAT, surah)),
      ).toEqual(upTo(count));
      expect(await database.isSurahCached(REWAYAT, surah)).toBe(true);
    }
  });

  it('a save that fails does not block or undo the others', async () => {
    const duplicated = [...timings(106, 4), ...timings(106, 1)];

    const before = database.writeTimestamps(
      REWAYAT,
      107,
      timings(107, 7),
      'r2',
      VERSION,
    );
    // The same verse twice: the insert fails and its transaction rolls back.
    const failing = database.writeTimestamps(
      REWAYAT,
      106,
      duplicated,
      'r2',
      VERSION,
    );
    const after = database.writeTimestamps(
      REWAYAT,
      99,
      timings(99, 8),
      'r2',
      VERSION,
    );

    await expect(failing).rejects.toThrow();
    await Promise.all([before, after]);
    expect(ayahs(await database.getTimestampsForSurah(REWAYAT, 107))).toEqual(
      upTo(7),
    );
    expect(await database.getTimestampsForSurah(REWAYAT, 106)).toEqual([]);
    expect(ayahs(await database.getTimestampsForSurah(REWAYAT, 99))).toEqual(
      upTo(8),
    );
  });

  it('does not count verses without their cached_surahs row as a cached surah', async () => {
    // What an interrupted save left behind: the last verses, no surah row.
    const db = await mock.openDatabaseAsync(DB_FILE);
    for (const ayah of [3, 4, 5, 6, 7]) {
      await db.runAsync(
        `INSERT INTO ayah_timestamps (rewayat_id, surah_number, ayah_number, timestamp_from, timestamp_to, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [REWAYAT, 107, ayah, ayah * 1000, (ayah + 1) * 1000, 1000],
      );
    }

    expect(await database.getTimestampsForSurah(REWAYAT, 107)).toEqual([]);

    // ...so the surah is downloaded again and saved whole.
    serveSample();
    expect(ayahs(await service.getTimestampsForSurah(REWAYAT, 107))).toEqual(
      upTo(7),
    );
    expect(ayahs(await database.getTimestampsForSurah(REWAYAT, 107))).toEqual(
      upTo(7),
    );
  });

  it('is not cached while its save is still going on', async () => {
    await database.writeTimestamps(REWAYAT, 96, timings(96, 19), 'r2', VERSION);

    // Saved again (regenerated timings): a read between two statements of
    // the save must not get the half-written surah.
    const db = await mock.openDatabaseAsync(DB_FILE);
    const runAsync = db.runAsync.bind(db);
    const seenMidSave: number[] = [];
    let statements = 0;
    db.runAsync = async (source: string, ...params: SqlParams) => {
      const result = await runAsync(source, ...params);
      if (++statements === 5) {
        seenMidSave.push(
          (await database.getTimestampsForSurah(REWAYAT, 96)).length,
        );
      }
      return result;
    };

    await database.writeTimestamps(REWAYAT, 96, timings(96, 19), 'r2', VERSION);

    expect(seenMidSave).toEqual([0]);
    expect(ayahs(await database.getTimestampsForSurah(REWAYAT, 96))).toEqual(
      upTo(19),
    );
  });

  it('drops the caches that may hold half-saved surahs', async () => {
    expect(sqlite.deleteDatabaseAsync.mock.calls.map(([name]) => name)).toEqual(
      ['timestamps_v3.db', 'timestamps_v4.db'],
    );
  });

  it('gives all five surahs of the numbering check their timings, and keeps them', async () => {
    serveSample();

    const results = await Promise.all(
      SAMPLE.map(([surah]) => service.getTimestampsForSurah(REWAYAT, surah)),
    );

    expect(results.map(ayahs)).toEqual(SAMPLE.map(([, count]) => upTo(count)));
    expect(fetchMock).toHaveBeenCalledTimes(SAMPLE.length);

    // After a relaunch all five come from the cache, whole.
    const removeFiles = await reopenApp();
    fetchMock.mockClear();
    const cached = await Promise.all(
      SAMPLE.map(([surah]) => service.getTimestampsForSurah(REWAYAT, surah)),
    );
    await database.close();
    await removeFiles();

    expect(cached.map(ayahs)).toEqual(SAMPLE.map(([, count]) => upTo(count)));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('downloads and saves a surah once when it is asked for twice at once', async () => {
    serveSample();
    const write = jest.spyOn(database, 'writeTimestamps');

    const [first, second] = await Promise.all([
      service.getTimestampsForSurah(REWAYAT, 107),
      service.getTimestampsForSurah(REWAYAT, 107),
    ]);

    expect(ayahs(first)).toEqual(upTo(7));
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('tries again after a load that failed', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));
    expect(await service.getTimestampsForSurah(REWAYAT, 107)).toBeNull();

    serveSample();
    expect(ayahs(await service.getTimestampsForSurah(REWAYAT, 107))).toEqual(
      upTo(7),
    );
  });

  it('returns the downloaded timings when only saving them fails', async () => {
    serveSample();
    jest
      .spyOn(database, 'writeTimestamps')
      .mockRejectedValue(new Error('database or disk is full'));

    expect(ayahs(await fetchService.fetchAndCache(REWAYAT, 107))).toEqual(
      upTo(7),
    );
    expect(ayahs(await service.getTimestampsForSurah(REWAYAT, 99))).toEqual(
      upTo(8),
    );
  });

  it('fetches a surah again once the timings were regenerated', async () => {
    // Saved from the timings before the last TIMESTAMP_DATA_VERSION bump.
    await database.writeTimestamps(REWAYAT, 107, timings(107, 3), 'r2', 1);
    serveSample();

    expect(ayahs(await service.getTimestampsForSurah(REWAYAT, 107))).toEqual(
      upTo(7),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ayahs(await database.getTimestampsForSurah(REWAYAT, 107))).toEqual(
      upTo(7),
    );
    expect(await database.getCachedDataVersion(REWAYAT, 107)).toBe(VERSION);
  });

  it('keeps the older timings while the new ones cannot be fetched', async () => {
    await database.writeTimestamps(REWAYAT, 107, timings(107, 3), 'r2', 1);
    fetchMock.mockRejectedValue(new Error('Network request failed'));

    // Offline: the old timings rather than no verse tracking at all.
    expect(ayahs(await service.getTimestampsForSurah(REWAYAT, 107))).toEqual(
      upTo(3),
    );

    // Back online: the next load gets the new ones.
    serveSample();
    expect(ayahs(await service.getTimestampsForSurah(REWAYAT, 107))).toEqual(
      upTo(7),
    );
  });

  it('does not fetch a surah saved at the current version again', async () => {
    await database.writeTimestamps(
      REWAYAT,
      107,
      timings(107, 7),
      'r2',
      VERSION,
    );

    expect(ayahs(await service.getTimestampsForSurah(REWAYAT, 107))).toEqual(
      upTo(7),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('upgrades a cache saved before data versions were kept', async () => {
    // The cache as the app wrote it before: no data_version column.
    await database.close();
    await mock.resetDatabases();
    const old = await mock.openDatabaseAsync(DB_FILE);
    await old.execAsync(`
      CREATE TABLE ayah_timestamps (
        rewayat_id TEXT NOT NULL,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        timestamp_from INTEGER NOT NULL,
        timestamp_to INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        PRIMARY KEY (rewayat_id, surah_number, ayah_number)
      );
      CREATE TABLE cached_surahs (
        rewayat_id TEXT NOT NULL,
        surah_number INTEGER NOT NULL,
        source TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        PRIMARY KEY (rewayat_id, surah_number)
      );
    `);
    for (const t of timings(107, 3)) {
      await old.runAsync(
        `INSERT INTO ayah_timestamps (rewayat_id, surah_number, ayah_number, timestamp_from, timestamp_to, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [REWAYAT, 107, t.ayahNumber, t.timestampFrom, t.timestampTo, 1000],
      );
    }
    await old.runAsync(
      `INSERT INTO cached_surahs (rewayat_id, surah_number, source, fetched_at)
       VALUES (?, ?, ?, ?)`,
      [REWAYAT, 107, 'r2', 0],
    );
    await old.closeAsync();

    const removeFiles = await reopenApp();
    expect(await database.getCachedDataVersion(REWAYAT, 107)).toBe(0);
    serveSample();
    const reloaded = await service.getTimestampsForSurah(REWAYAT, 107);
    const version = await database.getCachedDataVersion(REWAYAT, 107);
    await database.close();
    await removeFiles();

    expect(ayahs(reloaded)).toEqual(upTo(7));
    expect(version).toBe(VERSION);
  });

  describe('when the cache could not be opened at launch', () => {
    let error: jest.SpyInstance;

    beforeEach(async () => {
      // A launch whose open failed: fresh services, nothing opened yet.
      await database.close();
      await mock.resetDatabases();
      loadServices();
      error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      sqlite.openDatabaseAsync.mockRejectedValueOnce(
        new Error('disk I/O error'),
      );
      await expect(database.initialize()).rejects.toThrow('disk I/O error');
    });

    afterEach(() => {
      error.mockRestore();
    });

    it('opens it on the next load, and keeps what it downloads', async () => {
      serveSample();

      expect(ayahs(await service.getTimestampsForSurah(REWAYAT, 107))).toEqual(
        upTo(7),
      );
      expect(await database.isSurahCached(REWAYAT, 107)).toBe(true);
    });

    it('still downloads the timings while it cannot be opened', async () => {
      sqlite.openDatabaseAsync.mockRejectedValue(new Error('disk I/O error'));
      serveSample();

      expect(ayahs(await service.getTimestampsForSurah(REWAYAT, 107))).toEqual(
        upTo(7),
      );
    });
  });
});
