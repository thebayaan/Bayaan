jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import path from 'path';
import {
  copyGoldenInto,
  goldenManifest,
  readTable,
  rowsDigest,
} from '@/test-utils/goldenDb';
import {openAdapterDatabase} from '@/test-utils/sqliteAdapter';
import type {EngineDeps} from '../contentEngine';

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type Tafseer =
  typeof import('@/services/tafseer/TafseerDbService').tafseerDbService;
type RegistryModule = typeof import('../contentRegistry');
type MigrationModule = typeof import('../legacyMigration');

interface Loaded {
  mock: MockModule;
  tafseer: Tafseer;
  registryModule: RegistryModule;
  migration: MigrationModule;
}

const TAG = 'v2.3.0';
const TAFSEER_TABLES = ['tafaseer', 'tafseer_metadata'];

// Everything that loads expo-sqlite is required inside one isolated registry,
// so the golden copy lands in the same mock directory the services open.
function load(): Loaded {
  let result: Loaded | undefined;
  jest.isolateModules(() => {
    const mock: MockModule = require('@/test-utils/mockExpoSqlite');
    copyGoldenInto(TAG, mock.databaseDir());
    result = {
      mock,
      tafseer: require('@/services/tafseer/TafseerDbService').tafseerDbService,
      registryModule: require('../contentRegistry'),
      migration: require('../legacyMigration'),
    };
  });
  if (!result) throw new Error('services not loaded');
  return result;
}

async function digestsFromDisk(dir: string): Promise<Record<string, string>> {
  const db = openAdapterDatabase(path.join(dir, 'tafaseer.db'));
  const out: Record<string, string> = {};
  for (const table of TAFSEER_TABLES) {
    out[`tafaseer/${table}`] = rowsDigest(await readTable(db, table));
  }
  await db.closeAsync();
  return out;
}

async function digestsFromService(
  mock: MockModule,
): Promise<{digests: Record<string, string>; counts: Record<string, number>}> {
  const db = await mock.openDatabaseAsync('tafaseer.db');
  const digests: Record<string, string> = {};
  const counts: Record<string, number> = {};
  for (const table of TAFSEER_TABLES) {
    const rows = await readTable(db, table);
    digests[`tafaseer/${table}`] = rowsDigest(rows);
    counts[`tafaseer/${table}`] = rows.length;
  }
  return {digests, counts};
}

function engineDeps(
  registry: EngineDeps['registry'],
  installers: EngineDeps['installers'],
): EngineDeps {
  return {
    api: {
      fetchManifest: jest.fn(),
      getDownloadTicket: jest.fn(),
      fetchText: jest.fn(),
    },
    registry,
    installers,
    isOnWifi: jest.fn().mockResolvedValue(true),
    sha256: jest.fn(),
    now: () => 2000,
    notify: jest.fn(),
    track: jest.fn(),
  };
}

describe('legacy migration on v2.3.0 golden databases', () => {
  let s: Loaded;
  let registry: ReturnType<RegistryModule['createSqliteContentRegistry']>;
  let legacyIds: string[];

  beforeAll(async () => {
    s = load();
    const manifest = goldenManifest(TAG);
    const before = await digestsFromDisk(s.mock.databaseDir());
    for (const table of TAFSEER_TABLES) {
      expect(before[`tafaseer/${table}`]).toBe(
        manifest.digests[`tafaseer/${table}`],
      );
    }
    // AppInitializer opens tafaseer.db before anything reads it.
    await s.tafseer.initialize();
    legacyIds = (await s.tafseer.getDownloadedTafaseer()).map(
      item => item.identifier,
    );
    registry = s.registryModule.createSqliteContentRegistry();
  });

  it('finds the two downloaded tafsirs in the golden set', () => {
    expect([...legacyIds].sort()).toEqual(['16', '169']);
  });

  it('creates legacy version 0 rows in content.db and leaves tafaseer.db untouched', async () => {
    expect(
      await s.migration.migrateLegacyContent(registry, legacyIds, 1000),
    ).toBe(2);
    for (const key of ['qf:tafsirs:169', 'qf:tafsirs:16']) {
      expect(await registry.get(key)).toMatchObject({
        key,
        kind: 'tafsir',
        version: 0,
        legacy: true,
        user_removed: false,
        installed_at: null,
      });
    }
    expect((await registry.getState()).migratedAt).toBe(1000);

    const manifest = goldenManifest(TAG);
    const after = await digestsFromService(s.mock);
    for (const table of TAFSEER_TABLES) {
      const k = `tafaseer/${table}`;
      expect(after.counts[k]).toBe(manifest.tables[k]);
      expect(after.digests[k]).toBe(manifest.digests[k]);
    }
  });

  it('is a no-op the second time', async () => {
    const rowsBefore = await registry.list();
    expect(
      await s.migration.migrateLegacyContent(
        registry,
        [...legacyIds, '999'],
        5000,
      ),
    ).toBe(0);
    expect((await registry.getState()).migratedAt).toBe(1000);
    expect(await registry.get('qf:tafsirs:999')).toBeNull();
    expect(await registry.list()).toEqual(rowsBefore);
  });

  it('does not reinstall Ibn Kathir after the user removed it', async () => {
    const key = s.migration.AUTO_INSTALL_KEY;
    const row = await registry.get(key);
    if (!row) throw new Error('missing migrated row');
    await registry.upsert({...row, legacy: false, user_removed: true});
    const install = jest.fn();
    const deps = engineDeps(registry, {
      tafsir: {
        kind: 'tafsir',
        supportsSchemaVersion: () => true,
        install,
        remove: jest.fn(),
        onWithdrawn: jest.fn(),
      },
    });
    expect(await s.migration.maybeAutoInstall(deps)).toBe(false);
    expect(deps.api.getDownloadTicket).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
    expect(await registry.get(key)).toMatchObject({user_removed: true});
    expect((await registry.getState()).autoInstallDone).toBe(true);
  });
});
