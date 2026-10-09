import * as SQLite from 'expo-sqlite';
import {cleanUpLegacyNotes} from '@/services/database/migrations/legacyNotesCleanup';
import {migrateUserSyncV1} from '@/services/database/migrations/userSyncV1';
import {migrateUserSyncV2} from '@/services/database/migrations/userSyncV2';
import {migrateUserSyncV3} from '@/services/database/migrations/userSyncV3';

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
        await cleanUpLegacyNotes(this.db);
        await migrateUserSyncV1(this.db);
        await migrateUserSyncV2(this.db);
        await migrateUserSyncV3(this.db);
        this.ready = true;
      } catch (error) {
        console.error(
          'Failed to initialize verse annotations database:',
          error,
        );
        const db = this.db;
        this.db = null;
        this.ready = false;
        if (db) {
          try {
            await db.closeAsync();
          } catch (closeError) {
            console.error(
              'Failed to close verse annotations database after initialization failure:',
              closeError,
            );
          }
        }
        // Keep the rejected promise: recovery requires a new database instance.
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
    if (this.initPromise && !this.ready) {
      try {
        await this.initPromise;
      } catch {
        // Initialization already attempted cleanup; do not clear its failure.
        return;
      }
    }

    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
    this.ready = false;
    this.initPromise = null;
  }
}

export const verseAnnotationDatabase = new VerseAnnotationDatabase();
