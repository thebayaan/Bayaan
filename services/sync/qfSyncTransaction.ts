import * as SQLite from 'expo-sqlite';
import {Platform} from 'react-native';

/** Only SQL operations, not another transaction or the shared connection. */
export type QfSyncSqliteExecutor = Pick<
  SQLite.SQLiteDatabase,
  'runAsync' | 'getAllAsync' | 'getFirstAsync'
>;

export interface QfSyncTransactionDatabase {
  readonly databasePath: string;
  readonly options: SQLite.SQLiteDatabase['options'];
  withExclusiveTransactionAsync(
    task: (txn: QfSyncSqliteExecutor) => Promise<void>,
  ): Promise<void>;
}

/**
 * Rollback must never include unrelated annotation writes on the live handle.
 * Every operation in task (including annotation helpers) must use txn.
 * SQLite lock errors are surfaced to the caller, never retried on the live DB.
 */
export async function withQfSyncTransaction(
  database: QfSyncTransactionDatabase,
  task: (txn: QfSyncSqliteExecutor) => Promise<void>,
): Promise<void> {
  if (Platform.OS !== 'web') {
    await database.withExclusiveTransactionAsync(task);
    return;
  }

  // Expo's exclusive API rejects web, but its web worker honors
  // useNewConnection. A private handle gives the same rollback boundary;
  // using withTransactionAsync on the shared handle here would not.
  const txn = await SQLite.openDatabaseAsync(database.databasePath, {
    ...database.options,
    useNewConnection: true,
  });
  try {
    await txn.execAsync('BEGIN');
    try {
      await task(txn);
      await txn.execAsync('COMMIT');
    } catch (error) {
      await txn.execAsync('ROLLBACK');
      throw error;
    }
  } finally {
    await txn.closeAsync();
  }
}
