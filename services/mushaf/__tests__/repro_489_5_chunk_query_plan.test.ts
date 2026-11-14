/**
 * Repro for finding 5 of the PR 489 review (RFC-023 step 2).
 *
 * DigitalKhattDataService.perPage.alldbs.test.ts ("a chunk read seeks by id")
 * explains `SELECT id, text, location FROM words WHERE id BETWEEN 1 AND 2048`
 * and asserts that the plan is exactly one row using the INTEGER PRIMARY KEY.
 * The app never runs that query. The WordStore runs WORD_CHUNK_QUERY
 * (wordStore.ts), a group_concat ordered by id, whose plan on all 8 bundled
 * words DBs has two rows: a temp B-tree for the group_concat ORDER BY, then
 * the SEARCH by primary key.
 *
 * What the test expects: the PR's own assertion holds for the query the app
 * actually runs. The query is read from wordStore.ts at run time (it is not
 * exported), so this test follows the production string.
 *
 * What happens on the PR head: the plan has two rows, so the PR's assertion
 * fails on every DB. The fix is in the PR's test, not in the app: export
 * WORD_CHUNK_QUERY, explain it, and assert that some row is
 * "SEARCH words USING INTEGER PRIMARY KEY" and no row is "SCAN words".
 * The second test in this file is that suggested assertion; it passes on the
 * head.
 *
 * LOCAL-ONLY like the suite it extends (skipped unless BAYAAN_OVERLAY_DB_DIR
 * is set; needs node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=bundled npx jest services/mushaf/__tests__/repro_489_5_chunk_query_plan -w 1
 */
import * as fs from 'fs';
import * as path from 'path';
import {bundledDkFile, hasNodeSqlite} from '../__fixtures__/bundledDkSqlite';

interface SqliteDb {
  prepare(sql: string): {all(...params: unknown[]): Record<string, unknown>[]};
  close(): void;
}

/** Every bundled words DB, by base. */
const BASES = [
  'dk_words',
  'dk_words_shouba',
  'dk_words_bazzi',
  'dk_words_qumbul',
  'dk_words_warsh',
  'dk_words_qaloon',
  'dk_words_doori',
  'dk_words_soosi',
];

/** WORD_CHUNK_QUERY as wordStore.ts declares it (it is module-private). */
function productionChunkQuery(): string {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'wordStore.ts'),
    'utf8',
  );
  const match = /const WORD_CHUNK_QUERY =\s*'([^']+)';/.exec(source);
  if (!match) throw new Error('WORD_CHUNK_QUERY not found in wordStore.ts');
  return match[1];
}

function plan(base: string, sql: string, params: unknown[]): string[] {
  const {DatabaseSync} = require('node:sqlite') as {
    DatabaseSync: new (file: string, options?: object) => SqliteDb;
  };
  const db = new DatabaseSync(bundledDkFile(base), {readOnly: true});
  try {
    return db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...params)
      .map(row => String(row.detail));
  } finally {
    db.close();
  }
}

const run =
  process.env.BAYAAN_OVERLAY_DB_DIR && hasNodeSqlite()
    ? describe
    : describe.skip;

run('finding 5: the plan test and the query the app runs', () => {
  const query = productionChunkQuery();

  it('reads the production query', () => {
    expect(query).toContain('group_concat');
  });

  // The PR's assertion, applied to the query the app runs.
  it.each(BASES)(
    '%s: the chunk query the app runs has the plan the PR asserts',
    base => {
      expect(plan(base, query, [1, 2048])).toEqual([
        expect.stringContaining('USING INTEGER PRIMARY KEY'),
      ]);
    },
  );

  // The suggested replacement assertion (passes on the PR head).
  it.each(BASES)(
    '%s: the chunk query the app runs seeks and never scans',
    base => {
      const rows = plan(base, query, [1, 2048]);
      expect(
        rows.some(r => /SEARCH words USING INTEGER PRIMARY KEY/.test(r)),
      ).toBe(true);
      expect(rows.some(r => /SCAN words/.test(r))).toBe(false);
    },
  );
});
