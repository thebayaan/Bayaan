// A version 5 install with Saved adhkar and tasbeeh counts on rows whose text
// changes in version 6 (77, 83) and on a row that does not (255). The golden
// databases only hold rows 1-3, so this pins the rows the content fix touches.
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import path from 'path';
import {copyGoldenInto, readTable, type Row} from '@/test-utils/goldenDb';
import {databaseDir, resetDatabases} from '@/test-utils/mockExpoSqlite';
import {openAdapterDatabase} from '@/test-utils/sqliteAdapter';
import {adhkarDatabaseService} from '../AdhkarDatabaseService';
import {adhkarService} from '@/services/adhkar/AdhkarService';
import {ADHKAR_DATA_VERSION} from '../adhkarDataVersion';

const GOLDEN_TAG = 'v2.3.0';
const SAVED_IDS = ['77', '83', '255'];

interface UserTables {
  favorites: Row[];
  counts: Row[];
}

let before: UserTables;
let version5Text77 = '';

async function readUserTables(file: string): Promise<UserTables> {
  const db = openAdapterDatabase(file);
  const tables = {
    favorites: await readTable(db, 'dhikr_favorites'),
    counts: await readTable(db, 'dhikr_counts'),
  };
  await db.closeAsync();
  return tables;
}

beforeAll(async () => {
  copyGoldenInto(GOLDEN_TAG, databaseDir());
  const file = path.join(databaseDir(), 'adhkar.db');
  const db = openAdapterDatabase(file);
  const meta = await db.getFirstAsync<{value: string}>(
    "SELECT value FROM adhkar_meta WHERE key = 'data_version'",
  );
  expect(meta?.value).toBe('5');
  const row77 = await db.getFirstAsync<{arabic: string}>(
    "SELECT arabic FROM adhkar WHERE id = '77'",
  );
  version5Text77 = row77?.arabic ?? '';
  for (const [index, id] of SAVED_IDS.entries()) {
    await db.runAsync(
      'INSERT INTO dhikr_favorites (dhikr_id, created_at) VALUES (?, ?)',
      [id, 1760000000 + index],
    );
    await db.runAsync(
      'INSERT INTO dhikr_counts (dhikr_id, count, last_updated) VALUES (?, ?, ?)',
      [id, 10 + index, 1760000000000 + index],
    );
  }
  await db.closeAsync();
  before = await readUserTables(file);

  await adhkarService.initialize();
});

afterAll(async () => {
  await adhkarDatabaseService.close();
  await resetDatabases();
});

describe('version 6 reseed over saved adhkar', () => {
  it('starts from version 5 text that still carries the evening note', () => {
    expect(version5Text77).toContain('وإذا أمسى');
    for (const id of SAVED_IDS) {
      expect(before.favorites.map(r => r.dhikr_id)).toContain(id);
      expect(before.counts.map(r => r.dhikr_id)).toContain(id);
    }
  });

  it('reseeds to the new data version and serves the new text', async () => {
    const db = openAdapterDatabase(path.join(databaseDir(), 'adhkar.db'));
    const meta = await db.getFirstAsync<{value: string}>(
      "SELECT value FROM adhkar_meta WHERE key = 'data_version'",
    );
    await db.closeAsync();
    expect(ADHKAR_DATA_VERSION).toBe(9);
    expect(meta?.value).toBe('9');
    expect(await adhkarDatabaseService.needsReseed()).toBe(false);
    const row77 = await adhkarService.getDhikr('77');
    expect(row77?.arabic.startsWith('((أَصْبَحْنَا')).toBe(true);
    expect(row77?.arabic).not.toContain('وإذا أمسى');
  });

  it('keeps every saved row and tasbeeh count byte-equal', async () => {
    const after = await readUserTables(path.join(databaseDir(), 'adhkar.db'));
    expect(after).toEqual(before);
    const saved = await adhkarDatabaseService.getSaved();
    expect(saved.map(s => s.dhikrId)).toEqual(
      expect.arrayContaining(SAVED_IDS),
    );
    for (const id of SAVED_IDS) {
      expect({id, found: (await adhkarService.getDhikr(id)) !== null}).toEqual({
        id,
        found: true,
      });
    }
  });

  it('lets an evening row be saved after the upgrade', async () => {
    expect(await adhkarService.getDhikr('evening-77')).not.toBeNull();
    expect(await adhkarDatabaseService.toggleSaved('evening-77')).toBe(true);
    const saved = await adhkarDatabaseService.getSaved();
    expect(saved.map(s => s.dhikrId)).toEqual(
      expect.arrayContaining([...SAVED_IDS, 'evening-77']),
    );
  });
});
