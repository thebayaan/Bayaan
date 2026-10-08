jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {closeOpenDatabases, resetDatabases} from '@/test-utils/mockExpoSqlite';
import {
  createMemoryContentRegistry,
  createSqliteContentRegistry,
  emptyRow,
} from '../contentRegistry';

describe('memory registry', () => {
  it('upserts, lists, deletes and patches state', async () => {
    const registry = createMemoryContentRegistry();
    await registry.upsert({
      ...emptyRow('qf:tafsirs:169', 'tafsir'),
      version: 2,
    });
    expect((await registry.get('qf:tafsirs:169'))?.version).toBe(2);
    expect(await registry.list()).toHaveLength(1);
    await registry.delete('qf:tafsirs:169');
    expect(await registry.get('qf:tafsirs:169')).toBeNull();
    expect(await registry.getState()).toEqual({
      manifestEtag: null,
      lastCheckedAt: null,
      migratedAt: null,
      autoInstallDone: false,
      manifest: null,
    });
    await registry.setState({lastCheckedAt: 5});
    expect((await registry.getState()).lastCheckedAt).toBe(5);
  });
});

describe('sqlite registry (stubbed db)', () => {
  it('creates tables and maps rows to booleans', async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const runAsync = jest.fn().mockResolvedValue(undefined);
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        key: 'qf:tafsirs:169',
        kind: 'tafsir',
        version: 3,
        sha256: 's',
        upstream_schema_version: 1,
        installed_at: 9,
        legacy: 0,
        user_removed: 1,
        failures: 0,
        next_retry_at: null,
        withdrawal_notified: 0,
        name: 'Ibn Kathir',
      },
    ]);
    const getFirstAsync = jest.fn().mockResolvedValue({
      manifest_etag: '"e"',
      last_checked_at: 7,
      migrated_at: null,
      auto_install_done: 1,
      manifest_json: null,
    });
    const db = {execAsync, runAsync, getAllAsync, getFirstAsync};
    const registry = createSqliteContentRegistry(() =>
      Promise.resolve(db as never),
    );

    const rows = await registry.list();
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS content_local'),
    );
    expect(rows[0]).toMatchObject({
      version: 3,
      legacy: false,
      user_removed: true,
      withdrawal_notified: false,
    });
    expect(await registry.getState()).toEqual({
      manifestEtag: '"e"',
      lastCheckedAt: 7,
      migratedAt: null,
      autoInstallDone: true,
      manifest: null,
    });

    await registry.upsert(rows[0]);
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO content_local'),
      expect.arrayContaining(['qf:tafsirs:169', 3, 1]),
    );
  });
});

describe('sqlite registry (real SQLite)', () => {
  beforeEach(async () => {
    await resetDatabases();
  });

  it('round-trips rows and state', async () => {
    const registry = createSqliteContentRegistry();
    expect(await registry.list()).toEqual([]);
    expect(await registry.get('nope')).toBeNull();
    const row = {
      ...emptyRow('qf:translations:20', 'translation'),
      version: 4,
      sha256: 'abc',
      upstream_schema_version: 1,
      installed_at: 100,
      legacy: true,
      user_removed: true,
      failures: 2,
      next_retry_at: 500,
      withdrawal_notified: true,
      name: 'Saheeh',
    };
    await registry.upsert(row);
    expect(await registry.get(row.key)).toEqual(row);
    await registry.upsert({...row, version: 5});
    expect(await registry.list()).toHaveLength(1);
    expect((await registry.get(row.key))?.version).toBe(5);
    await registry.delete(row.key);
    expect(await registry.list()).toEqual([]);

    expect(await registry.getState()).toEqual({
      manifestEtag: null,
      lastCheckedAt: null,
      migratedAt: null,
      autoInstallDone: false,
      manifest: null,
    });
    await registry.setState({manifestEtag: '"e"', autoInstallDone: true});
    await registry.setState({lastCheckedAt: 9});
    expect(await registry.getState()).toEqual({
      manifestEtag: '"e"',
      lastCheckedAt: 9,
      migratedAt: null,
      autoInstallDone: true,
      manifest: null,
    });
  });

  it('round-trips the cached manifest and drops an invalid one', async () => {
    const registry = createSqliteContentRegistry();
    const manifest = {
      format: 1 as const,
      generated_at: 'x',
      paused: false,
      resources: [],
    };
    await registry.setState({manifest});
    expect((await registry.getState()).manifest).toEqual(manifest);
    await registry.setState({manifest: null});
    expect((await registry.getState()).manifest).toBeNull();
  });

  it('adds manifest_json to a content.db created before the column existed', async () => {
    const SQLite: typeof import('expo-sqlite') = require('expo-sqlite');
    const old = await SQLite.openDatabaseAsync('content.db');
    await old.execAsync(`
      CREATE TABLE content_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        manifest_etag TEXT,
        last_checked_at INTEGER,
        migrated_at INTEGER,
        auto_install_done INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO content_state (id, manifest_etag, migrated_at) VALUES (1, '"old"', 7);
    `);
    await closeOpenDatabases();

    const registry = createSqliteContentRegistry();
    expect(await registry.getState()).toMatchObject({
      manifestEtag: '"old"',
      migratedAt: 7,
      manifest: null,
    });
    const manifest = {
      format: 1 as const,
      generated_at: 'y',
      paused: true,
      resources: [],
    };
    await registry.setState({manifest});
    expect((await registry.getState()).manifest).toEqual(manifest);
    await closeOpenDatabases();
    // Re-opening does not try to add the column twice.
    expect((await createSqliteContentRegistry().getState()).manifest).toEqual(
      manifest,
    );
  });

  it('persists rows and state across a close and re-initialize', async () => {
    const first = createSqliteContentRegistry();
    await first.upsert({
      ...emptyRow('qf:tafsirs:169', 'tafsir'),
      version: 3,
      name: 'Ibn Kathir',
    });
    await first.setState({migratedAt: 42, autoInstallDone: true});
    await closeOpenDatabases();

    const second = createSqliteContentRegistry();
    expect(await second.get('qf:tafsirs:169')).toMatchObject({
      version: 3,
      name: 'Ibn Kathir',
    });
    expect(await second.getState()).toMatchObject({
      migratedAt: 42,
      autoInstallDone: true,
    });
  });
});
