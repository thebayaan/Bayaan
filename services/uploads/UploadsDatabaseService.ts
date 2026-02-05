import * as SQLite from 'expo-sqlite';

import type {
  UploadedRecitation,
  UploadedRecitationRow,
  CustomReciter,
  CustomReciterRow,
} from '../../types/uploads';
import {mapRecitationRow, mapCustomReciterRow} from '../../types/uploads';

interface CountRow {
  count: number;
}

class UploadsDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  // Initialize database (idempotent with mutex protection)
  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.db) return;

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = (async () => {
      try {
        this.db = await SQLite.openDatabaseAsync('uploads.db');
        await this.createTables();
      } catch (error) {
        console.error('Failed to initialize uploads database:', error);
        this.initPromise = null; // Reset on error so it can be retried
        throw error;
      }
    })();

    return this.initPromise;
  }

  // Create tables
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Enable WAL mode for better concurrent access
    await this.db.execAsync('PRAGMA journal_mode = WAL;');

    // Create uploaded_recitations table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS uploaded_recitations (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        duration INTEGER,
        date_added INTEGER NOT NULL,
        type TEXT,
        surah_number INTEGER,
        start_verse INTEGER,
        end_verse INTEGER,
        title TEXT,
        category TEXT,
        reciter_id TEXT,
        custom_reciter_id TEXT,
        is_personal INTEGER DEFAULT 0,
        rewayah TEXT
      );
    `);

    // Create custom_reciters table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS custom_reciters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        image_uri TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // Create indexes for better performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_recitations_surah
      ON uploaded_recitations(surah_number);
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_recitations_reciter
      ON uploaded_recitations(reciter_id);
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_recitations_custom_reciter
      ON uploaded_recitations(custom_reciter_id);
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_recitations_type
      ON uploaded_recitations(type);
    `);
  }

  // ─── Recitation CRUD ────────────────────────────────────────────────

  async insertRecitation(recitation: UploadedRecitation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO uploaded_recitations (
          id, file_path, original_filename, duration, date_added,
          type, surah_number, start_verse, end_verse, title,
          category, reciter_id, custom_reciter_id, is_personal, rewayah
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recitation.id,
          recitation.filePath,
          recitation.originalFilename,
          recitation.duration,
          recitation.dateAdded,
          recitation.type,
          recitation.surahNumber,
          recitation.startVerse,
          recitation.endVerse,
          recitation.title,
          recitation.category,
          recitation.reciterId,
          recitation.customReciterId,
          recitation.isPersonal ? 1 : 0,
          recitation.rewayah,
        ],
      );
    });
  }

  async getAll(): Promise<UploadedRecitation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM uploaded_recitations ORDER BY date_added DESC`,
    )) as UploadedRecitationRow[];

    return rows.map(mapRecitationRow);
  }

  async getById(id: string): Promise<UploadedRecitation | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = (await this.db.getFirstAsync(
      `SELECT * FROM uploaded_recitations WHERE id = ?`,
      [id],
    )) as UploadedRecitationRow | null;

    if (!row) return null;

    return mapRecitationRow(row);
  }

  async getUntagged(): Promise<UploadedRecitation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM uploaded_recitations WHERE type IS NULL ORDER BY date_added DESC`,
    )) as UploadedRecitationRow[];

    return rows.map(mapRecitationRow);
  }

  async getByType(type: string): Promise<UploadedRecitation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM uploaded_recitations WHERE type = ? ORDER BY date_added DESC`,
      [type],
    )) as UploadedRecitationRow[];

    return rows.map(mapRecitationRow);
  }

  async getBySurah(surahNumber: number): Promise<UploadedRecitation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM uploaded_recitations WHERE surah_number = ?`,
      [surahNumber],
    )) as UploadedRecitationRow[];

    return rows.map(mapRecitationRow);
  }

  async getByReciter(reciterId: string): Promise<UploadedRecitation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM uploaded_recitations WHERE reciter_id = ?`,
      [reciterId],
    )) as UploadedRecitationRow[];

    return rows.map(mapRecitationRow);
  }

  async getByCustomReciter(
    customReciterId: string,
  ): Promise<UploadedRecitation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM uploaded_recitations WHERE custom_reciter_id = ?`,
      [customReciterId],
    )) as UploadedRecitationRow[];

    return rows.map(mapRecitationRow);
  }

  async getOther(): Promise<UploadedRecitation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM uploaded_recitations WHERE type = 'other' ORDER BY date_added DESC`,
    )) as UploadedRecitationRow[];

    return rows.map(mapRecitationRow);
  }

  async getTotalCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const result = (await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM uploaded_recitations`,
    )) as CountRow | null;

    return result?.count ?? 0;
  }

  async updateTags(
    id: string,
    tags: Partial<UploadedRecitation>,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fieldMapping: Record<string, string> = {
      type: 'type',
      surahNumber: 'surah_number',
      startVerse: 'start_verse',
      endVerse: 'end_verse',
      title: 'title',
      category: 'category',
      reciterId: 'reciter_id',
      customReciterId: 'custom_reciter_id',
      isPersonal: 'is_personal',
      rewayah: 'rewayah',
    };

    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [camelKey, snakeKey] of Object.entries(fieldMapping)) {
      if (camelKey in tags) {
        setClauses.push(`${snakeKey} = ?`);
        const rawValue = tags[camelKey as keyof UploadedRecitation];

        // Convert boolean to integer for isPersonal
        if (camelKey === 'isPersonal') {
          values.push(rawValue ? 1 : 0);
        } else {
          values.push(rawValue as string | number | null);
        }
      }
    }

    if (setClauses.length === 0) return;

    const db = this.db;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE uploaded_recitations SET ${setClauses.join(', ')} WHERE id = ?`,
        [...values, id],
      );
    });
  }

  async deleteRecitation(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `DELETE FROM uploaded_recitations WHERE id = ?`,
        [id],
      );
    });
  }

  // ─── Custom Reciters ───────────────────────────────────────────────

  async insertCustomReciter(reciter: CustomReciter): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO custom_reciters (id, name, image_uri, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          reciter.id,
          reciter.name,
          reciter.imageUri,
          reciter.createdAt,
        ],
      );
    });
  }

  async getAllCustomReciters(): Promise<CustomReciter[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM custom_reciters ORDER BY created_at DESC`,
    )) as CustomReciterRow[];

    return rows.map(mapCustomReciterRow);
  }

  async getCustomReciterById(id: string): Promise<CustomReciter | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = (await this.db.getFirstAsync(
      `SELECT * FROM custom_reciters WHERE id = ?`,
      [id],
    )) as CustomReciterRow | null;

    if (!row) return null;

    return mapCustomReciterRow(row);
  }

  async deleteCustomReciter(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `DELETE FROM custom_reciters WHERE id = ?`,
        [id],
      );
    });
  }

  // Close database
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

// Export singleton instance
export const uploadsDatabaseService = new UploadsDatabaseService();
