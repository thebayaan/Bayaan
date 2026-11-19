// @ai-generated
/**
 * The bundled Quran search index (assets/data/quran-search-v1.db): complete,
 * built from the current sources, and fresh. The test rebuilds the index in
 * memory from the Digital Khatt words and the i'rab morphology and compares
 * its meta (content and source hashes) with the committed one, so a
 * normaliser or source change that was not rebuilt fails here. Of the i'rab
 * DB only the morphology the index reads counts: its prose, books and text
 * ids may change without a rebuild. Of the Digital Khatt DB only the rows it
 * reads count: the file may be rewritten with the same rows. Rebuild with:
 *
 *   npx tsx scripts/search/build-quran-search-db.ts
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {
  IRAB_DB,
  readQuranSearchInput,
  REBUILD_COMMAND,
} from '../../../scripts/search/build-quran-search-db';
import {
  alphabetViolations,
  buildQuranSearchIndex,
  dkWordsSha256,
  irabMorphologySha256,
  memoryPostingSource,
  ROOT_COUNT_EXCEPTIONS,
  statedRootCount,
  type QuranSearchIndexContent,
  type QuranSearchIndexInput,
} from '../../../scripts/search/quranSearchIndex';
import {IRAB_DB_NAME} from '@/constants/bundledDatabases';
import {
  decodePostings,
  flagsOfCode,
  hasFlag,
  QURAN_FLAG,
  QURAN_FLAG_RANGE,
  QURAN_SEARCH_DB_NAME,
  QURAN_SEARCH_FORMAT,
  QURAN_SLOT_STRIDE,
  verseKeyAt,
} from '@/utils/search/quranIndexFormat';
import {QURAN_ONE_WORD_AYAHS} from '@/utils/search/quranSearch';
import {isFoldedForm, isVerseMarker} from '@/utils/search/quranText';
import {decodeMorph, MORPH_LEMMA_LABEL} from '@/services/irab/irabFormat';

jest.setTimeout(120_000);

const ROOT = path.join(__dirname, '../../..');
const DB = path.join(ROOT, 'assets/data', QURAN_SEARCH_DB_NAME);
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

let input: QuranSearchIndexInput;
let rebuilt: QuranSearchIndexContent;
beforeAll(() => {
  input = readQuranSearchInput();
  rebuilt = buildQuranSearchIndex(input);
});
afterAll(() => db.close());

describe(QURAN_SEARCH_DB_NAME, () => {
  it('has the schema of its format and a complete meta', () => {
    const columns = (
      db.prepare('PRAGMA table_info(forms)').all() as {name: string}[]
    ).map(row => row.name);
    expect(columns).toEqual(['form', 'postings', 'whole']);
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
      'dk_words_sha256',
      'irab_morph_sha256',
      'content_sha256',
      'verses',
      'words',
      'forms',
      'postings',
      'roots',
      'lemmas',
      'morphology_source',
      'morphology_license',
      'morphology_notice',
      'treebank_notice',
    ]) {
      expect(meta[key]).toBeTruthy();
    }
    expect(meta.format).toBe(String(QURAN_SEARCH_FORMAT));
    expect(meta.format).toBe('2');
    expect(meta.complete).toBe('1');
    expect(meta.imlaei_sha256).toBeUndefined();
  });

  it('names where its roots and lemmas come from, with the corpus notice', () => {
    expect(meta.morphology_source).toContain('Quranic Arabic Corpus');
    expect(meta.morphology_source).toContain('Quranic Treebank');
    expect(meta.morphology_license).toContain('GNU General Public License');
    expect(meta.morphology_license).toContain('MIT License');
    // The corpus asks for its notice in works derived from it, and the
    // treebank's MIT licence for its own: both verbatim, from the same files
    // the i'rab database stores.
    expect(meta.morphology_notice).toContain('TERMS OF USE:');
    expect(meta.morphology_notice).toContain('http://corpus.quran.com');
    const licence = (file: string) =>
      fs.readFileSync(path.join(__dirname, '../../../licenses', file), 'utf8');
    expect(meta.morphology_notice).toBe(
      licence('quranic-arabic-corpus-notice.txt'),
    );
    expect(meta.treebank_notice).toBe(licence('NoorBayan-Quranic-MIT.txt'));
  });

  it('records the sha256 of what it was built from', () => {
    // Of the Digital Khatt DB, the rows it reads; never the whole file.
    expect(meta.dk_words_sha256).toBe(dkWordsSha256(input.dkWords));
    expect(meta.dk_sha256).toBeUndefined();
    // Of the i'rab DB, the morphology it reads; never the whole file.
    expect(IRAB_DB).toBe(path.join(ROOT, 'assets/data', IRAB_DB_NAME));
    expect(meta.irab_morph_sha256).toBe(irabMorphologySha256(input));
    expect(meta.irab_sha256).toBeUndefined();
  });

  it('is fresh: a rebuild from the sources gives the same content', () => {
    const stale = Object.entries(rebuilt.meta)
      .filter(([key, value]) => meta[key] !== value)
      .map(([key]) => key);
    // Keys an older build wrote and this one does not.
    for (const key of Object.keys(meta)) {
      if (key !== 'complete' && !(key in rebuilt.meta)) stale.push(key);
    }
    if (stale.length) {
      throw new Error(
        `assets/data/${QURAN_SEARCH_DB_NAME} is stale (${stale.join(', ')}). ` +
          `Run: ${REBUILD_COMMAND}`,
      );
    }
    expect(stale).toEqual([]);
  });

  it('follows the Digital Khatt words it reads, not the file', () => {
    const base = dkWordsSha256(input.dkWords);

    // A file rewritten with the same rows (another table layout, the ids
    // renumbered in the same order) reads back the same: the index stays
    // fresh, as it should have when words.id became the primary key.
    const copy = new Database(':memory:');
    try {
      copy.exec('CREATE TABLE words (id INTEGER, location TEXT, text TEXT)');
      const insert = copy.prepare('INSERT INTO words VALUES (?, ?, ?)');
      const rows = input.dkWords;
      copy.transaction(() => {
        for (let i = rows.length - 1; i >= 0; i--) {
          insert.run(10 * (i + 1), rows[i].location, rows[i].text);
        }
      })();
      const reread = copy
        .prepare('SELECT location, text FROM words ORDER BY id')
        .all() as {location: string; text: string}[];
      expect(dkWordsSha256(reread)).toBe(base);
    } finally {
      copy.close();
    }

    // A word the index reads: the hash changes.
    const at = input.dkWords.findIndex(row => !isVerseMarker(row.text));
    const edited = input.dkWords.map((row, i) =>
      i === at ? {...row, text: `${row.text}ا`} : row,
    );
    expect(dkWordsSha256(edited)).not.toBe(base);
  });

  it("follows the morphology it reads, not the rest of the i'rab DB", () => {
    const base = irabMorphologySha256(input);
    const texts = input.irabTexts;
    const rows = input.irabRows;

    // The same data with every text id renumbered (a rebuilt i'rab DB).
    const last = texts.length - 1;
    const renumber = (id: number) => last - id;
    const renumbered: string[] = [];
    texts.forEach((text, id) => {
      renumbered[renumber(id)] = text;
    });
    const remapped = rows.map(row => ({
      ...row,
      entries: JSON.stringify(
        (JSON.parse(row.entries) as unknown[][]).map(
          ([kind, label, text, ...span]) => [
            kind,
            renumber(label as number),
            renumber(text as number),
            ...span,
          ],
        ),
      ),
      morph: JSON.stringify(
        (JSON.parse(row.morph) as number[][]).map(([label, value]) => [
          renumber(label),
          renumber(value),
        ]),
      ),
    }));
    expect(
      irabMorphologySha256({irabRows: remapped, irabTexts: renumbered}),
    ).toBe(base);

    // The i'rab prose of a stem (footnotes stripped, a wording fixed).
    const facts = new Set<number>();
    for (const row of rows) {
      for (const entry of JSON.parse(row.entries) as number[][]) {
        facts.add(entry[1]);
      }
      for (const [label, value] of JSON.parse(row.morph) as number[][]) {
        facts.add(label);
        facts.add(value);
      }
    }
    const prose = rows
      .flatMap(row => JSON.parse(row.entries) as [string, number, number][])
      .find(([kind, , text]) => kind === 's' && !facts.has(text));
    if (!prose) throw new Error('no stem text to change');
    const edited = [...texts];
    edited[prose[2]] = `${texts[prose[2]]} (حاشية)`;
    expect(irabMorphologySha256({irabRows: rows, irabTexts: edited})).toBe(
      base,
    );

    // A lemma the index reads: the hash changes.
    const at = rows.findIndex(row =>
      decodeMorph(row.morph, texts).some(f => f.label === MORPH_LEMMA_LABEL),
    );
    const other = [...texts, 'لَفْظ'];
    const lemmaId = texts.indexOf(MORPH_LEMMA_LABEL);
    const changed = rows.map((row, i) =>
      i === at
        ? {
            ...row,
            morph: JSON.stringify(
              (JSON.parse(row.morph) as number[][]).map(([label, value]) =>
                label === lemmaId ? [label, other.length - 1] : [label, value],
              ),
            ),
          }
        : row,
    );
    expect(
      irabMorphologySha256({irabRows: changed, irabTexts: other}),
    ).not.toBe(base);
  });

  it('knows every ayah of one word, which a phrase runs on from', () => {
    const words = new Map<string, number>();
    for (const row of input.dkWords) {
      if (isVerseMarker(row.text)) continue;
      const key = row.location.split(':').slice(0, 2).join(':');
      words.set(key, (words.get(key) ?? 0) + 1);
    }
    expect(words.size).toBe(6236);
    const oneWord = [...words].filter(([, n]) => n === 1).map(([key]) => key);
    expect(oneWord).toEqual(QURAN_ONE_WORD_AYAHS);
  });

  it('stores the rebuilt rows', () => {
    const forms = db
      .prepare('SELECT form, postings, whole FROM forms')
      .all() as {form: string; postings: string; whole: number}[];
    expect(forms).toHaveLength(rebuilt.forms.size);
    for (const {form, postings, whole} of forms) {
      expect(isFoldedForm(form)).toBe(true);
      expect(decodePostings(postings)).toEqual(rebuilt.forms.get(form));
      expect(whole).toBe(rebuilt.wholeWordForms.has(form) ? 1 : 0);
    }
    expect(
      db.prepare('SELECT id, root, words, ayahs FROM roots ORDER BY id').all(),
    ).toEqual(rebuilt.roots);
  });

  it('keeps the letters exactly as drawn only where no other word has them', () => {
    const at = (form: string) =>
      (rebuilt.forms.get(form) ?? []).map(code => {
        const slot = Math.floor(code / QURAN_FLAG_RANGE);
        const verse = verseKeyAt(Math.floor(slot / QURAN_SLOT_STRIDE));
        return `${verse}:${slot % QURAN_SLOT_STRIDE}`;
      });
    // يَٰٓأَيُّهَا, يَٰمُوسَىٰ and ٱلَّيْلِ as drawn
    expect(at('يايها')).toContain('2:21:1');
    expect(at('يموسي')).toContain('2:55:3');
    expect(at('اليل')).toContain('2:164:7');
    // يَٰقَوْمِ is drawn يقوم, ٱلَّٰٓـِٔى الي and ٱلَّٰتِى التي: the
    // spellings of يَقُومُ, إِلَى and ٱلَّتِى, which keep them alone.
    expect(at('يقوم').length).toBeGreaterThan(0);
    expect(at('يقوم')).not.toContain('2:54:5');
    expect(at('الي')).not.toContain('33:4:12');
    expect(at('التي')).not.toContain('4:23:21');
  });

  it('matches the forms only the letters as drawn give as whole words', async () => {
    const whole = rebuilt.wholeWordForms;
    for (const form of ['يايها', 'يموسي', 'اليل', 'واليل', 'يقومنا']) {
      expect({form, whole: whole.has(form)}).toEqual({form, whole: true});
    }
    for (const form of ['يقوم', 'الي', 'الليل', 'ياايها']) {
      expect({form, whole: whole.has(form)}).toEqual({form, whole: false});
    }
    // Every one is a rasm-only spelling of every word it holds.
    for (const form of whole) {
      for (const code of rebuilt.forms.get(form) ?? []) {
        expect(hasFlag(flagsOfCode(code), QURAN_FLAG.rasmOnly)).toBe(true);
      }
    }
    // Found as typed, never as the start of a word (الي, يقوم).
    const source = memoryPostingSource(rebuilt.forms, whole);
    expect([...(await source.exact(['اليل', 'يقومنا'])).keys()]).toEqual([
      'اليل',
      'يقومنا',
    ]);
    expect([...(await source.prefix('الي', 4000)).keys()]).not.toContain(
      'اليل',
    );
    expect([...(await source.prefix('يقوم', 4000)).keys()]).not.toContain(
      'يقومنا',
    );
  });

  it('puts a reviewed spelling only on the word it was reviewed for', () => {
    // REVIEWED_SPELLINGS gives 18:77:22 (لَتَّخَذْتَ) لاتخذت.
    expect(rebuilt.forms.get('لاتخذت')?.length).toBe(1);
    const moved = input.dkWords.map(row =>
      row.location === '18:77:22' ? {...row, text: 'لَوْ'} : row,
    );
    expect(() => buildQuranSearchIndex({...input, dkWords: moved})).toThrow(
      /18:77:22: reviewed spelling/,
    );
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
    const irab = new Database(IRAB_DB, {readonly: true});
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
