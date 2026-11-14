// @ai RFC-023 step 2: the verse index of a words table.
/**
 * checkWordsTable checks a copy's ids against the generated verse index at
 * load. A chunk read gives one text for each id of its range, so a table whose
 * ids have a gap, or do not start at 1, would load, read 'ready', and fail
 * inside the first render.
 */
import type * as SQLite from 'expo-sqlite';
import {buildVerseIndex, checkWordsTable, WordStore} from '../wordStore';
import {
  verseIndexRows,
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

// The verse index the app takes from mushafTables.generated.ts.
const index = buildVerseIndex(verseIndexRows(OK));

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

describe('checkWordsTable', () => {
  it('accepts ids 1..n, and the first chunk reads', async () => {
    const db = fakeDb(OK);
    await checkWordsTable(db, index);
    const failures: unknown[] = [];
    const store = new WordStore(
      'x.db',
      db,
      index,
      async () => undefined,
      (_store, error) => failures.push(error),
    );
    expect(store.text(1)).toBe('a');
    expect(store.hasFailed).toBe(false);
    expect(failures).toEqual([]);
  });

  it.each([
    ['a gap between verses (id 3 missing)', OK.filter(row => row.id !== 3)],
    ['ids that start at 11', OK.map(row => ({...row, id: row.id + 10}))],
    [
      'a gap inside the last verse (id 4 is 5)',
      [...OK.slice(0, 3), {...OK[3], id: 5}],
    ],
  ])('rejects a table with %s', async (_name, rows) => {
    await expect(checkWordsTable(fakeDb(rows), index)).rejects.toThrow();
  });
});

describe('buildVerseIndex', () => {
  it.each([
    [
      'a gap between verses',
      [
        {surah: 1, ayah: 1, first: 1, last: 2},
        {surah: 1, ayah: 2, first: 4, last: 5},
      ],
    ],
    [
      'a first verse that starts at 11',
      [{surah: 1, ayah: 1, first: 11, last: 12}],
    ],
  ])('rejects rows with %s', (_name, rows) => {
    expect(() => buildVerseIndex(rows)).toThrow();
  });
});
