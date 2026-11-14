// @ai-generated
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import {
  compareDbs,
  DB_FORMAT,
  writeGharibDb,
  writeRasmDb,
  type GharibRow,
  type RasmRow,
} from '../word-study/db';
import {
  decodeRasmNotes,
  type WordStudySource,
} from '../../services/wordStudy/wordStudyFormat';

// Each run writes into its own folder under the Jest run's temp root
// (test-utils/jestGlobalSetup.js), which the teardown removes.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-study-db-'));
afterAll(() => fs.rmSync(dir, {recursive: true, force: true}));

const BOOK: WordStudySource = {
  id: 327,
  kind: 'gharib',
  ord: 1,
  nameAr: 'كتاب',
  nameEn: 'Book',
  authorAr: 'مؤلف',
  authorEn: 'Author',
  viaAr: 'ناشر',
  viaEn: 'Publisher',
  url: 'https://example.org',
  version: '2026-11-14',
};
const TEXT: WordStudySource = {...BOOK, id: 1, kind: 'rasm'};

const gharibRows: GharibRow[] = [
  {
    verseKey: '2:2',
    sourceId: 327,
    ord: 3,
    span: [3, 5],
    tier: 1,
    candidate: '',
    headword: 'لا ريب فيه',
    gloss: 'شرح',
    note: '',
    part: '',
    page: '',
  },
  {
    verseKey: '1:4',
    sourceId: 327,
    ord: 1,
    span: [2, 3],
    tier: 1,
    candidate: '',
    headword: 'يوم الدين',
    gloss: 'شرح',
    note: '',
    part: '',
    page: '',
  },
  {
    verseKey: '2:5',
    sourceId: 327,
    ord: 4,
    span: null,
    tier: 1,
    candidate: '2:2:3-5',
    headword: 'لا ريب فيه',
    gloss: 'شرح آخر',
    note: 'تنبيه',
    part: '1',
    page: '9',
  },
];

const rasmRows: RasmRow[] = [
  {
    verseKey: '2:3',
    from: 5,
    to: 5,
    imlaei: 'الصَّلَاةَ',
    notes: [
      {kind: 'badal', standard: 'ا', mushaf: 'و', mark: [5, 6], basis: 'sign'},
    ],
    reviewed: false,
  },
  {
    verseKey: '1:4',
    from: 1,
    to: 1,
    imlaei: 'مَالِكِ',
    notes: [
      {kind: 'hadhf', standard: 'ا', mushaf: '', mark: [2, 3], basis: 'sign'},
    ],
    reviewed: false,
  },
  {
    verseKey: '12:25',
    from: 9,
    to: 9,
    imlaei: 'لَدَى',
    notes: [
      {
        kind: 'badal',
        standard: 'ى',
        mushaf: 'ا',
        mark: null,
        basis: 'unconfirmed',
      },
    ],
    reviewed: true,
  },
];

function open(file: string) {
  return new Database(file, {readonly: true});
}

describe('writeGharibDb', () => {
  const file = path.join(dir, 'gharib.db');
  beforeAll(() =>
    writeGharibDb(file, [BOOK], gharibRows, {app_words: '77429'}),
  );

  it('has the tables, keys and WITHOUT ROWID', () => {
    const db = open(file);
    const tables = db
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all() as {name: string; sql: string}[];
    expect(tables.map(t => t.name)).toEqual([
      'gharib',
      'meta',
      'sources',
      'texts',
    ]);
    expect(tables.find(t => t.name === 'gharib')?.sql).toMatch(/WITHOUT ROWID/);
    const pk = (
      db.prepare('PRAGMA table_info(gharib)').all() as {
        name: string;
        pk: number;
      }[]
    )
      .filter(c => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map(c => c.name);
    expect(pk).toEqual(['verse_key', 'source_id', 'ord']);
    db.close();
  });

  it('stores texts once, with id 0 for the empty text', () => {
    const db = open(file);
    const texts = db
      .prepare('SELECT id, text FROM texts ORDER BY id')
      .all() as {
      id: number;
      text: string;
    }[];
    expect(texts[0]).toEqual({id: 0, text: ''});
    expect(new Set(texts.map(t => t.text)).size).toBe(texts.length);
    expect(texts.map(t => t.text)).toEqual(
      expect.arrayContaining([
        'يوم الدين',
        'لا ريب فيه',
        'شرح',
        'شرح آخر',
        'تنبيه',
      ]),
    );
    db.close();
  });

  it('writes the rows, with NULL spans for verse level', () => {
    const db = open(file);
    const rows = db
      .prepare(
        `SELECT g.verse_key, g.word_from, g.word_to, g.candidate, h.text AS headword, n.text AS note, g.part
           FROM gharib g JOIN texts h ON h.id = g.headword_id JOIN texts n ON n.id = g.note_id
          ORDER BY g.source_id, g.ord`,
      )
      .all();
    expect(rows).toEqual([
      {
        verse_key: '1:4',
        word_from: 2,
        word_to: 3,
        candidate: '',
        headword: 'يوم الدين',
        note: '',
        part: '',
      },
      {
        verse_key: '2:2',
        word_from: 3,
        word_to: 5,
        candidate: '',
        headword: 'لا ريب فيه',
        note: '',
        part: '',
      },
      {
        verse_key: '2:5',
        word_from: null,
        word_to: null,
        candidate: '2:2:3-5',
        headword: 'لا ريب فيه',
        note: 'تنبيه',
        part: '1',
      },
    ]);
    db.close();
  });

  it('writes meta and sources', () => {
    const db = open(file);
    const meta = Object.fromEntries(
      (
        db.prepare('SELECT key, value FROM meta').all() as {
          key: string;
          value: string;
        }[]
      ).map(r => [r.key, r.value]),
    );
    expect(meta).toEqual({
      format: String(DB_FORMAT),
      kind: 'gharib',
      app_words: '77429',
    });
    expect(db.prepare('SELECT * FROM sources').all()).toEqual([
      {
        id: 327,
        ord: 1,
        name_ar: 'كتاب',
        name_en: 'Book',
        author_ar: 'مؤلف',
        author_en: 'Author',
        via_ar: 'ناشر',
        via_en: 'Publisher',
        url: 'https://example.org',
        version: '2026-11-14',
      },
    ]);
    db.close();
  });

  it('refuses a text it cannot store', () => {
    expect(() =>
      writeGharibDb(
        path.join(dir, 'bad.db'),
        [BOOK],
        [{...gharibRows[0], gloss: 'see <b>'}],
        {},
      ),
    ).toThrow(/markup/);
  });
});

describe('writeRasmDb', () => {
  const file = path.join(dir, 'rasm.db');
  beforeAll(() =>
    writeRasmDb(file, TEXT, rasmRows, {
      notice: '# PLEASE DO NOT REMOVE',
      rows: '3',
    }),
  );

  it('has the tables, keys and WITHOUT ROWID', () => {
    const db = open(file);
    const tables = db
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all() as {name: string; sql: string}[];
    expect(tables.map(t => t.name)).toEqual(['meta', 'rasm', 'sources']);
    expect(tables.find(t => t.name === 'rasm')?.sql).toMatch(/WITHOUT ROWID/);
    const pk = (
      db.prepare('PRAGMA table_info(rasm)').all() as {
        name: string;
        pk: number;
      }[]
    )
      .filter(c => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map(c => c.name);
    expect(pk).toEqual(['verse_key', 'word_from']);
    db.close();
  });

  it('rows decode with the app decoder', () => {
    const db = open(file);
    const rows = db.prepare('SELECT * FROM rasm').all() as {
      verse_key: string;
      word_from: number;
      word_to: number;
      imlaei: string;
      notes: string;
      reviewed: number;
    }[];
    expect(rows.map(r => r.verse_key).sort()).toEqual(['12:25', '1:4', '2:3']);
    for (const r of rows) {
      const source = rasmRows.find(x => x.verseKey === r.verse_key);
      expect(decodeRasmNotes(r.notes)).toEqual(source?.notes);
      expect(r.reviewed).toBe(source?.reviewed ? 1 : 0);
      expect(r.imlaei).toBe(source?.imlaei);
    }
    db.close();
  });

  it('keeps the notice in meta', () => {
    const db = open(file);
    expect(
      (
        db.prepare("SELECT value FROM meta WHERE key = 'notice'").get() as {
          value: string;
        }
      ).value,
    ).toBe('# PLEASE DO NOT REMOVE');
    expect(
      (
        db.prepare("SELECT value FROM meta WHERE key = 'format'").get() as {
          value: string;
        }
      ).value,
    ).toBe('1');
    db.close();
  });

  it('refuses a unit without notes', () => {
    expect(() =>
      writeRasmDb(
        path.join(dir, 'bad.db'),
        TEXT,
        [{...rasmRows[0], notes: []}],
        {},
      ),
    ).toThrow(/no notes/);
  });
});

describe('compareDbs', () => {
  it('finds no difference between two builds of the same rows', () => {
    const a = path.join(dir, 'a.db');
    const b = path.join(dir, 'b.db');
    writeRasmDb(a, TEXT, rasmRows, {});
    writeRasmDb(b, TEXT, [...rasmRows].reverse(), {});
    expect(compareDbs(a, b)).toEqual([]);
  });

  it('lists the rows that differ', () => {
    const a = path.join(dir, 'c.db');
    const b = path.join(dir, 'd.db');
    writeRasmDb(a, TEXT, rasmRows, {});
    writeRasmDb(b, TEXT, rasmRows.slice(1), {});
    const diffs = compareDbs(a, b);
    expect(diffs[0]).toMatch(
      /^rasm: 1 row\(s\) only in the committed DB, 0 only in the rebuild/,
    );
  });
});
