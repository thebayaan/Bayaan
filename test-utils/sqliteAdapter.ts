import Database from 'better-sqlite3';

export type SqlValue = string | number | null | boolean | Uint8Array;
export type SqlParams =
  | []
  | [SqlValue[]]
  | [Record<string, SqlValue>]
  | SqlValue[];

export interface AdapterExecutor {
  execAsync(source: string): Promise<void>;
  runAsync(
    source: string,
    ...params: SqlParams
  ): Promise<{lastInsertRowId: number; changes: number}>;
  getAllAsync<T>(source: string, ...params: SqlParams): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: SqlParams): Promise<T | null>;
}

export interface AdapterDatabase extends AdapterExecutor {
  readonly databasePath: string;
  readonly options: Record<string, never>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  // Like expo-sqlite, runs task on a separate connection inside
  // BEGIN EXCLUSIVE, so writes on the shared handle are not part of it.
  withExclusiveTransactionAsync(
    task: (txn: AdapterExecutor) => Promise<void>,
  ): Promise<void>;
  closeAsync(): Promise<void>;
}

type Bindable = string | number | bigint | null | Buffer;

function toBindable(value: SqlValue): Bindable {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return value;
}

// expo-sqlite accepts (sql, [a, b]), (sql, a, b) or (sql, {$name: v}).
function normalize(params: SqlParams): Bindable[] | Record<string, Bindable> {
  if (params.length === 1 && Array.isArray(params[0]))
    return params[0].map(toBindable);
  if (
    params.length === 1 &&
    params[0] !== null &&
    typeof params[0] === 'object' &&
    !(params[0] instanceof Uint8Array)
  ) {
    const named: Record<string, Bindable> = {};
    for (const [key, value] of Object.entries(params[0])) {
      if (!/^[$:@]/.test(key))
        throw new Error('named SQL parameters must be prefixed with $, : or @');
      named[key.slice(1)] = toBindable(value);
    }
    return named;
  }
  return (params as SqlValue[]).map(toBindable);
}

// better-sqlite3 caches its native addon per process and keeps the SqliteError
// constructor from the first Jest test file a worker ran. Later files in the
// same worker run in a new VM realm, so those errors fail `instanceof Error`
// there and `expect(...).rejects.toThrow()` reports "did not throw". Rebuild
// them as errors of the current realm, the way expo-sqlite surfaces failures.
export function toLocalError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error !== 'object' || error === null)
    return new Error(String(error));
  const message = 'message' in error ? String(error.message) : String(error);
  const local = new Error(message);
  if ('name' in error && typeof error.name === 'string')
    local.name = error.name;
  if ('code' in error) Object.assign(local, {code: error.code});
  return local;
}

function native<T>(call: () => T): T {
  try {
    return call();
  } catch (error) {
    throw toLocalError(error);
  }
}

function executorFor(db: Database.Database): AdapterExecutor {
  return {
    async execAsync(source) {
      native(() => db.exec(source));
    },
    async runAsync(source, ...params) {
      const info = native(() => db.prepare(source).run(normalize(params)));
      return {
        lastInsertRowId: Number(info.lastInsertRowid),
        changes: info.changes,
      };
    },
    async getAllAsync<T>(source: string, ...params: SqlParams) {
      return native(() => db.prepare(source).all(normalize(params))) as T[];
    },
    async getFirstAsync<T>(source: string, ...params: SqlParams) {
      const row = native(() => db.prepare(source).get(normalize(params)));
      return (row ?? null) as T | null;
    },
  };
}

export function openAdapterDatabase(filePath: string): AdapterDatabase {
  const db = native(() => new Database(filePath));
  let depth = 0;
  return {
    ...executorFor(db),
    databasePath: filePath,
    options: {},
    async withTransactionAsync(task) {
      // expo-sqlite does not support nested withTransactionAsync; fail loudly like it does.
      if (depth > 0)
        throw new Error(
          'nested withTransactionAsync is not supported by expo-sqlite',
        );
      depth++;
      native(() => db.exec('BEGIN'));
      try {
        await task();
        native(() => db.exec('COMMIT'));
      } catch (error) {
        native(() => db.exec('ROLLBACK'));
        throw error;
      } finally {
        depth--;
      }
    },
    async withExclusiveTransactionAsync(task) {
      const own = native(() => new Database(filePath));
      try {
        native(() => own.exec('BEGIN EXCLUSIVE'));
        try {
          await task(executorFor(own));
          native(() => own.exec('COMMIT'));
        } catch (error) {
          native(() => own.exec('ROLLBACK'));
          throw error;
        }
      } finally {
        native(() => own.close());
      }
    },
    async closeAsync() {
      native(() => db.close());
    },
  };
}
