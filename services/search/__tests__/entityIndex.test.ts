import {createEntityIndex} from '../entityIndex';

interface TestRow {
  id: string;
  name: string;
  arabic_name: string;
  aliases?: string[];
}

const fields: Array<{key: keyof TestRow | 'aliases'; weight: number}> = [
  {key: 'name', weight: 2},
  {key: 'arabic_name', weight: 2},
  {key: 'aliases', weight: 1.5},
];

const rows: TestRow[] = [
  {id: 'r1', name: 'Mishary Alafasy', arabic_name: 'مشاري العفاسي'},
  {id: 'r2', name: 'Yasser Ad-Dossari', arabic_name: 'ياسر الدوسري'},
  {id: 's36', name: 'Ya-Sin', arabic_name: 'يس', aliases: ['yaseen', 'yāsīn']},
];

describe('entityIndex build + match', () => {
  const idx = createEntityIndex({
    rows,
    idOf: r => r.id,
    fields,
    valueOf: (r, k) =>
      k === 'aliases'
        ? (r.aliases ?? [])
        : (r[k as keyof TestRow] as string | undefined),
  });

  it('returns exact tier for exact match', () => {
    const hits = idx.search('Ya-Sin');
    const top = hits.find(h => h.id === 's36');
    expect(top?.tier).toBe('exact');
    expect(top?.textualScore).toBeCloseTo(1.0);
  });

  it('returns prefix tier for prefix match', () => {
    const hits = idx.search('Mish');
    const top = hits.find(h => h.id === 'r1');
    expect(top?.tier).toBe('prefix');
    expect(top?.textualScore).toBeGreaterThan(0.84);
    expect(top?.textualScore).toBeLessThan(0.91);
  });

  it('matches Arabic-normalized', () => {
    const hits = idx.search('ياسر');
    expect(hits.find(h => h.id === 'r2')).toBeDefined();
  });

  it('matches via aliases field', () => {
    const hits = idx.search('Yāsīn');
    expect(hits.find(h => h.id === 's36')).toBeDefined();
  });

  it('filters below the floor', () => {
    const hits = idx.search('xyzqq');
    expect(hits).toHaveLength(0);
  });
});
