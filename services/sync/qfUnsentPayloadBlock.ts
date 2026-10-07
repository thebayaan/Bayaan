import {
  mapOutboxEntryToSyncMutation,
  LocalUnsupportedNoteError,
  type QfOutboxEntryLike,
} from './qfSyncResourceMapper';
import type {QfSyncSqliteExecutor} from './qfSyncTransaction';

export interface UnsentPayloadCandidate extends QfOutboxEntryLike {
  ownerScope: string;
  localOperationId: string;
  revision: number;
  deliveryState: 'PENDING' | 'IN_FLIGHT' | 'AMBIGUOUS';
}

/** Always inspect actual bytes, even if an old writer did not increment revision.
 * Markers are diagnostic evidence, never authority to hide an operation. */
export async function refreshUnsentPayloadBlock(
  db: QfSyncSqliteExecutor,
  entry: UnsentPayloadCandidate,
): Promise<boolean> {
  let reason: string | null = null;
  if (entry.deliveryState === 'PENDING' && entry.resource === 'NOTE') {
    try {
      mapOutboxEntryToSyncMutation(entry);
    } catch (error) {
      if (!(error instanceof LocalUnsupportedNoteError)) throw error;
      reason = error.reason;
    }
  }
  if (reason) {
    await db.runAsync(
      `INSERT INTO qf_sync_payload_blocks
      (owner_scope, local_operation_id, reason, revision) VALUES (?, ?, ?, ?)
      ON CONFLICT(owner_scope, local_operation_id) DO UPDATE SET
        reason = excluded.reason, revision = excluded.revision`,
      [entry.ownerScope, entry.localOperationId, reason, entry.revision],
    );
    return true;
  }
  await db.runAsync(
    'DELETE FROM qf_sync_payload_blocks WHERE owner_scope = ? AND local_operation_id = ?',
    [entry.ownerScope, entry.localOperationId],
  );
  return false;
}
