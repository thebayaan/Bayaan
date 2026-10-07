import {
  withQfSyncTransaction,
  type QfSyncTransactionDatabase,
  type QfSyncSqliteExecutor,
} from './qfSyncTransaction';

export class QfSqliteTransientError extends Error {
  constructor(cause: unknown) {
    super('Temporary local SQLite lock', {cause});
    this.name = 'QfSqliteTransientError';
  }
}

/** Only called at the local SQLite boundary, never on a provider/unknown error.
 * Exact result codes and bounded Expo/wa-sqlite diagnostics, no generic regex. */
function isKnownSqliteLock(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const sqlite = error as Error & {code?: unknown};
  const codes = new Set([
    5,
    6,
    261,
    262,
    517,
    518,
    773,
    'SQLITE_BUSY',
    'SQLITE_LOCKED',
    'SQLITE_BUSY_RECOVERY',
    'SQLITE_BUSY_SNAPSHOT',
    'SQLITE_BUSY_TIMEOUT',
    'SQLITE_LOCKED_SHAREDCACHE',
    'SQLITE_LOCKED_VTAB',
  ]);
  if (codes.has(sqlite.code as string | number)) return true;
  if (sqlite.code !== undefined && sqlite.code !== 'ERR_INTERNAL_SQLITE_ERROR')
    return false;
  if (error.message.length > 256) return false;
  // Installed Expo Android appends the integer result code as a char.
  // Normalize only those exact prefixes; the whole diagnostic stays anchored.
  const diagnostic = error.message
    .replace('Error code \u0005: ', 'Error code 5: ')
    .replace('Error code \u0006: ', 'Error code 6: ');
  return /^(?:Call to function 'Native(?:Database\.(?:execAsync|prepareAsync)|Statement\.(?:runAsync|stepAsync|getAllAsync|resetAsync|finalizeAsync))' has been rejected\.\n→ Caused by: )?(?:Error: )?(?:Error code (?:5|6): )?(?:database is locked|database table is locked|database schema is locked)(?: \([56]\))?$/.test(
    diagnostic,
  );
}

export async function atQfSqliteBoundary<T>(
  task: () => Promise<T>,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (isKnownSqliteLock(error)) throw new QfSqliteTransientError(error);
    throw error;
  }
}

/** Delegates unchanged transaction ownership/isolation; never retries SQL here. */
export async function withRetryableQfSyncTransaction(
  database: QfSyncTransactionDatabase,
  task: (txn: QfSyncSqliteExecutor) => Promise<void>,
): Promise<void> {
  await atQfSqliteBoundary(() => withQfSyncTransaction(database, task));
}
