import * as SQLite from 'expo-sqlite';
import type {
  AyahTimestamp,
  AyahTimestampRow,
  TimestampSource,
} from '@/types/timestamps';
import {mapAyahTimestampRow} from '@/types/timestamps';

// v4: the R2 timings for several reciters were regenerated (2026-10-27), and a
// cached surah is never re-fetched, so devices start from an empty cache.
// @ai-start
// v5: surahs saved while another save was open could be left with only their
// last verses (see writeQueue below) and were then counted as cached for
// good, so those caches are dropped too.
const DB_NAME = 'timestamps_v5.db';
const LEGACY_DB_NAMES = ['timestamps_v3.db', 'timestamps_v4.db'];
// @ai-end

class TimestampDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  // @ai-start
  // Tail of the writes. withTransactionAsync is not exclusive: there is one
  // connection, so a second transaction started while one is open fails at
  // BEGIN, and its ROLLBACK then undoes the first one's work so far. The
  // first one's remaining INSERTs were then saved on their own: a surah was
  // left with only its last verses, for good. It happened on the first play
  // of a Warsh or Qalun reciter, which downloads five short surahs at once
  // to tell how the reciter's verses are numbered. Every write therefore
  // starts once the one before it is done, as in DatabaseService.
  private writeQueue: Promise<unknown> = Promise.resolve();

  private serializeWrite<T>(write: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(write, write);
    this.writeQueue = result.catch(() => undefined);
    return result;
  }

  /** A transaction that waits its turn behind the writes issued before it. */
  private writeTransaction(
    db: SQLite.SQLiteDatabase,
    task: () => Promise<void>,
  ): Promise<void> {
    return this.serializeWrite(() => db.withTransactionAsync(task));
  }
  // @ai-end

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        // Best effort: the old cache only holds superseded timings.
        for (const name of LEGACY_DB_NAMES) {
          SQLite.deleteDatabaseAsync(name).catch(() => undefined);
        }

        // Note on the cached_surahs.source column:
        // `source` is informational (no CHECK constraint at the SQLite
        // layer). The TimestampSource enum narrowed from
        // 'mp3quran' | 'qdc' | 'local' (pre-R2-mirror) to 'r2' | 'local'
        // (current), so devices upgrading across PR #278 may carry stale
        // 'mp3quran' / 'qdc' rows here until the next fetch overwrites
        // them via INSERT OR REPLACE in writeTimestamps. The stale
        // values are never read back as a TimestampSource — they live
        // only on this row for diagnostic purposes — so
        // overwrite-on-next-fetch is sufficient and no one-shot
        // migration is required.
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS ayah_timestamps (
            rewayat_id TEXT NOT NULL,
            surah_number INTEGER NOT NULL,
            ayah_number INTEGER NOT NULL,
            timestamp_from INTEGER NOT NULL,
            timestamp_to INTEGER NOT NULL,
            duration_ms INTEGER NOT NULL,
            PRIMARY KEY (rewayat_id, surah_number, ayah_number)
          );

          CREATE TABLE IF NOT EXISTS cached_surahs (
            rewayat_id TEXT NOT NULL,
            surah_number INTEGER NOT NULL,
            source TEXT NOT NULL,
            fetched_at INTEGER NOT NULL,
            data_version INTEGER NOT NULL DEFAULT 0, -- @ai
            PRIMARY KEY (rewayat_id, surah_number)
          );
        `);

        // @ai-start
        // data_version (the timings' TIMESTAMP_DATA_VERSION when saved) came
        // after this file: CREATE TABLE IF NOT EXISTS does not add it to a
        // table made before. Rows saved before it read as version 0, so they
        // are fetched again when online (see TimestampService).
        const columns = await db.getAllAsync<{name: string}>(
          'PRAGMA table_info(cached_surahs)',
        );
        if (!columns.some(column => column.name === 'data_version')) {
          await db.execAsync(
            'ALTER TABLE cached_surahs ADD COLUMN data_version INTEGER NOT NULL DEFAULT 0;',
          );
        }
        // @ai-end

        this.db = db;
      } catch (error) {
        console.error('Failed to initialize timestamps database:', error);
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  async getTimestampsForSurah(
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[]> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    // @ai-start
    // Only a surah with its cached_surahs row: that row is written last, so
    // verses without it are a save that did not finish (or is still going
    // on), not the whole surah.
    const rows = (await this.db.getAllAsync(
      `SELECT rewayat_id, surah_number, ayah_number, timestamp_from, timestamp_to, duration_ms
       FROM ayah_timestamps
       WHERE rewayat_id = ? AND surah_number = ?
         AND EXISTS (
           SELECT 1 FROM cached_surahs
           WHERE rewayat_id = ? AND surah_number = ?
         )
       ORDER BY ayah_number`,
      [rewayatId, surahNumber, rewayatId, surahNumber],
    )) as AyahTimestampRow[];
    // @ai-end

    return rows.map(mapAyahTimestampRow);
  }

  async isSurahCached(
    rewayatId: string,
    surahNumber: number,
  ): Promise<boolean> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    const result = await this.db.getFirstAsync(
      `SELECT 1 FROM cached_surahs WHERE rewayat_id = ? AND surah_number = ? LIMIT 1`,
      [rewayatId, surahNumber],
    );

    return result !== null;
  }

  // @ai-start
  /**
   * The data version the cached surah was saved with (0 when saved before
   * versions were kept), or null when it is not cached.
   */
  async getCachedDataVersion(
    rewayatId: string,
    surahNumber: number,
  ): Promise<number | null> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    const row = await this.db.getFirstAsync<{data_version: number}>(
      `SELECT data_version FROM cached_surahs WHERE rewayat_id = ? AND surah_number = ?`,
      [rewayatId, surahNumber],
    );
    return row ? row.data_version : null;
  }
  // @ai-end

  async writeTimestamps(
    rewayatId: string,
    surahNumber: number,
    timestamps: AyahTimestamp[],
    source: TimestampSource,
    dataVersion: number, // @ai
  ): Promise<void> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    // @ai-start
    // One save at a time (see writeQueue).
    await this.writeTransaction(this.db, async () => {
      // Not cached until the last statement below: a read between two of
      // these statements finds no surah rather than part of one.
      await this.db!.runAsync(
        `DELETE FROM cached_surahs WHERE rewayat_id = ? AND surah_number = ?`,
        [rewayatId, surahNumber],
      );
      // @ai-end

      // Delete any existing data for this surah (in case of re-fetch)
      await this.db!.runAsync(
        `DELETE FROM ayah_timestamps WHERE rewayat_id = ? AND surah_number = ?`,
        [rewayatId, surahNumber],
      );

      // Insert all ayah timestamps
      for (const t of timestamps) {
        await this.db!.runAsync(
          `INSERT INTO ayah_timestamps (rewayat_id, surah_number, ayah_number, timestamp_from, timestamp_to, duration_ms)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            rewayatId,
            surahNumber,
            t.ayahNumber,
            t.timestampFrom,
            t.timestampTo,
            t.durationMs,
          ],
        );
      }

      // Mark surah as cached
      // @ai-start
      await this.db!.runAsync(
        `INSERT OR REPLACE INTO cached_surahs (rewayat_id, surah_number, source, fetched_at, data_version)
         VALUES (?, ?, ?, ?, ?)`,
        [rewayatId, surahNumber, source, Date.now(), dataVersion],
      );
      // @ai-end
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export const timestampDatabaseService = new TimestampDatabaseService();
