// @ai-generated
/**
 * The bundled Quran search index (assets/data/quran-search-v1.db): opened on
 * first use, never at app start. It serves the postings the search engine
 * (utils/search/quranSearch.ts) asks for, root searches, and whole queries.
 *
 * The file name carries the index version: a rebuilt index ships as a new
 * file, so an installed app never keeps a stale import. A copy whose meta
 * lacks complete='1' (an import cut short) is deleted and imported again.
 */
import * as SQLite from 'expo-sqlite';
import {
  decodePostings,
  QURAN_SEARCH_DB_NAME,
  QURAN_SEARCH_FORMAT,
  QURAN_SLOT_STRIDE,
  slotOfCode,
  verseKeyAt,
  type QuranLemma,
  type QuranRoot,
} from '@/utils/search/quranIndexFormat';
import {
  searchQuranText,
  type QuranPostingSource,
  type QuranTextResult,
  type QuranVerseHit,
} from '@/utils/search/quranSearch';
import {parseQuranQuery, rootCandidates} from '@/utils/search/quranText';

export type {QuranLemma, QuranRoot} from '@/utils/search/quranIndexFormat';

export interface RootSearchResult {
  root: QuranRoot;
  /** Most words first; lemma null holds the words without one. */
  lemmas: readonly QuranLemma[];
  /** The ayahs with words of the root (null) or of one lemma, mushaf order. */
  hits(lemmaId: number | null): readonly QuranVerseHit[];
}

export type QuranSearchOutcome =
  | {kind: 'none'}
  | {
      kind: 'text';
      result: QuranTextResult;
      /** Known roots a one-word query of 3-4 letters may spell. */
      rootSuggestions: readonly QuranRoot[];
    }
  | {
      kind: 'root';
      letters: string;
      /** Every known root the letters may spell, most words first. */
      candidates: readonly QuranRoot[];
      /** The first candidate's words, or null when none is known. */
      result: RootSearchResult | null;
    };

/** The part of expo-sqlite's database the service uses. */
export interface QuranSearchDb {
  getAllAsync<T>(sql: string, ...params: (string | number)[]): Promise<T[]>;
  getFirstAsync<T>(
    sql: string,
    ...params: (string | number)[]
  ): Promise<T | null>;
  closeAsync?(): Promise<void>;
}

export interface QuranSearchDataService extends QuranPostingSource {
  /** Opens the index and loads the roots (once). */
  initialize(): Promise<void>;
  /** A root by its i'rab spelling ('ر ح م'), after initialize. */
  findRoot(root: string): QuranRoot | null;
  rootSearch(rootId: number): Promise<RootSearchResult>;
  search(query: string): Promise<QuranSearchOutcome>;
}

/** Decoded postings lists kept in memory. */
export const QURAN_POSTINGS_CACHE_SIZE = 64;
const ROOT_CACHE_SIZE = 8;

class LruCache<V> {
  private readonly map = new Map<string, V>();

  constructor(private readonly size: number) {}

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.size) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }
}

const NO_CODES: readonly number[] = [];

/** One verse hit per ayah, each word a match of length 1, mushaf order. */
function hitsOfCodes(codes: readonly number[]): QuranVerseHit[] {
  const byVerse = new Map<number, number[]>();
  for (const code of codes) {
    const slot = slotOfCode(code);
    const verseIndex = Math.floor(slot / QURAN_SLOT_STRIDE);
    const positions = byVerse.get(verseIndex) ?? [];
    positions.push(slot % QURAN_SLOT_STRIDE);
    byVerse.set(verseIndex, positions);
  }
  return [...byVerse]
    .sort(([a], [b]) => a - b)
    .map(([verseIndex, positions]) => {
      const sorted = [...new Set(positions)].sort((a, b) => a - b);
      return {
        verseIndex,
        verseKey: verseKeyAt(verseIndex),
        matches: sorted.map(position => ({position, length: 1})),
        score: sorted.length,
      };
    });
}

async function isComplete(db: QuranSearchDb): Promise<boolean> {
  try {
    const rows = await db.getAllAsync<{key: string; value: string}>(
      "SELECT key, value FROM meta WHERE key IN ('complete', 'format')",
    );
    const meta = new Map(rows.map(row => [row.key, row.value]));
    return (
      meta.get('complete') === '1' &&
      meta.get('format') === String(QURAN_SEARCH_FORMAT)
    );
  } catch {
    return false;
  }
}

/**
 * A search service over `open`: open(false) gives the current copy,
 * open(true) a fresh import of the bundled asset (after the old copy was
 * closed). Tests pass a better-sqlite3 adapter.
 */
export function createQuranSearchDataService(
  open: (reimport: boolean) => Promise<QuranSearchDb>,
): QuranSearchDataService {
  let db: QuranSearchDb | null = null;
  let initializing: Promise<void> | null = null;
  const rootsById = new Map<number, QuranRoot>();
  const rootsByName = new Map<string, QuranRoot>();
  const postings = new LruCache<ReadonlyMap<string, readonly number[]>>(
    QURAN_POSTINGS_CACHE_SIZE,
  );
  const rootResults = new LruCache<RootSearchResult>(ROOT_CACHE_SIZE);

  async function load(): Promise<void> {
    let handle = await open(false);
    if (!(await isComplete(handle))) {
      await handle.closeAsync?.();
      handle = await open(true);
      if (!(await isComplete(handle))) {
        throw new Error(`${QURAN_SEARCH_DB_NAME} is incomplete`);
      }
    }
    const roots = await handle.getAllAsync<QuranRoot>(
      'SELECT id, root, words, ayahs FROM roots ORDER BY id',
    );
    rootsById.clear();
    rootsByName.clear();
    for (const root of roots) {
      rootsById.set(root.id, root);
      rootsByName.set(root.root, root);
    }
    db = handle;
  }

  function initialize(): Promise<void> {
    if (db) return Promise.resolve();
    if (!initializing) {
      initializing = load().catch(error => {
        initializing = null;
        throw error;
      });
    }
    return initializing;
  }

  async function ready(): Promise<QuranSearchDb> {
    await initialize();
    return db as QuranSearchDb;
  }

  const isKnownRoot = (root: string) => rootsByName.has(root);

  const service: QuranSearchDataService = {
    initialize,

    findRoot(root) {
      return rootsByName.get(root) ?? null;
    },

    async exact(forms) {
      const out = new Map<string, readonly number[]>();
      const missing: string[] = [];
      for (const form of new Set(forms)) {
        const cached = postings.get(`exact|${form}`);
        if (cached === undefined) missing.push(form);
        else {
          const codes = cached.get(form);
          if (codes) out.set(form, codes);
        }
      }
      if (missing.length) {
        const handle = await ready();
        const rows = await handle.getAllAsync<{form: string; postings: string}>(
          `SELECT form, postings FROM forms WHERE form IN (${missing
            .map(() => '?')
            .join(', ')})`,
          ...missing,
        );
        const found = new Map(rows.map(row => [row.form, row.postings]));
        for (const form of missing) {
          const text = found.get(form);
          const codes = text === undefined ? NO_CODES : decodePostings(text);
          // Misses are cached too: a form that is not in the index stays out.
          postings.set(
            `exact|${form}`,
            new Map(codes.length ? [[form, codes]] : []),
          );
          if (codes.length) out.set(form, codes);
        }
      }
      return out;
    },

    async prefix(prefix, limit) {
      const key = `prefix|${limit}|${prefix}`;
      const cached = postings.get(key);
      if (cached) return cached;
      const handle = await ready();
      // BINARY order of UTF-8 equals code-unit order for Arabic, so every
      // form that starts with `prefix` sorts between it and prefix + U+FFFF.
      const rows = await handle.getAllAsync<{form: string; postings: string}>(
        'SELECT form, postings FROM forms WHERE form > ? AND form < ? ORDER BY form LIMIT ?',
        prefix,
        `${prefix}\u{FFFF}`,
        limit,
      );
      const out = new Map(
        rows.map(row => [row.form, decodePostings(row.postings)]),
      );
      postings.set(key, out);
      return out;
    },

    async rootSearch(rootId) {
      const cached = rootResults.get(String(rootId));
      if (cached) return cached;
      const handle = await ready();
      const root = rootsById.get(rootId);
      if (!root) throw new Error(`unknown root id ${rootId}`);
      const rows = await handle.getAllAsync<{
        id: number;
        lemma: string | null;
        words: number;
        ayahs: number;
        postings: string;
      }>(
        'SELECT id, lemma, words, ayahs, postings FROM lemmas WHERE root_id = ? ORDER BY words DESC, id',
        rootId,
      );
      const lemmas: QuranLemma[] = rows.map(row => ({
        id: row.id,
        rootId,
        lemma: row.lemma,
        words: row.words,
        ayahs: row.ayahs,
      }));
      const codesByLemma = new Map(
        rows.map(row => [row.id, decodePostings(row.postings)]),
      );
      const hitsByLemma = new Map<number | null, QuranVerseHit[]>();
      const result: RootSearchResult = {
        root,
        lemmas,
        hits(lemmaId) {
          let hits = hitsByLemma.get(lemmaId);
          if (!hits) {
            let codes: readonly number[];
            if (lemmaId === null) codes = [...codesByLemma.values()].flat();
            else codes = codesByLemma.get(lemmaId) ?? [];
            hits = hitsOfCodes(codes);
            hitsByLemma.set(lemmaId, hits);
          }
          return hits;
        },
      };
      rootResults.set(String(rootId), result);
      return result;
    },

    async search(query) {
      await initialize();
      const parsed = parseQuranQuery(query, isKnownRoot);
      const rootsOf = (letters: string) =>
        rootCandidates(letters, isKnownRoot)
          .map(name => rootsByName.get(name) as QuranRoot)
          .sort((a, b) => b.words - a.words || a.id - b.id);
      if (parsed.kind === 'none') return {kind: 'none'};
      if (parsed.kind === 'root') {
        const candidates = rootsOf(parsed.letters);
        return {
          kind: 'root',
          letters: parsed.letters,
          candidates,
          result: candidates.length
            ? await service.rootSearch(candidates[0].id)
            : null,
        };
      }
      const result = await searchQuranText(parsed.tokens, service);
      return {
        kind: 'text',
        result,
        rootSuggestions: parsed.rootLetters ? rootsOf(parsed.rootLetters) : [],
      };
    },
  };
  return service;
}

/** The app's instance: expo-sqlite, importing the bundled asset once. */
export const quranSearchDataService = createQuranSearchDataService(
  async reimport => {
    if (reimport) {
      await SQLite.deleteDatabaseAsync(QURAN_SEARCH_DB_NAME).catch(
        () => undefined,
      );
    }
    await SQLite.importDatabaseFromAssetAsync(QURAN_SEARCH_DB_NAME, {
      assetId: require('../../assets/data/quran-search-v1.db'),
    });
    return SQLite.openDatabaseAsync(QURAN_SEARCH_DB_NAME);
  },
);
