/**
 * Repro for finding 6 of the PR 489 review (RFC-023 step 2).
 *
 * buildVerseIndex only requires each verse's id range to start after the
 * previous one, and readVerseIndex compares the integrity counts with each
 * other, not with the id range. So a words table whose ids have a gap, or do
 * not start at 1, loads as a valid index. The rewayah then reads 'ready' and
 * fails inside the first render, on the first chunk read, and a retry
 * re-imports the same asset and fails the same way.
 *
 * What the tests expect: readVerseIndex rejects such a table at load, and a
 * store built over a table whose ids run 1..n reads its first chunk without
 * failing.
 *
 * What happens on the PR head: readVerseIndex resolves for ids 1,2,4 (keys
 * 1:1 and 1:2, wordCount 4) and for ids 11..14, and the store built from the
 * gap index fails its first chunk read with "3 texts for ids 1..4" (the one
 * built from ids 11..14 fails its first chunk read too).
 *
 * Run: npx jest services/mushaf/__tests__/repro_489_6_verse_index_gaps -w 1
 */
import type * as SQLite from 'expo-sqlite';
import {readVerseIndex, WordStore, type VerseIndex} from '../wordStore';
import {
  withWordStoreQueries,
  type FakeWordRow,
} from '../__fixtures__/wordStoreQueries';

// A table with ids 1..4: verse 1:1 is ids 1..2, verse 1:2 is ids 3..4.
const OK: FakeWordRow[] = [
  {id: 1, text: 'a', location: '1:1:1'},
  {id: 2, text: 'b', location: '1:1:2'},
  {id: 3, text: 'c', location: '1:2:1'},
  {id: 4, text: 'd', location: '1:2:2'},
];

/** An expo-sqlite database over `rows`, answering the WordStore's queries. */
function fakeDb(rows: FakeWordRow[]): SQLite.SQLiteDatabase {
  return withWordStoreQueries({
    async getFirstAsync() {
      return null;
    },
    async getAllAsync() {
      return rows;
    },
  }) as unknown as SQLite.SQLiteDatabase;
}

// The store reads from the same fake database its index was read from (the
// fake answers chunk reads from the rows that index read saw).
function storeOf(db: SQLite.SQLiteDatabase, index: VerseIndex) {
  const failures: unknown[] = [];
  const store = new WordStore(
    'x.db',
    db,
    index,
    async () => undefined,
    (_store, error) => failures.push(error),
  );
  return {store, failures};
}

describe('finding 6: the verse index and ids that are not 1..n', () => {
  it('control: ids 1..4 load and the first chunk reads', async () => {
    const db = fakeDb(OK);
    const index = await readVerseIndex(db);
    const {store, failures} = storeOf(db, index);
    expect(store.text(1)).toBe('a');
    expect(store.hasFailed).toBe(false);
    expect(failures).toEqual([]);
  });

  it('rejects a table with a gap between verses (id 3 missing) at load', async () => {
    const rows = OK.filter(row => row.id !== 3);
    // On the PR head this resolves: keys ['1:1', '1:2'], wordCount 4.
    await expect(readVerseIndex(fakeDb(rows))).rejects.toThrow();
  });

  it('rejects a table whose ids do not start at 1 (11..14) at load', async () => {
    const rows = OK.map(row => ({...row, id: row.id + 10}));
    await expect(readVerseIndex(fakeDb(rows))).rejects.toThrow();
  });

  it.each([
    ['a gap between verses (id 3 missing)', OK.filter(row => row.id !== 3)],
    ['ids that start at 11', OK.map(row => ({...row, id: row.id + 10}))],
  ])(
    'an index that loads never fails its first chunk read: %s',
    async (_name, rows) => {
      const db = fakeDb(rows);
      let index: VerseIndex;
      try {
        index = await readVerseIndex(db);
      } catch {
        return; // rejected at load: the fix this test asks for
      }
      const {store, failures} = storeOf(db, index);
      store.text(rows[0].id);
      expect({
        hasFailed: store.hasFailed,
        failures: failures.map(String),
      }).toEqual({hasFailed: false, failures: []});
    },
  );
});
