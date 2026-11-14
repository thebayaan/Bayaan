// @ai-generated
/**
 * LOCAL-ONLY unless BAYAAN_OVERLAY_DB_DIR is set (CI sets it); needs Node >=
 * 22.13 for node:sqlite. The generated tables must give exactly what the
 * databases give, on all 8 words DBs and the layout DB.
 */
import {spawnSync} from 'child_process';
import path from 'path';
import {loadPageLineRows, loadVerseIndex} from '../mushafTables';
import {bundledDkFile, hasNodeSqlite} from '../__fixtures__/bundledDkSqlite';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const WORDS_BASES = [
  'dk_words',
  'dk_words_shouba',
  'dk_words_bazzi',
  'dk_words_qumbul',
  'dk_words_warsh',
  'dk_words_qaloon',
  'dk_words_doori',
  'dk_words_soosi',
];

function readAll(base: string, sql: string): Record<string, unknown>[] {
  const {DatabaseSync} = require('node:sqlite') as {
    DatabaseSync: new (
      file: string,
      options?: object,
    ) => {
      prepare(s: string): {all(): Record<string, unknown>[]};
      close(): void;
    };
  };
  const db = new DatabaseSync(bundledDkFile(base), {readOnly: true});
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
}

const run =
  process.env.BAYAAN_OVERLAY_DB_DIR && hasNodeSqlite()
    ? describe
    : describe.skip;

run('the generated Mushaf tables', () => {
  it.each(WORDS_BASES)('%s: the verse index is its GROUP BY', base => {
    const rows = readAll(
      base,
      'SELECT surah, ayah, MIN(id) AS first, MAX(id) AS last FROM words GROUP BY surah, ayah ORDER BY first',
    );
    const index = loadVerseIndex();
    expect(index.keys).toHaveLength(6236);
    rows.forEach((row, i) => {
      expect(index.keys[i]).toBe(`${row.surah}:${row.ayah}`);
      expect(index.first[i]).toBe(row.first);
      expect(index.last[i]).toBe(row.last);
      expect(index.surah[i]).toBe(row.surah);
      expect(index.ayah[i]).toBe(row.ayah);
    });
  });

  it('the page lines are the rows of the layout DB', () => {
    // The layout DB has '' where a line type has no such value; the tables
    // have 0.
    const rows = readAll(
      'dk_layout',
      'SELECT * FROM pages ORDER BY page_number, line_number',
    ).map(row => ({
      ...row,
      first_word_id: row.first_word_id || 0,
      last_word_id: row.last_word_id || 0,
      surah_number: row.surah_number || 0,
    }));
    expect(loadPageLineRows()).toEqual(rows);
  });

  it('the module is not stale', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/rewayah/gen-mushaf-tables.mjs', '--check'],
      {cwd: REPO_ROOT, encoding: 'utf8'},
    );
    expect(
      result.stderr.replace(/\(node:.*\n|.*--trace-warnings.*\n/g, ''),
    ).toBe('');
    expect(result.status).toBe(0);
  });
});
