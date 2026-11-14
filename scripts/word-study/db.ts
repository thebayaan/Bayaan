// @ai-generated
/**
 * Writers of the word-study databases, assets/data/gharib-v<N>.db and
 * assets/data/rasm-v<N>.db, in the way scripts/irab/build-irab-db.ts writes
 * irab-v1.db: journal_mode DELETE, a meta table, deduplicated texts (id 0 is
 * ''), WITHOUT ROWID tables and a VACUUM, so a rebuild from the same inputs
 * gives the same rows. Read by services/wordStudy/WordStudyDataService.ts.
 */
import fs from 'fs';
import Database from 'better-sqlite3';
import {
  encodeRasmNotes,
  type RasmNote,
  type WordStudySource,
} from '../../services/wordStudy/wordStudyFormat';
import {textProblem} from './gharib';

/** meta.format: the app reimports a DB whose format it does not know. */
export const DB_FORMAT = 1;

const META_DDL =
  'CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);';

const SOURCES_DDL = `CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  ord INTEGER NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  author_ar TEXT NOT NULL,
  author_en TEXT NOT NULL,
  via_ar TEXT NOT NULL,
  via_en TEXT NOT NULL,
  url TEXT NOT NULL,
  version TEXT NOT NULL
);`;

export const GHARIB_DDL = `${META_DDL}
${SOURCES_DDL}
CREATE TABLE texts (id INTEGER PRIMARY KEY, text TEXT NOT NULL);
CREATE TABLE gharib (
  verse_key TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  ord INTEGER NOT NULL,
  word_from INTEGER,
  word_to INTEGER,
  tier INTEGER NOT NULL,
  candidate TEXT NOT NULL,
  headword_id INTEGER NOT NULL,
  gloss_id INTEGER NOT NULL,
  note_id INTEGER NOT NULL,
  part TEXT NOT NULL,
  page TEXT NOT NULL,
  PRIMARY KEY (verse_key, source_id, ord)
) WITHOUT ROWID;`;

export const RASM_DDL = `${META_DDL}
${SOURCES_DDL}
CREATE TABLE rasm (
  verse_key TEXT NOT NULL,
  word_from INTEGER NOT NULL,
  word_to INTEGER NOT NULL,
  imlaei TEXT NOT NULL,
  notes TEXT NOT NULL,
  reviewed INTEGER NOT NULL,
  PRIMARY KEY (verse_key, word_from)
) WITHOUT ROWID;`;

/** One gharib entry as stored. */
export interface GharibRow {
  verseKey: string;
  sourceId: number;
  ord: number;
  /** Words it is shown on; null: verse level. */
  span: [number, number] | null;
  /** 0 none, 1-3 matched, 4 loose, 5 hand-placed. */
  tier: number;
  /**
   * A match that is not shown, "s:a:w1-w2": tier 4 in its own verse, or
   * tiers 1-3 in a neighbouring verse. '' when none.
   */
  candidate: string;
  headword: string;
  gloss: string;
  note: string;
  part: string;
  page: string;
}

/** One rasm unit as stored. */
export interface RasmRow {
  verseKey: string;
  from: number;
  to: number;
  imlaei: string;
  notes: RasmNote[];
  reviewed: boolean;
}

function create(out: string, ddl: string): Database.Database {
  if (fs.existsSync(out)) fs.unlinkSync(out);
  const db = new Database(out);
  db.pragma('journal_mode = DELETE');
  db.exec(ddl);
  return db;
}

function writeMeta(
  db: Database.Database,
  kind: string,
  meta: Readonly<Record<string, string>>,
): void {
  const ins = db.prepare('INSERT INTO meta VALUES (?, ?)');
  ins.run('format', String(DB_FORMAT));
  ins.run('kind', kind);
  for (const key of Object.keys(meta).sort()) {
    if (key === 'format' || key === 'kind') {
      throw new Error(`meta key ${key} is written by the writer`);
    }
    ins.run(key, meta[key]);
  }
}

function writeSources(
  db: Database.Database,
  sources: readonly WordStudySource[],
): void {
  const ins = db.prepare(
    'INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const s of sources) {
    ins.run(
      s.id,
      s.ord,
      s.nameAr,
      s.nameEn,
      s.authorAr,
      s.authorEn,
      s.viaAr,
      s.viaEn,
      s.url,
      s.version,
    );
  }
}

/**
 * Writes gharib-v<N>.db. Rows are inserted in key order; texts are stored
 * once each, in first-use order, with id 0 for ''. Throws on a text that
 * cannot be stored (see textProblem) or a duplicate key.
 */
export function writeGharibDb(
  out: string,
  sources: readonly WordStudySource[],
  rows: readonly GharibRow[],
  meta: Readonly<Record<string, string>>,
): void {
  const db = create(out, GHARIB_DDL);
  try {
    db.transaction(() => {
      writeMeta(db, 'gharib', meta);
      writeSources(db, sources);
      const insText = db.prepare('INSERT INTO texts VALUES (?, ?)');
      const ids = new Map<string, number>();
      const textId = (text: string) => {
        let id = ids.get(text);
        if (id === undefined) {
          const problem = text ? textProblem(text) : null;
          if (problem) throw new Error(`gharib text has ${problem}: ${text}`);
          id = ids.size;
          ids.set(text, id);
          insText.run(id, text);
        }
        return id;
      };
      textId('');
      const ins = db.prepare(
        'INSERT INTO gharib VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      );
      const sorted = [...rows].sort(
        (a, b) =>
          verseOrder(a.verseKey, b.verseKey) ||
          a.sourceId - b.sourceId ||
          a.ord - b.ord,
      );
      for (const r of sorted) {
        ins.run(
          r.verseKey,
          r.sourceId,
          r.ord,
          r.span ? r.span[0] : null,
          r.span ? r.span[1] : null,
          r.tier,
          r.candidate,
          textId(r.headword),
          textId(r.gloss),
          textId(r.note),
          r.part,
          r.page,
        );
      }
    })();
    db.exec('VACUUM');
  } finally {
    db.close();
  }
}

/** Writes rasm-v<N>.db; the notes are stored with encodeRasmNotes. */
export function writeRasmDb(
  out: string,
  source: WordStudySource,
  rows: readonly RasmRow[],
  meta: Readonly<Record<string, string>>,
): void {
  const db = create(out, RASM_DDL);
  try {
    db.transaction(() => {
      writeMeta(db, 'rasm', meta);
      writeSources(db, [source]);
      const ins = db.prepare('INSERT INTO rasm VALUES (?, ?, ?, ?, ?, ?)');
      const sorted = [...rows].sort(
        (a, b) => verseOrder(a.verseKey, b.verseKey) || a.from - b.from,
      );
      for (const r of sorted) {
        if (!r.notes.length)
          throw new Error(`${r.verseKey}:${r.from}: no notes`);
        ins.run(
          r.verseKey,
          r.from,
          r.to,
          r.imlaei,
          encodeRasmNotes(r.notes),
          r.reviewed ? 1 : 0,
        );
      }
    })();
    db.exec('VACUUM');
  } finally {
    db.close();
  }
}

function verseOrder(a: string, b: string): number {
  const [sa, aa] = a.split(':').map(Number);
  const [sb, ab] = b.split(':').map(Number);
  return sa - sb || aa - ab;
}

/**
 * Every table of two DB files, row by row: the differences, or [] when they
 * hold the same data (the --check mode of the build CLIs).
 */
export function compareDbs(expected: string, actual: string): string[] {
  const a = new Database(expected, {readonly: true});
  const b = new Database(actual, {readonly: true});
  try {
    const schema = (db: Database.Database) =>
      db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name",
        )
        .all() as {name: string; sql: string}[];
    const sa = schema(a);
    const sb = schema(b);
    if (JSON.stringify(sa) !== JSON.stringify(sb)) {
      return ['the table definitions differ'];
    }
    const out: string[] = [];
    for (const {name} of sa) {
      const rows = (db: Database.Database) =>
        (db.prepare(`SELECT * FROM "${name}"`).raw().all() as unknown[][])
          .map(r => JSON.stringify(r))
          .sort();
      const ra = rows(a);
      const rb = rows(b);
      const setB = new Set(rb);
      const setA = new Set(ra);
      const missing = ra.filter(r => !setB.has(r));
      const extra = rb.filter(r => !setA.has(r));
      if (missing.length || extra.length) {
        out.push(
          `${name}: ${missing.length} row(s) only in the committed DB, ${extra.length} only in the rebuild`,
          ...missing.slice(0, 5).map(r => `  - ${r}`),
          ...extra.slice(0, 5).map(r => `  + ${r}`),
        );
      }
    }
    return out;
  } finally {
    a.close();
    b.close();
  }
}
