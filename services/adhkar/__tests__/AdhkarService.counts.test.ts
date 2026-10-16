// Tasbeeh counts are per list in morning and evening (rows in both lists keep
// two counts) and keyed by the plain dhikr id everywhere else.
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {openDatabaseAsync, resetDatabases} from '@/test-utils/mockExpoSqlite';
import {adhkarDatabaseService} from '@/services/database/AdhkarDatabaseService';
import {ADHKAR_DATA_VERSION} from '@/services/database/adhkarDataVersion';
import adhkarSeed from '@/data/adhkar.json';
import type {AdhkarSeedData, SuperCategory} from '@/types/adhkar';
import {adhkarService} from '../AdhkarService';
import {dhikrCountKey} from '../dhikrCountKey';

const seedData: AdhkarSeedData = adhkarSeed;

async function superCategory(id: string): Promise<SuperCategory> {
  const found = await adhkarService.getSuperCategory(id);
  if (!found) throw new Error(`missing super category ${id}`);
  return found;
}

// Each case starts from an empty dhikr_counts table and seeds its own counts.
async function clearCounts(): Promise<void> {
  await adhkarService.initialize();
  const db = await openDatabaseAsync('adhkar.db');
  await db.runAsync('DELETE FROM dhikr_counts');
}

async function insertCount(
  key: string,
  count: number,
  lastUpdated: number = Date.now(),
): Promise<void> {
  const db = await openDatabaseAsync('adhkar.db');
  await db.runAsync(
    'INSERT INTO dhikr_counts (dhikr_id, count, last_updated) VALUES (?, ?, ?)',
    [key, count, lastUpdated],
  );
}

beforeEach(clearCounts);

afterAll(async () => {
  await adhkarDatabaseService.close();
  await resetDatabases();
});

describe('dhikrCountKey', () => {
  it('prefixes the key inside morning and evening only', async () => {
    const morning = await superCategory('morning-adhkar');
    const evening = await superCategory('evening-adhkar');
    const salah = await superCategory('salah');
    expect(dhikrCountKey('75', morning)).toBe('morning-adhkar:75');
    expect(dhikrCountKey('75', evening)).toBe('evening-adhkar:75');
    expect(dhikrCountKey('75', salah)).toBe('75');
    expect(dhikrCountKey('75')).toBe('75');
    expect(dhikrCountKey('75', null)).toBe('75');
  });
});

describe('per-list tasbeeh counts', () => {
  it('lists row 75 in both morning and evening', async () => {
    const morning = await superCategory('morning-adhkar');
    const evening = await superCategory('evening-adhkar');
    expect(morning.dhikrIds).toContain('75');
    expect(evening.dhikrIds).toContain('75');
  });

  it('counts row 75 independently in morning and evening', async () => {
    const morningKey = dhikrCountKey(
      '75',
      await superCategory('morning-adhkar'),
    );
    const eveningKey = dhikrCountKey(
      '75',
      await superCategory('evening-adhkar'),
    );

    await adhkarService.incrementDhikrCount(morningKey);
    await adhkarService.incrementDhikrCount(morningKey);
    await adhkarService.incrementDhikrCount(morningKey);

    expect(await adhkarService.getDhikrCount(morningKey)).toBe(3);
    expect(await adhkarService.getDhikrCount(eveningKey)).toBe(0);
    expect(await adhkarService.getDhikrCount('75')).toBe(0);

    await adhkarService.incrementDhikrCount(eveningKey);
    expect(await adhkarService.getDhikrCount(eveningKey)).toBe(1);
    expect(await adhkarService.getDhikrCount(morningKey)).toBe(3);

    await adhkarService.resetDhikrCount(eveningKey);
    expect(await adhkarService.getDhikrCount(eveningKey)).toBe(0);
    expect(await adhkarService.getDhikrCount(morningKey)).toBe(3);
  });

  it('uses the plain dhikr id for Saved and other lists', async () => {
    await adhkarService.incrementDhikrCount(dhikrCountKey('75'));
    await adhkarService.incrementDhikrCount(
      dhikrCountKey('75', await superCategory('salah')),
    );
    const db = await openDatabaseAsync('adhkar.db');
    const plain = await db.getFirstAsync<{count: number}>(
      "SELECT count FROM dhikr_counts WHERE dhikr_id = '75'",
    );
    expect(plain?.count).toBe(2);
  });

  it('loads every count key for the store', async () => {
    await insertCount('morning-adhkar:75', 3);
    await insertCount('75', 2);
    const counts = await adhkarService.getAllCounts();
    expect(counts).toEqual({'morning-adhkar:75': 3, '75': 2});
  });

  it('skips counts from an earlier day', async () => {
    await insertCount(
      'evening-adhkar:76',
      5,
      Date.now() - 3 * 24 * 60 * 60 * 1000,
    );
    const counts = await adhkarService.getAllCounts();
    expect(counts['evening-adhkar:76']).toBeUndefined();
    expect(await adhkarService.getDhikrCount('evening-adhkar:76')).toBe(0);
  });

  it('keeps per-list counts through a data version reseed', async () => {
    await insertCount('morning-adhkar:75', 3);
    await insertCount('75', 2);
    const db = await openDatabaseAsync('adhkar.db');
    await db.runAsync(
      "UPDATE adhkar_meta SET value = ? WHERE key = 'data_version'",
      [String(ADHKAR_DATA_VERSION - 1)],
    );
    expect(await adhkarDatabaseService.needsReseed()).toBe(true);

    await adhkarDatabaseService.reseed(
      seedData,
      seedData.super_category_dhikr_ids ?? {},
    );

    expect(await adhkarDatabaseService.needsReseed()).toBe(false);
    expect(await adhkarService.getAllCounts()).toEqual({
      'morning-adhkar:75': 3,
      '75': 2,
    });
  });
});
