import Database from 'better-sqlite3';

export type SqlValue = string | number | null | boolean | Uint8Array;
export type SqlParams =
  | []
  | [SqlValue[]]
  | [Record<string, SqlValue>]
  | SqlValue[];

export interface AdapterDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(
    source: string,
    ...params: SqlParams
  ): Promise<{lastInsertRowId: number; changes: number}>;
  getAllAsync<T>(source: string, ...params: SqlParams): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: SqlParams): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
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
    for (const [key, value] of Object.entries(params[0]))
      named[key.replace(/^[$:@]/, '')] = toBindable(value);
    return named;
  }
  return (params as SqlValue[]).map(toBindable);
}

export function openAdapterDatabase(filePath: string): AdapterDatabase {
  const db = new Database(filePath);
  let depth = 0;
  return {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, ...params) {
      const info = db.prepare(source).run(normalize(params));
      return {
        lastInsertRowId: Number(info.lastInsertRowid),
        changes: info.changes,
      };
    },
    async getAllAsync<T>(source: string, ...params: SqlParams) {
      return db.prepare(source).all(normalize(params)) as T[];
    },
    async getFirstAsync<T>(source: string, ...params: SqlParams) {
      const row = db.prepare(source).get(normalize(params));
      return (row ?? null) as T | null;
    },
    async withTransactionAsync(task) {
      // expo-sqlite runs the task inside BEGIN/COMMIT; nested calls join the outer transaction.
      if (depth > 0) {
        await task();
        return;
      }
      depth++;
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        depth--;
      }
    },
    async closeAsync() {
      db.close();
    },
  };
}
