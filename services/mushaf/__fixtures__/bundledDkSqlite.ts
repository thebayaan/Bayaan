// @ai-generated
/**
 * Test-only expo-sqlite stand-in serving the bundled DigitalKhatt DBs
 * through node:sqlite (Node >= 22.13), so the real DigitalKhattDataService
 * loads the real words and layout in a test (the *.alldbs suites):
 *
 *   jest.mock('expo-sqlite', () =>
 *     jest
 *       .requireActual('@/services/mushaf/__fixtures__/bundledDkSqlite')
 *       .bundledDkSqliteModule(),
 *   );
 *
 * Every on-device copy (`dk_words_warsh.<sha8>.db`) is read from the
 * bundled asset of its base (dk_words: digital-khatt-v2.db, dk_layout:
 * digital-khatt-15-lines.db, the others: <base>.db), from
 * BAYAAN_OVERLAY_DB_DIR when it holds that file (as the other *.alldbs
 * suites read their words DBs), else from the repo. Reads of a base in
 * `__fake.broken` fail like a damaged copy. Not imported by app code.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface BundledDkSqliteFake {
  /** On-device names imported so far. */
  readonly files: Set<string>;
  /** Bases whose reads fail ('dk_words_warsh'). */
  readonly broken: Set<string>;
  /** Bases read, in order. */
  readonly reads: string[];
}

interface SqliteDb {
  prepare(sql: string): {all(): Record<string, unknown>[]};
  close(): void;
}

const ASSET_OF_BASE: Record<string, string> = {
  dk_words: 'digital-khatt-v2.db',
  dk_layout: 'digital-khatt-15-lines.db',
};

const REPO_DK_DIR = path.join(process.cwd(), 'data/mushaf/digitalkhatt');

/** True when node:sqlite can be loaded (the suites skip otherwise). */
export function hasNodeSqlite(): boolean {
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
}

/** The bundled file a base is read from. */
export function bundledDkFile(base: string): string {
  const file = ASSET_OF_BASE[base] ?? `${base}.db`;
  const envDir = process.env.BAYAAN_OVERLAY_DB_DIR;
  const own =
    envDir && envDir !== 'bundled' && base !== 'dk_layout'
      ? path.join(envDir, file)
      : null;
  return own && fs.existsSync(own) ? own : path.join(REPO_DK_DIR, file);
}

export function bundledDkSqliteModule() {
  const {DatabaseSync} = require('node:sqlite') as {
    DatabaseSync: new (file: string, options?: object) => SqliteDb;
  };
  const fake: BundledDkSqliteFake = {
    files: new Set(),
    broken: new Set(),
    reads: [],
  };
  const baseOf = (name: string) =>
    name.replace(/\.db$/, '').replace(/\.[0-9a-f]{8}$/, '');
  return {
    __fake: fake,
    defaultDatabaseDirectory: '/data/user/0/app.test/files/SQLite',
    async openDatabaseAsync(name: string) {
      const base = baseOf(name);
      return {
        async getFirstAsync(sql: string) {
          if (!fake.files.has(name)) return null;
          return {name: /name='(\w+)'/.exec(sql)?.[1]};
        },
        async getAllAsync(sql: string) {
          if (fake.broken.has(base)) {
            throw new Error('database disk image is malformed');
          }
          fake.reads.push(base);
          const db = new DatabaseSync(bundledDkFile(base), {readOnly: true});
          try {
            return db.prepare(sql).all();
          } finally {
            db.close();
          }
        },
        closeAsync: async () => undefined,
      };
    },
    async importDatabaseFromAssetAsync(name: string) {
      fake.files.add(name);
    },
    async deleteDatabaseAsync(name: string) {
      fake.files.delete(name);
    },
  };
}
