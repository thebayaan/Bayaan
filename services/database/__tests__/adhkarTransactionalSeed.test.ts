// The reseed replaces content, super categories and the data version in one
// transaction: a seed that throws midway must leave the previous data, the
// previous version and the user tables as they were.
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {openDatabaseAsync, resetDatabases} from '@/test-utils/mockExpoSqlite';
import {adhkarDatabaseService} from '../AdhkarDatabaseService';
import {ADHKAR_DATA_VERSION} from '../adhkarDataVersion';
import type {AdhkarSeedData} from '@/types/adhkar';

type SeedRow = AdhkarSeedData['adhkar'][number];

function row(id: string, orderIndex: number, arabic: string): SeedRow {
  return {
    id,
    category_id: '27',
    arabic,
    translation: null,
    transliteration: null,
    instruction: null,
    repeat_count: 1,
    audio_file: null,
    order_index: orderIndex,
  };
}

function seed(adhkar: SeedRow[], title: string): AdhkarSeedData {
  return {
    categories: [{id: '27', title, broad_tags: ['daily'], dhikr_count: 2}],
    adhkar,
  };
}

const OLD_SEED = seed([row('1', 0, 'old 1'), row('2', 1, 'old 2')], 'Old');
// Duplicate primary key: the adhkar insert fails after the deletes and the
// category and tag inserts already ran.
const BROKEN_SEED = seed([row('1', 0, 'new 1'), row('1', 1, 'new 1')], 'New');

async function storedVersion(): Promise<string | null> {
  const db = await openDatabaseAsync('adhkar.db');
  const meta = await db.getFirstAsync<{value: string}>(
    "SELECT value FROM adhkar_meta WHERE key = 'data_version'",
  );
  return meta?.value ?? null;
}

async function setStoredVersion(version: number): Promise<void> {
  const db = await openDatabaseAsync('adhkar.db');
  await db.runAsync(
    "UPDATE adhkar_meta SET value = ? WHERE key = 'data_version'",
    [String(version)],
  );
}

beforeEach(async () => {
  await adhkarDatabaseService.initialize();
  await adhkarDatabaseService.reseed(OLD_SEED, {'morning-adhkar': ['1', '2']});
});

afterEach(async () => {
  await adhkarDatabaseService.close();
  await resetDatabases();
});

describe('transactional reseed', () => {
  it('stores the data version only with the seeded content', async () => {
    expect(await storedVersion()).toBe(String(ADHKAR_DATA_VERSION));
    expect(await adhkarDatabaseService.needsReseed()).toBe(false);
    expect((await adhkarDatabaseService.getDhikr('1'))?.arabic).toBe('old 1');
    const morning =
      await adhkarDatabaseService.getSuperCategory('morning-adhkar');
    expect(morning?.dhikrIds).toEqual(['1', '2']);
  });

  it('stores per-list audio overrides with the reseed', async () => {
    await adhkarDatabaseService.reseed(
      OLD_SEED,
      {'evening-adhkar': ['1']},
      {'evening-adhkar': {'1': 'adhkar_evening_1.mp3'}},
    );
    const evening =
      await adhkarDatabaseService.getSuperCategory('evening-adhkar');
    expect(evening?.audioOverrides).toEqual({'1': 'adhkar_evening_1.mp3'});
    const morning =
      await adhkarDatabaseService.getSuperCategory('morning-adhkar');
    expect(morning?.audioOverrides).toBeNull();
  });

  it('keeps the previous data and version when the seed throws midway', async () => {
    await setStoredVersion(ADHKAR_DATA_VERSION - 1);
    const db = await openDatabaseAsync('adhkar.db');
    await db.runAsync(
      'INSERT INTO dhikr_favorites (dhikr_id, created_at) VALUES (?, ?)',
      ['2', 1760000000],
    );
    await db.runAsync(
      'INSERT INTO dhikr_counts (dhikr_id, count, last_updated) VALUES (?, ?, ?)',
      ['morning-adhkar:2', 3, Date.now()],
    );

    await expect(
      adhkarDatabaseService.reseed(BROKEN_SEED, {'morning-adhkar': ['1']}),
    ).rejects.toThrow();

    expect(await storedVersion()).toBe(String(ADHKAR_DATA_VERSION - 1));
    expect(await adhkarDatabaseService.needsReseed()).toBe(true);
    const adhkar = await adhkarDatabaseService.getAdhkarInCategory('27');
    expect(adhkar.map(d => [d.id, d.arabic])).toEqual([
      ['1', 'old 1'],
      ['2', 'old 2'],
    ]);
    const categories = await adhkarDatabaseService.getAllCategories();
    expect(categories.map(c => [c.id, c.title, c.broadTags])).toEqual([
      ['27', 'Old', ['daily']],
    ]);
    const morning =
      await adhkarDatabaseService.getSuperCategory('morning-adhkar');
    expect(morning?.dhikrIds).toEqual(['1', '2']);
    expect(
      (await adhkarDatabaseService.getSaved()).map(s => s.dhikrId),
    ).toEqual(['2']);
    expect(
      (await adhkarDatabaseService.getTodayDhikrCounts()).map(c => [
        c.dhikrId,
        c.count,
      ]),
    ).toEqual([['morning-adhkar:2', 3]]);
  });

  it('retries after a failed reseed and then stores the version', async () => {
    await setStoredVersion(ADHKAR_DATA_VERSION - 1);
    await expect(
      adhkarDatabaseService.reseed(BROKEN_SEED, {}),
    ).rejects.toThrow();

    const fixed = seed([row('1', 0, 'new 1'), row('2', 1, 'new 2')], 'New');
    await adhkarDatabaseService.reseed(fixed, {'morning-adhkar': ['2']});

    expect(await storedVersion()).toBe(String(ADHKAR_DATA_VERSION));
    expect((await adhkarDatabaseService.getDhikr('1'))?.arabic).toBe('new 1');
    const morning =
      await adhkarDatabaseService.getSuperCategory('morning-adhkar');
    expect(morning?.dhikrIds).toEqual(['2']);
  });

  it('rolls back a standalone seedDatabase that throws midway', async () => {
    await expect(
      adhkarDatabaseService.seedDatabase(BROKEN_SEED),
    ).rejects.toThrow();
    const adhkar = await adhkarDatabaseService.getAdhkarInCategory('27');
    expect(adhkar.map(d => d.arabic)).toEqual(['old 1', 'old 2']);
  });
});
