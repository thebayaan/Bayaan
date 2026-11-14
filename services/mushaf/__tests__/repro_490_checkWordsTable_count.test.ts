// Repro for finding 4 of the review of PR 490 (RFC-023 step 3).
//
// Finding: the count check this PR adds to checkWordsTable (wordStore.ts)
// compares a words table copy with the last word id of the generated verse
// index. No test covers it: replacing the expected count with the table's own
// row count (the step 2 behaviour) leaves every test green.
//
// What this test expects: a words table copy that is one row short, with every
// remaining row well formed (no NULL field), is rejected, because the shipped
// verse index says the table must hold one more word.
//
// What happens on the PR head: this test PASSES, because the check is there.
// It is the missing test. It FAILS as soon as the check is reverted, for
// example by changing
//   const expected = index.last[index.last.length - 1];
// to
//   const expected = counts.n;
// in services/mushaf/wordStore.ts.
import type * as SQLite from 'expo-sqlite';
import {checkWordsTable} from '../wordStore';
import {
  fakeMushafTables,
  withWordStoreQueries,
  type FakeWordRow,
} from '../__fixtures__/wordStoreQueries';

// The same six words as the fake tables of dkDeliveryFailures.test.ts.
const LOCATIONS = ['1:1:1', '1:1:2', '1:2:1', '1:2:2', '2:1:1', '2:1:2'];

// The verse index the app would take from mushafTables.generated.ts.
const index = fakeMushafTables(LOCATIONS, []).loadVerseIndex();

function fakeWordsTable(rows: readonly FakeWordRow[]): SQLite.SQLiteDatabase {
  return withWordStoreQueries({
    getFirstAsync: async () => null,
    getAllAsync: async () => rows.map(row => ({...row})),
  }) as unknown as SQLite.SQLiteDatabase;
}

const fullTable: FakeWordRow[] = LOCATIONS.map((location, i) => ({
  id: i + 1,
  text: `w${i + 1}`,
  location,
}));

describe('repro 490 finding 4: checkWordsTable compares the copy with the shipped index', () => {
  it('accepts a complete words table (the fake itself is valid)', async () => {
    await expect(
      checkWordsTable(fakeWordsTable(fullTable), index),
    ).resolves.toBeUndefined();
  });

  it('rejects a words table one row short whose rows are all well formed', async () => {
    const oneRowShort = fullTable.slice(0, -1);
    expect(oneRowShort).toHaveLength(index.last[index.last.length - 1] - 1);

    await expect(
      checkWordsTable(fakeWordsTable(oneRowShort), index),
    ).rejects.toThrow('words table has a malformed row');
  });
});
