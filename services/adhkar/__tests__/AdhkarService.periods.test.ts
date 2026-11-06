// Fresh install over the real data/adhkar.json: the screens' data path.
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {resetDatabases} from '@/test-utils/mockExpoSqlite';
import {adhkarDatabaseService} from '@/services/database/AdhkarDatabaseService';
import adhkarSeed from '@/data/adhkar.json';
import {adhkarService} from '../AdhkarService';

afterAll(async () => {
  await adhkarDatabaseService.close();
  await resetDatabases();
});

async function listIds(superId: string): Promise<string[]> {
  const data = await adhkarService.getAdhkarForSuperCategory(superId);
  expect(data?.categoryGroups).toHaveLength(1);
  return data?.categoryGroups.flatMap(g => g.adhkar.map(d => d.id)) ?? [];
}

describe('morning and evening on a fresh install', () => {
  it('serves the morning list', async () => {
    expect(await listIds('morning-adhkar')).toEqual(
      adhkarSeed.super_category_dhikr_ids['morning-adhkar'],
    );
  });

  it('serves the evening list with the evening wording', async () => {
    expect(await listIds('evening-adhkar')).toEqual(
      adhkarSeed.super_category_dhikr_ids['evening-adhkar'],
    );
    const evening77 = await adhkarService.getDhikr('evening-77');
    expect(evening77?.arabic.startsWith('((أَمْسَيْنَا')).toBe(true);
    expect(evening77?.audioFile).toBe('adhkar_evening_77.mp3');
  });

  it('plays each list its own recording of a shared dhikr', async () => {
    async function audioOf(
      superId: string,
      id: string,
    ): Promise<string | null> {
      const data = await adhkarService.getAdhkarForSuperCategory(superId);
      const found = data?.categoryGroups
        .flatMap(g => g.adhkar)
        .find(d => d.id === id);
      return found?.audioFile ?? null;
    }
    expect(await audioOf('evening-adhkar', '75')).toBe('adhkar_evening_75.mp3');
    expect(await audioOf('morning-adhkar', '75')).toBe('adhkar_75.mp3');
    expect(await audioOf('evening-adhkar', '96')).toBe('adhkar_96.mp3');
    expect((await adhkarService.getDhikr('75'))?.audioFile).toBe(
      'adhkar_75.mp3',
    );
  });

  it('leaves other super categories on category membership', async () => {
    const salah = await adhkarService.getSuperCategory('salah');
    expect(salah?.dhikrIds).toBeNull();
  });
});
