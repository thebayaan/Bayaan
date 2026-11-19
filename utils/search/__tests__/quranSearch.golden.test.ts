// @ai-generated
/**
 * The golden Quran search queries (utils/search/__fixtures__/
 * quranSearchGolden.ts, also a build gate) on the bundled index, through
 * QuranSearchDataService, plus the whole-Quran check: every verse is found
 * by pasting its first 12 (or fewer) Digital Khatt words.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import {
  createQuranSearchDataService,
  isQuranQuery,
  mayBeRootQuery,
  type QuranSearchDb,
} from '@/services/search/QuranSearchDataService';
import {openAdapterDatabase} from '@/test-utils/sqliteAdapter';
import {memoryPostingSource} from '@/scripts/search/quranSearchIndex';
import {
  QURAN_KIND_FIXTURES,
  QURAN_ROOT_FIXTURES,
  QURAN_ROOT_QUERY_FIXTURES,
  QURAN_TEXT_FIXTURES,
  textFixtureFailure,
} from '../__fixtures__/quranSearchGolden';
import {decodePostings, QURAN_SEARCH_DB_NAME} from '../quranIndexFormat';
import {searchQuranText} from '../quranSearch';
import {
  isVerseMarker,
  parseQuranQuery,
  quranWordSpellings,
  rootQuery,
} from '../quranText';

jest.mock('expo-sqlite', () => ({}));
jest.setTimeout(60_000);

const ROOT = path.join(__dirname, '../../..');
let dir: string;
let service: ReturnType<typeof createQuranSearchDataService>;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quran-golden-'));
  const copy = path.join(dir, QURAN_SEARCH_DB_NAME);
  fs.copyFileSync(path.join(ROOT, 'assets/data', QURAN_SEARCH_DB_NAME), copy);
  service = createQuranSearchDataService(
    async () => openAdapterDatabase(copy) as unknown as QuranSearchDb,
  );
  await service.initialize();
});
afterAll(() => fs.rmSync(dir, {recursive: true, force: true}));

describe('golden Quran queries', () => {
  it.each(QURAN_TEXT_FIXTURES.map(f => [f.query, f] as const))(
    '%s',
    async (_query, fixture) => {
      const outcome = await service.search(fixture.query);
      if (outcome.kind !== 'text') throw new Error(`parsed as ${outcome.kind}`);
      expect(textFixtureFailure(fixture, outcome.result)).toBeNull();
    },
  );

  it.each(QURAN_ROOT_FIXTURES.map(f => [f.root, f] as const))(
    'root %s',
    async (_root, fixture) => {
      const outcome = await service.search(rootQuery(fixture.root));
      if (outcome.kind !== 'root' || !outcome.result) {
        throw new Error('no root result');
      }
      const {root, lemmas} = outcome.result;
      expect(root.words).toBe(fixture.words);
      if (fixture.ayahs !== undefined) expect(root.ayahs).toBe(fixture.ayahs);
      if (fixture.lemmas !== undefined)
        expect(lemmas).toHaveLength(fixture.lemmas);
      if (fixture.topLemma) {
        expect(quranWordSpellings(lemmas[0].lemma ?? '').rasm).toBe(
          fixture.topLemma.letters,
        );
        expect(lemmas[0].words).toBe(fixture.topLemma.words);
      }
      expect(outcome.result.hits(null)).toHaveLength(root.ayahs);
    },
  );

  it.each(QURAN_ROOT_QUERY_FIXTURES.map(f => [f.letters, f.roots] as const))(
    '%s suggests %j',
    async (letters, roots) => {
      const outcome = await service.search(letters);
      if (outcome.kind !== 'text') throw new Error(outcome.kind);
      expect(outcome.rootSuggestions.map(r => r.root)).toEqual(roots);
    },
  );
});

describe('what a query is (the surfaces read it from the outcome)', () => {
  it.each(QURAN_KIND_FIXTURES.map(f => [f.query, f] as const))(
    '%s',
    async (_query, fixture) => {
      const outcome = await service.search(fixture.query);
      expect(outcome.kind).toBe(fixture.kind);
      const roots =
        outcome.kind === 'root'
          ? outcome.candidates
          : outcome.kind === 'text'
            ? outcome.rootSuggestions
            : [];
      expect(roots.map(r => r.root)).toEqual(fixture.roots);
      if (outcome.kind === 'root') {
        expect(outcome.result?.root.root).toBe(fixture.roots[0]);
      }
    },
  );

  it('never disagrees with isQuranQuery, which needs no index', async () => {
    const queries = [
      ...QURAN_KIND_FIXTURES.map(f => f.query),
      ...QURAN_TEXT_FIXTURES.map(f => f.query),
      ...QURAN_ROOT_QUERY_FIXTURES.map(f => f.letters),
      'صفحة 5',
      'juz 30',
      'root:',
      '',
    ];
    for (const query of queries) {
      const outcome = await service.search(query);
      expect({query, quran: isQuranQuery(query)}).toEqual({
        query,
        quran: outcome.kind !== 'none',
      });
    }
  });

  it('says a query may be a root whenever search() answers one', async () => {
    // Without the index: the surfaces show their own rows at once for a
    // query that is never a root, so it must never miss one.
    const letters = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
    const spaced = [...letters].flatMap((a, i) =>
      [...letters.slice(i, i + 4)].map(b => `${a} ${b} م`),
    );
    const queries = [
      ...QURAN_KIND_FIXTURES.map(f => f.query),
      ...QURAN_TEXT_FIXTURES.map(f => f.query),
      ...QURAN_ROOT_QUERY_FIXTURES.map(f => f.letters),
      ...spaced,
      'أ ل م',
      'ك ت ب ه',
      'جذر:',
    ];
    const roots: string[] = [];
    for (const query of queries) {
      const outcome = await service.search(query);
      if (outcome.kind !== 'root') continue;
      roots.push(query);
      expect({query, mayBeRoot: mayBeRootQuery(query)}).toEqual({
        query,
        mayBeRoot: true,
      });
    }
    // The sample holds roots of each sort: explicit, spaced, with a hamza.
    expect(roots).toEqual(
      expect.arrayContaining(['ر ح م', 'root:رحم', 'جذر: ر ح م', 'أ ل م']),
    );
    // One word, an opening (or two), or 5 letters typed apart never wait.
    for (const query of [
      'رحم',
      'البقرة',
      'ا ل م',
      'ح م',
      'ح م ع س ق',
      'ل ك ن ه م',
    ]) {
      expect({query, mayBeRoot: mayBeRootQuery(query)}).toEqual({
        query,
        mayBeRoot: false,
      });
    }
  });
});

describe('whole Quran', () => {
  it('finds every verse from its first 12 words', async () => {
    const dk = new Database(
      path.join(ROOT, 'data/mushaf/digitalkhatt/digital-khatt-v2.db'),
      {readonly: true},
    );
    const rows = dk
      .prepare('SELECT location, text FROM words ORDER BY id')
      .all() as {location: string; text: string}[];
    dk.close();
    const verses = new Map<string, string[]>();
    for (const row of rows) {
      if (isVerseMarker(row.text)) continue;
      const key = row.location.split(':').slice(0, 2).join(':');
      const words = verses.get(key) ?? [];
      if (words.length < 12) words.push(row.text);
      verses.set(key, words);
    }
    expect(verses.size).toBe(6236);
    // Every postings list of the bundled DB, read once: 6,236 queries with
    // little in common would only churn the service's LRU (the fixtures
    // above go through its SQL path).
    const index = new Database(path.join(dir, QURAN_SEARCH_DB_NAME), {
      readonly: true,
    });
    const formRows = index
      .prepare('SELECT form, postings, whole FROM forms')
      .all() as {form: string; postings: string; whole: number}[];
    index.close();
    const forms = new Map(
      formRows.map(row => [row.form, decodePostings(row.postings)]),
    );
    const whole = new Set(
      formRows.filter(row => row.whole).map(row => row.form),
    );
    const source = memoryPostingSource(forms, whole);
    const missed: string[] = [];
    for (const [key, words] of verses) {
      const parsed = parseQuranQuery(words.join(' '));
      const found =
        parsed.kind === 'text'
          ? await searchQuranText(parsed.tokens, source)
          : null;
      if (!found?.hits.some(hit => hit.verseKey === key)) missed.push(key);
    }
    expect(missed).toEqual([]);
  });
});
