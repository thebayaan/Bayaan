import * as SQLite from 'expo-sqlite';
import {migrateUserSyncV1} from '@/services/database/migrations/userSyncV1';
import {migrateUserSyncV2} from '@/services/database/migrations/userSyncV2';

const DEFAULT_DATABASE_NAME = 'verse-annotations.db';

export class VerseAnnotationDatabase {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private ready = false;

  constructor(private readonly databaseName = DEFAULT_DATABASE_NAME) {}

  async initialize(): Promise<void> {
    if (this.ready) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.db = await SQLite.openDatabaseAsync(this.databaseName);
        await migrateUserSyncV1(this.db);
        await migrateUserSyncV2(this.db);
        this.ready = true;
      } catch (error) {
        console.error(
          'Failed to initialize verse annotations database:',
          error,
        );
        this.db = null;
        this.initPromise = null;
        this.ready = false;
        throw error;
      }
    })();

    return this.initPromise;
  }

  async getConnection(): Promise<SQLite.SQLiteDatabase> {
    if (!this.ready) {
      await this.initialize();
    }

    if (!this.db || !this.ready) {
      throw new Error('Database not initialized');
    }

    return this.db;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
    this.ready = false;
    this.initPromise = null;
  }
}

export const verseAnnotationDatabase = new VerseAnnotationDatabase();
