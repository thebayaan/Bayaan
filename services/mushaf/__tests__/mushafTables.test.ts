// @ai-generated
/**
 * The generated tables, decoded as the app decodes them (no DB needed). The
 * all-databases test compares them with the databases.
 */
import {loadPageLineRows} from '../mushafTables';

const NUMBER_FIELDS = [
  'first_word_id',
  'last_word_id',
  'surah_number',
] as const;

describe('the generated page lines', () => {
  it('hold a whole number in every number field, 0 where a line type has none', () => {
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
