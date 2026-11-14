// Repro for finding 5 of the review of PR 490 (RFC-023 step 3).
//
// Finding: loadPageLineRows in mushafTables.ts casts '' to number for
// first_word_id, last_word_id and surah_number, so that its rows equal the raw
// rows of the layout database. DKLine types these fields as numbers, so the
// type says number while the value is a string.
//
// What this test expects: every page line that loadPageLineRows returns holds
// a whole number in each of the three fields, as its type says (0 where a line
// type has no such value, as the review suggests).
//
// What happens on the PR head: this test FAILS on all 9,046 lines. Every
// surah name line has '' for first_word_id and last_word_id, every ayah line
// has '' for surah_number, and every basmala line has '' for all three. The
// failure message gives the count and a sample of them.
import {loadPageLineRows} from '../mushafTables';

const NUMBER_FIELDS = [
  'first_word_id',
  'last_word_id',
  'surah_number',
] as const;

describe('repro 490 finding 5: page lines hold the numbers their type promises', () => {
  it('has a whole number in first_word_id, last_word_id and surah_number on every line', () => {
    const rows = loadPageLineRows();
    expect(rows.length).toBeGreaterThan(9000);

    const notNumbers = rows.filter(row =>
      NUMBER_FIELDS.some(field => !Number.isInteger(row[field])),
    );

    expect({
      linesWithANonNumber: notNumbers.length,
      sample: notNumbers.slice(0, 2),
    }).toEqual({linesWithANonNumber: 0, sample: []});
  });
});
