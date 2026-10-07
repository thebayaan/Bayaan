import * as SQLite from 'expo-sqlite';
import type {ContentKind, LocalContentRow} from '@/types/content';

export interface ContentState {
  manifestEtag: string | null;
  lastCheckedAt: number | null;
  migratedAt: number | null;
  autoInstallDone: boolean;
}

export interface ContentRegistry {
  list(): Promise<LocalContentRow[]>;
  get(key: string): Promise<LocalContentRow | null>;
  upsert(row: LocalContentRow): Promise<void>;
  delete(key: string): Promise<void>;
  getState(): Promise<ContentState>;
  setState(patch: Partial<ContentState>): Promise<void>;
}

type Db = Pick<
  SQLite.SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync'
>;

const EMPTY_STATE: ContentState = {
  manifestEtag: null,
  lastCheckedAt: null,
  migratedAt: null,
  autoInstallDone: false,
};

export function emptyRow(key: string, kind: ContentKind): LocalContentRow {
  return {
    key,
    kind,
    version: 0,
    sha256: null,
    upstream_schema_version: null,
    installed_at: null,
    legacy: false,
    user_removed: false,
    failures: 0,
    next_retry_at: null,
    withdrawal_notified: false,
    name: null,
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS content_local (
  key TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  upstream_schema_version INTEGER,
  installed_at INTEGER,
  legacy INTEGER NOT NULL DEFAULT 0,
  user_removed INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER,
  withdrawal_notified INTEGER NOT NULL DEFAULT 0,
  name TEXT
);
CREATE TABLE IF NOT EXISTS content_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  manifest_etag TEXT,
  last_checked_at INTEGER,
  migrated_at INTEGER,
  auto_install_done INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO content_state (id) VALUES (1);
`;

interface RawRow {
  key: string;
  kind: string;
  version: number;
  sha256: string | null;
  upstream_schema_version: number | null;
  installed_at: number | null;
  legacy: number;
  user_removed: number;
  failures: number;
  next_retry_at: number | null;
  withdrawal_notified: number;
  name: string | null;
}

interface RawState {
  manifest_etag: string | null;
  last_checked_at: number | null;
  migrated_at: number | null;
  auto_install_done: number;
}

function fromRaw(raw: RawRow): LocalContentRow {
  return {
    key: raw.key,
    kind: raw.kind === 'translation' ? 'translation' : 'tafsir',
    version: raw.version,
    sha256: raw.sha256,
    upstream_schema_version: raw.upstream_schema_version,
    installed_at: raw.installed_at,
    legacy: raw.legacy === 1,
    user_removed: raw.user_removed === 1,
    failures: raw.failures,
    next_retry_at: raw.next_retry_at,
    withdrawal_notified: raw.withdrawal_notified === 1,
    name: raw.name,
  };
}

export function createSqliteContentRegistry(
  open: () => Promise<Db> = () => SQLite.openDatabaseAsync('content.db'),
): ContentRegistry {
  let ready: Promise<Db> | null = null;
  function db(): Promise<Db> {
    ready ??= open().then(async opened => {
      await opened.execAsync(SCHEMA);
      return opened;
    });
    return ready;
  }
  const registry: ContentRegistry = {
    async list() {
      // SQLite JSON boundary.
      const rows = (await (
        await db()
      ).getAllAsync('SELECT * FROM content_local')) as RawRow[];
      return rows.map(fromRaw);
    },
    async get(key) {
      const rows = (await (
        await db()
      ).getAllAsync('SELECT * FROM content_local WHERE key = ?', [
        key,
      ])) as RawRow[];
      return rows[0] ? fromRaw(rows[0]) : null;
    },
    async upsert(row) {
      await (
        await db()
      ).runAsync(
        `INSERT OR REPLACE INTO content_local
         (key, kind, version, sha256, upstream_schema_version, installed_at, legacy, user_removed, failures, next_retry_at, withdrawal_notified, name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.key,
          row.kind,
          row.version,
          row.sha256,
          row.upstream_schema_version,
          row.installed_at,
          row.legacy ? 1 : 0,
          row.user_removed ? 1 : 0,
          row.failures,
          row.next_retry_at,
          row.withdrawal_notified ? 1 : 0,
          row.name,
        ],
      );
    },
    async delete(key) {
      await (
        await db()
      ).runAsync('DELETE FROM content_local WHERE key = ?', [key]);
    },
    async getState() {
      // SQLite JSON boundary.
      const raw = (await (
        await db()
      ).getFirstAsync(
        'SELECT * FROM content_state WHERE id = 1',
      )) as RawState | null;
      if (!raw) return {...EMPTY_STATE};
      return {
        manifestEtag: raw.manifest_etag,
        lastCheckedAt: raw.last_checked_at,
        migratedAt: raw.migrated_at,
        autoInstallDone: raw.auto_install_done === 1,
      };
    },
    async setState(patch) {
      const next = {...(await registry.getState()), ...patch};
      await (
        await db()
      ).runAsync(
        'UPDATE content_state SET manifest_etag = ?, last_checked_at = ?, migrated_at = ?, auto_install_done = ? WHERE id = 1',
        [
          next.manifestEtag,
          next.lastCheckedAt,
          next.migratedAt,
          next.autoInstallDone ? 1 : 0,
        ],
      );
    },
  };
  return registry;
}

export function createMemoryContentRegistry(): ContentRegistry {
  const rows = new Map<string, LocalContentRow>();
  let state: ContentState = {...EMPTY_STATE};
  return {
    async list() {
      return [...rows.values()].map(row => ({...row}));
    },
    async get(key) {
      const row = rows.get(key);
      return row ? {...row} : null;
    },
    async upsert(row) {
      rows.set(row.key, {...row});
    },
    async delete(key) {
      rows.delete(key);
    },
    async getState() {
      return {...state};
    },
    async setState(patch) {
      state = {...state, ...patch};
    },
  };
}
