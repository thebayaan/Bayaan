export const USER_SYNC_V2_VERSION = 'user_sync_v2';

type SQLiteLikeDatabase = {
  execAsync(source: string): Promise<void>;
  getFirstAsync(
    source: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<unknown | null>;
};

interface MigrationRow {
  version: string;
}

async function hasMigration(db: SQLiteLikeDatabase): Promise<boolean> {
  const row = (await db.getFirstAsync(
    `SELECT version FROM schema_migrations WHERE version = ?`,
    [USER_SYNC_V2_VERSION],
  )) as MigrationRow | null;
  return row?.version === USER_SYNC_V2_VERSION;
}

export async function migrateUserSyncV2(db: SQLiteLikeDatabase): Promise<void> {
  if (await hasMigration(db)) return;

  await db.execAsync('BEGIN;');
  try {
    if (!(await hasMigration(db))) {
      await db.execAsync(`
        ALTER TABLE qf_sync_outbox
          ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE qf_sync_outbox
          ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'AMBIGUOUS';
        ALTER TABLE qf_sync_outbox
          ADD COLUMN in_flight_revision INTEGER;
        ALTER TABLE qf_sync_outbox
          ADD COLUMN in_flight_mutation_type TEXT;
        ALTER TABLE qf_sync_outbox
          ADD COLUMN in_flight_payload_json TEXT;
        ALTER TABLE qf_sync_outbox
          ADD COLUMN in_flight_started_at INTEGER;

        INSERT INTO schema_migrations (version, applied_at)
        VALUES ('${USER_SYNC_V2_VERSION}', strftime('%s', 'now') * 1000);
      `);
    }

    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}
