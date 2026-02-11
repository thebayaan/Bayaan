import * as SQLite from 'expo-sqlite';
import {Asset} from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import type {
  AyahTimestamp,
  TimestampMeta,
  AyahTimestampRow,
  TimestampMetaRow,
} from '@/types/timestamps';
import {mapAyahTimestampRow, mapTimestampMetaRow} from '@/types/timestamps';

class TimestampDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const dbPath = `${FileSystem.documentDirectory}SQLite/timestamps.db`;
        const info = await FileSystem.getInfoAsync(dbPath);

        if (!info.exists) {
          // Copy from bundled asset to writable directory
          const asset = await Asset.fromModule(
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require('@/assets/data/timestamps.db'),
          ).downloadAsync();

          // Ensure SQLite directory exists
          await FileSystem.makeDirectoryAsync(
            `${FileSystem.documentDirectory}SQLite`,
            {intermediates: true},
          );

          await FileSystem.copyAsync({
            from: asset.localUri!,
            to: dbPath,
          });
        }

        this.db = await SQLite.openDatabaseAsync('timestamps.db');
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
      `SELECT * FROM ayah_timestamps WHERE rewayat_id = ? AND surah_number = ? ORDER BY ayah_number`,
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
