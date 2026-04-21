import * as SQLite from 'expo-sqlite';
import type {
  AyahTimestamp,
  AyahTimestampRow,
  TimestampSource,
} from '@/types/timestamps';
import {mapAyahTimestampRow} from '@/types/timestamps';

const DB_NAME = 'timestamps_v3.db';

class TimestampDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync(DB_NAME);

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
            PRIMARY KEY (rewayat_id, surah_number)
          );
        `);

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

    const rows = (await this.db.getAllAsync(
      `SELECT rewayat_id, surah_number, ayah_number, timestamp_from, timestamp_to, duration_ms
       FROM ayah_timestamps
       WHERE rewayat_id = ? AND surah_number = ?
       ORDER BY ayah_number`,
      [rewayatId, surahNumber],
    )) as AyahTimestampRow[];

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

  async writeTimestamps(
    rewayatId: string,
    surahNumber: number,
    timestamps: AyahTimestamp[],
    source: TimestampSource,
  ): Promise<void> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    await this.db.withTransactionAsync(async () => {
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
      await this.db!.runAsync(
        `INSERT OR REPLACE INTO cached_surahs (rewayat_id, surah_number, source, fetched_at)
         VALUES (?, ?, ?, ?)`,
        [rewayatId, surahNumber, source, Date.now()],
      );
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
