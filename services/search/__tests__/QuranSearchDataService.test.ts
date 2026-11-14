// @ai-generated
/**
 * QuranSearchDataService on the bundled index (a temp copy, through the
 * better-sqlite3 adapter that gives it expo-sqlite's async API).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createQuranSearchDataService,
  type QuranSearchDb,
} from '../QuranSearchDataService';
import {openAdapterDatabase} from '@/test-utils/sqliteAdapter';

jest.mock('expo-sqlite', () => ({}));

const ASSET = path.join(__dirname, '../../../assets/data/quran-search-v1.db');
let dir: string;
let copy: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quran-search-'));
  copy = path.join(dir, 'quran-search-v1.db');
  fs.copyFileSync(ASSET, copy);
});
afterAll(() => {
  fs.rmSync(dir, {recursive: true, force: true});
});

function serviceOnCopy() {
  const opened: QuranSearchDb[] = [];
  const service = createQuranSearchDataService(async () => {
    const db = openAdapterDatabase(copy) as unknown as QuranSearchDb;
    opened.push(db);
    return db;
  });
  return {service, opened};
}

describe('QuranSearchDataService', () => {
  it('finds a phrase with the first ayah first', async () => {
    const {service} = serviceOnCopy();
    const outcome = await service.search('الحمد لله');
    if (outcome.kind !== 'text') throw new Error(outcome.kind);
    expect(outcome.result.kind).toBe('phrase');
    expect(outcome.result.hits[0].verseKey).toBe('1:2');
    expect(outcome.result.ayahCount).toBe(23);
    expect(outcome.result.hits[0].matches).toEqual([{position: 1, length: 2}]);
  });

  it('searches a root with its lemmas', async () => {
    const {service} = serviceOnCopy();
    const outcome = await service.search('root:رحم');
    if (outcome.kind !== 'root') throw new Error(outcome.kind);
    expect(outcome.candidates.map(r => r.root)).toEqual(['ر ح م']);
    const result = outcome.result;
    if (!result) throw new Error('no result');
    expect(result.root).toMatchObject({root: 'ر ح م', words: 339, ayahs: 313});
    expect(result.lemmas).toHaveLength(9);
    expect(result.lemmas[0]).toMatchObject({words: 116});
    const all = result.hits(null);
    expect(all).toHaveLength(313);
    expect(all.reduce((n, hit) => n + hit.matches.length, 0)).toBe(339);
    // Mushaf order: 1:1 (bismillah: الرحمن, الرحيم) first.
    expect(all[0]).toMatchObject({verseKey: '1:1'});
    expect(all[0].matches).toEqual([
      {position: 3, length: 1},
      {position: 4, length: 1},
    ]);
    // One lemma; memoised.
    const top = result.hits(result.lemmas[0].id);
    expect(top.reduce((n, hit) => n + hit.matches.length, 0)).toBe(116);
    expect(result.hits(result.lemmas[0].id)).toBe(top);
  });

  it('accepts spaced root letters and the Arabic keyword', async () => {
    const {service} = serviceOnCopy();
    for (const query of ['ر ح م', 'جذر: رحم']) {
      const outcome = await service.search(query);
      expect(outcome.kind === 'root' && outcome.result?.root.root).toBe(
        'ر ح م',
      );
    }
    const unknown = await service.search('root:ظظظ');
    expect(unknown).toEqual({
      kind: 'root',
      letters: 'ظظظ',
      candidates: [],
      result: null,
    });
  });

  it('suggests the root of a 3-letter word', async () => {
    const {service} = serviceOnCopy();
    const outcome = await service.search('رحم');
    if (outcome.kind !== 'text') throw new Error(outcome.kind);
    expect(outcome.rootSuggestions.map(r => r.root)).toEqual(['ر ح م']);
    expect(outcome.result.ayahCount).toBeGreaterThan(0);
    const none = await service.search('الرحمن');
    expect(none.kind === 'text' && none.rootSuggestions).toEqual([]);
  });

  it('leaves other queries to the catalogue', async () => {
    const {service} = serviceOnCopy();
    expect(await service.search('2:255')).toEqual({kind: 'none'});
    expect(await service.search('husary')).toEqual({kind: 'none'});
    expect(await service.search('')).toEqual({kind: 'none'});
  });

  it('finds a root by its i’rab spelling after initialize', async () => {
    const {service} = serviceOnCopy();
    await service.initialize();
    expect(service.findRoot('ك ت ب')).toMatchObject({words: 319});
    expect(service.findRoot('xyz')).toBeNull();
  });

  it('reads each postings list once (LRU)', async () => {
    const {service, opened} = serviceOnCopy();
    await service.initialize();
    const spy = jest.spyOn(opened[0], 'getAllAsync');
    await service.exact(['الله', 'غيرموجود']);
    expect(spy).toHaveBeenCalledTimes(1);
    const again = await service.exact(['الله', 'غيرموجود']);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(again.get('الله')?.length).toBeGreaterThan(2000);
    expect(again.has('غيرموجود')).toBe(false);
    await service.prefix('الصلا', 4000);
    await service.prefix('الصلا', 4000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('re-imports a copy whose meta lacks complete', async () => {
    const real = openAdapterDatabase(copy) as unknown as QuranSearchDb;
    const incomplete: QuranSearchDb = {
      getAllAsync: async <T>(sql: string, ...params: (string | number)[]) =>
        sql.includes('FROM meta')
          ? ([{key: 'format', value: '1'}] as T[])
          : real.getAllAsync<T>(sql, ...params),
      getFirstAsync: real.getFirstAsync.bind(real),
      closeAsync: jest.fn(async () => undefined),
    };
    const open = jest.fn(async (reimport: boolean) =>
      reimport ? real : incomplete,
    );
    const service = createQuranSearchDataService(open);
    await service.initialize();
    expect(open.mock.calls).toEqual([[false], [true]]);
    expect(incomplete.closeAsync).toHaveBeenCalled();
    expect(service.findRoot('ر ح م')).not.toBeNull();
  });

  it('fails, and retries later, when no complete copy can be opened', async () => {
    const broken: QuranSearchDb = {
      getAllAsync: async () => {
        throw new Error('no such table: meta');
      },
      getFirstAsync: async () => null,
    };
    const open = jest.fn(async () => broken);
    const service = createQuranSearchDataService(open);
    await expect(service.search('الله')).rejects.toThrow(/incomplete/);
    await expect(service.initialize()).rejects.toThrow(/incomplete/);
    expect(open).toHaveBeenCalledTimes(4);
  });
});
