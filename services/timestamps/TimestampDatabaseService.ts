import * as SQLite from 'expo-sqlite';
import type {
  AyahTimestamp,
  TimestampMeta,
  AyahTimestampRow,
  TimestampMetaRow,
} from '@/types/timestamps';
import {mapAyahTimestampRow, mapTimestampMetaRow} from '@/types/timestamps';

const DB_NAME = 'timestamps.db';
const SCHEMA_VERSION = 2; // v1 = original with segments, v2 = stripped

class TimestampDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        let db = await SQLite.openDatabaseAsync(DB_NAME);

        // Check if DB has expected table and correct schema version
        const tableCheck = await db
          .getFirstAsync<{name: string}>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='ayah_timestamps'",
          )
          .catch(() => null);

        const versionResult = tableCheck
          ? await db.getFirstAsync<{user_version: number}>(
              'PRAGMA user_version',
            )
          : null;

        if (
          !tableCheck ||
          (versionResult?.user_version ?? 0) < SCHEMA_VERSION
        ) {
          await db.closeAsync();
          await SQLite.deleteDatabaseAsync(DB_NAME);
          await SQLite.importDatabaseFromAssetAsync(DB_NAME, {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetId: require('@/assets/data/timestamps.db'),
          });
          db = await SQLite.openDatabaseAsync(DB_NAME);
          await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
        }

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

  async hasTimestamps(rewayatId: string): Promise<boolean> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    const result = (await this.db.getFirstAsync(
      `SELECT 1 FROM timestamp_meta WHERE rewayat_id = ? LIMIT 1`,
      [rewayatId],
    )) as Record<string, number> | null;

    return result !== null;
  }

  async getMeta(rewayatId: string): Promise<TimestampMeta | null> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    const row = (await this.db.getFirstAsync(
      `SELECT * FROM timestamp_meta WHERE rewayat_id = ?`,
      [rewayatId],
    )) as TimestampMetaRow | null;

    return row ? mapTimestampMetaRow(row) : null;
  }

  async getAllMeta(): Promise<TimestampMeta[]> {
    if (!this.db) throw new Error('Timestamps database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM timestamp_meta`,
    )) as TimestampMetaRow[];

    return rows.map(mapTimestampMetaRow);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export const timestampDatabaseService = new TimestampDatabaseService();
