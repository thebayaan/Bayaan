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

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type TranslationDb =
  typeof import('@/services/translation/TranslationDbService').translationDbService;
type RegistryModule = typeof import('../contentRegistry');
type MigrationModule = typeof import('../translationMigration');

interface Loaded {
  mock: MockModule;
  db: TranslationDb;
  registryModule: RegistryModule;
  migration: MigrationModule;
}

const TAG = 'v2.3.0';
const TABLES = ['translations', 'translation_metadata'];

// Everything that loads expo-sqlite is required inside one isolated registry,
// so the golden copy lands in the same mock directory the services open.
function load(): Loaded {
  let result: Loaded | undefined;
  jest.isolateModules(() => {
    const mock: MockModule = require('@/test-utils/mockExpoSqlite');
    copyGoldenInto(TAG, mock.databaseDir());
    result = {
      mock,
      db: require('@/services/translation/TranslationDbService')
        .translationDbService,
      registryModule: require('../contentRegistry'),
      migration: require('../translationMigration'),
    };
  });
  if (!result) throw new Error('services not loaded');
  return result;
}

async function digestsFromDisk(dir: string): Promise<Record<string, string>> {
  const db = openAdapterDatabase(path.join(dir, 'translations.db'));
  const out: Record<string, string> = {};
  for (const table of TABLES) {
    out[`translations/${table}`] = rowsDigest(await readTable(db, table));
  }
  await db.closeAsync();
  return out;
}

// The v2.3.0 golden translations.db holds one AlQuranCloud download,
// en.itani (10 synthetic verses), which has no QF edition. A matched one
// (en.pickthall) is added as v2.3.0 would have saved it.
describe('translations migration on the v2.3.0 golden translations.db', () => {
  let s: Loaded;
  let registry: ReturnType<RegistryModule['createSqliteContentRegistry']>;
  const settings = {selectedTranslationId: 'en.pickthall'};
  const notifyRemoved = jest.fn();

  function deps(now: number) {
    return {
      registry,
      db: s.db,
      settings: {
        getState: () => ({
          selectedTranslationId: settings.selectedTranslationId,
          setSelectedTranslationId: (id: string) => {
            settings.selectedTranslationId = id;
          },
        }),
      },
      notifyRemoved,
      reload: async () => undefined,
      now,
    };
  }

  beforeAll(async () => {
    s = load();
    const manifest = goldenManifest(TAG);
    const before = await digestsFromDisk(s.mock.databaseDir());
    for (const table of TABLES) {
      expect(before[`translations/${table}`]).toBe(
        manifest.digests[`translations/${table}`],
      );
    }
    // AppInitializer opens translations.db (adding translation_footnotes).
    await s.db.initialize();
    await s.db.saveTranslation(
      'en.pickthall',
      'Pickthall',
      'Mohammed Marmaduke William Pickthall',
      'en',
      'ltr',
      [1, 2, 3].map(ayah => ({
        surahNumber: 1,
        ayahNumber: ayah,
        verseKey: `1:${ayah}`,
        text: `pickthall 1:${ayah}`,
      })),
    );
    registry = s.registryModule.createSqliteContentRegistry();
  });

  it('finds both legacy downloads', async () => {
    expect(
      (await s.db.getDownloadedTranslations()).map(item => item.identifier),
    ).toEqual(expect.arrayContaining(['en.itani', 'en.pickthall']));
  });

  it('renames the matched edition in place, purges the other, and notifies once', async () => {
    expect(await s.migration.migrateLegacyTranslations(deps(1000))).toBe(true);

    const downloaded = await s.db.getDownloadedTranslations();
    expect(downloaded.map(item => item.identifier)).toEqual(['19']);
    expect(downloaded[0]).toMatchObject({
      englishName: 'Mohammed Marmaduke William Pickthall',
      verseCount: 3,
    });
    // Still readable offline under its QF id, text unchanged.
    expect(await s.db.getAllVerses('19')).toEqual({
      '1:1': 'pickthall 1:1',
      '1:2': 'pickthall 1:2',
      '1:3': 'pickthall 1:3',
    });
    expect(await s.db.getAllVerses('en.pickthall')).toEqual({});
    expect(await s.db.getAllVerses('en.itani')).toEqual({});

    const sqlite = await s.mock.openDatabaseAsync('translations.db');
    expect(await readTable(sqlite, 'translations')).toHaveLength(3);

    expect(await registry.get('qf:translations:19')).toMatchObject({
      kind: 'translation',
      version: 0,
      legacy: true,
      user_removed: false,
      installed_at: null,
    });
    expect(notifyRemoved).toHaveBeenCalledTimes(1);
    expect(notifyRemoved).toHaveBeenCalledWith(['Synthetic Translation']);
    expect(settings.selectedTranslationId).toBe('19');
    expect((await registry.getState()).translationsMigratedAt).toBe(1000);
  });

  it('is a no-op the second time', async () => {
    const rowsBefore = await registry.list();
    expect(await s.migration.migrateLegacyTranslations(deps(5000))).toBe(false);
    expect(await registry.list()).toEqual(rowsBefore);
    expect(notifyRemoved).toHaveBeenCalledTimes(1);
    expect((await registry.getState()).translationsMigratedAt).toBe(1000);
  });
});
