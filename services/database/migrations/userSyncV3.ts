import {withRetryableQfSyncTransaction as withQfSyncTransaction} from '@/services/sync/qfSqliteRetry';
import {type QfSyncTransactionDatabase} from '@/services/sync/qfSyncTransaction';

export const USER_SYNC_V3_VERSION = 'user_sync_v3';

/** Additive metadata only: old annotation/outbox schemas and V1/V2 guards stay intact. */
export async function migrateUserSyncV3(
  db: QfSyncTransactionDatabase,
): Promise<void> {
  await withQfSyncTransaction(db, async txn => {
    const existing = await txn.getFirstAsync(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [USER_SYNC_V3_VERSION],
    );
    if (existing) return;
    await txn.runAsync(`CREATE TABLE qf_sync_payload_blocks (
      owner_scope TEXT NOT NULL,
      local_operation_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      revision INTEGER NOT NULL,
      PRIMARY KEY (owner_scope, local_operation_id)
    )`);
    await txn.runAsync(`CREATE INDEX idx_qf_sync_payload_blocks_owner_reason
      ON qf_sync_payload_blocks(owner_scope, reason)`);
    await txn.runAsync(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [USER_SYNC_V3_VERSION, Date.now()],
    );
  });
}
