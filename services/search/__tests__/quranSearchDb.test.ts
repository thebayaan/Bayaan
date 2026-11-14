// @ai-generated
/**
 * The bundled Quran search index (assets/data/quran-search-v1.db): complete,
 * built from the current sources, and fresh. The test rebuilds the index in
 * memory from the Digital Khatt words and the i'rab morphology and compares
 * its content hash with the committed one, so a normaliser or source change
 * that was not rebuilt fails here. Rebuild with:
 *
 *   npx tsx scripts/search/build-quran-search-db.ts
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {
  readQuranSearchInput,
  REBUILD_COMMAND,
} from '../../../scripts/search/build-quran-search-db';
import {
  alphabetViolations,
  buildQuranSearchIndex,
  ROOT_COUNT_EXCEPTIONS,
  statedRootCount,
  type QuranSearchIndexContent,
} from '../../../scripts/search/quranSearchIndex';
import {decodePostings} from '@/utils/search/quranIndexFormat';
import {isFoldedForm} from '@/utils/search/quranText';
import {decodeMorph} from '@/services/irab/irabFormat';

jest.setTimeout(120_000);

const ROOT = path.join(__dirname, '../../..');
const DB = path.join(ROOT, 'assets/data/quran-search-v1.db');
const DK_DIR = path.join(ROOT, 'data/mushaf/digitalkhatt');

const db = new Database(DB, {readonly: true});
const meta: Record<string, string> = Object.fromEntries(
  (
    db.prepare('SELECT key, value FROM meta').all() as {
      key: string;
      value: string;
    }[]
  ).map(row => [row.key, row.value]),
);

let rebuilt: QuranSearchIndexContent;
beforeAll(() => {
  rebuilt = buildQuranSearchIndex(readQuranSearchInput());
});
afterAll(() => db.close());

const sha256 = (file: string) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe('quran-search-v1.db', () => {
  it('has the format 1 schema and a complete meta', () => {
    const tables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type IN ('table', 'index')",
        )
        .all() as {name: string}[]
    ).map(row => row.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'meta',
        'forms',
        'roots',
        'lemmas',
        'lemmas_by_root',
      ]),
    );
    for (const key of [
      'format',
      'normalizer',
      'dk_sha256',
      'irab_sha256',
      'content_sha256',
      'verses',
      'words',
      'forms',
      'postings',
      'roots',
      'lemmas',
    ]) {
      expect(meta[key]).toBeTruthy();
    }
    expect(meta.format).toBe('1');
    expect(meta.complete).toBe('1');
    expect(meta.imlaei_sha256).toBeUndefined();
  });

  it('records the sha256 of the sources it was built from', () => {
    expect(meta.dk_sha256).toBe(
      sha256(path.join(DK_DIR, 'digital-khatt-v2.db')),
    );
    expect(meta.irab_sha256).toBe(
      sha256(path.join(ROOT, 'assets/data/irab-v1.db')),
    );
  });

  it('is fresh: a rebuild from the sources gives the same content', () => {
    const stale = Object.entries(rebuilt.meta)
      .filter(([key, value]) => meta[key] !== value)
      .map(([key]) => key);
    if (stale.length) {
      throw new Error(
        `assets/data/quran-search-v1.db is stale (${stale.join(', ')}). ` +
          `Run: ${REBUILD_COMMAND}`,
      );
    }
    expect(stale).toEqual([]);
  });

  it('stores the rebuilt rows', () => {
    const forms = db.prepare('SELECT form, postings FROM forms').all() as {
      form: string;
      postings: string;
    }[];
    expect(forms).toHaveLength(rebuilt.forms.size);
    for (const {form, postings} of forms) {
      expect(isFoldedForm(form)).toBe(true);
      expect(decodePostings(postings)).toEqual(rebuilt.forms.get(form));
    }
    expect(
      db.prepare('SELECT id, root, words, ayahs FROM roots ORDER BY id').all(),
    ).toEqual(rebuilt.roots);
  });

  it('holds every root once, counted in words', () => {
    const roots = db.prepare('SELECT root, words FROM roots').all() as {
      root: string;
      words: number;
    }[];
    expect(roots).toHaveLength(1642);
    // Each root's words add up from its lemmas.
    const sums = db
      .prepare(
        'SELECT r.root AS root, r.words AS words, SUM(l.words) AS total FROM roots r JOIN lemmas l ON l.root_id = r.id GROUP BY r.id',
      )
      .all() as {root: string; words: number; total: number}[];
    for (const row of sums) expect(row.total).toBe(row.words);
  });

  it("matches the i'rab data's stated counts, except ء م م", () => {
    const irab = new Database(path.join(ROOT, 'assets/data/irab-v1.db'), {
      readonly: true,
    });
    const texts: string[] = [];
    for (const row of irab.prepare('SELECT id, text FROM texts').all() as {
      id: number;
      text: string;
    }[]) {
      texts[row.id] = row.text;
    }
    const stated = new Map<string, number>();
    for (const row of irab.prepare('SELECT morph FROM word_irab').all() as {
      morph: string;
    }[]) {
      const facts = new Map(
        decodeMorph(row.morph, texts).map(f => [f.label, f.value]),
      );
      const root = facts.get('الجذر');
      const occurrence = facts.get('وروده في القرآن');
      const count = occurrence ? statedRootCount(occurrence) : null;
      if (root && count !== null) stated.set(root, count);
    }
    irab.close();
    const words = new Map(
      (
        db.prepare('SELECT root, words FROM roots').all() as {
          root: string;
          words: number;
        }[]
      ).map(row => [row.root, row.words]),
    );
    expect(stated.size).toBe(words.size);
    const differ = [...words].filter(([root, n]) => stated.get(root) !== n);
    expect(differ.map(([root]) => root)).toEqual(
      Object.keys(ROOT_COUNT_EXCEPTIONS),
    );
    expect(stated.get('ء م م')).toBe(119);
    expect(words.get('ء م م')).toBe(118);
  });

  it('decodes every lemma posting list to its word count', () => {
    for (const row of db
      .prepare('SELECT words, postings FROM lemmas')
      .all() as {words: number; postings: string}[]) {
      expect(decodePostings(row.postings)).toHaveLength(row.words);
    }
  });

  it("folds every word of the other rewayat's texts into the alphabet", () => {
    for (const file of [
      'dk_words_shouba.db',
      'dk_words_warsh.db',
      'dk_words_qaloon.db',
      'dk_words_bazzi.db',
      'dk_words_qumbul.db',
      'dk_words_doori.db',
      'dk_words_soosi.db',
    ]) {
      const words = new Database(path.join(DK_DIR, file), {readonly: true});
      const texts = (
        words.prepare('SELECT text FROM words').all() as {text: string | null}[]
      ).flatMap(row => (row.text ?? '').split(' '));
      words.close();
      expect({file, bad: alphabetViolations(texts)}).toEqual({file, bad: []});
    }
  });
});
