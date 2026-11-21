// Each word's mutashabih alternatives: words that follow the same two words, or come
// before the same two words, anywhere in the official text, as letters. A lookup key
// for scoring, and never shown, logged or stored. Word numbers are the official
// text's, which equal the engine's except in the three ayat ayahLetters leaves out.

interface Table {
  /** Every alternative's letters. */
  letters: string;
  /** Every distinct list of alternatives: numbers into letters, base 36. */
  lists: string;
  /** One string a surah: each ayah's words, as numbers into lists plus one. */
  ayat: string[];
}

let table: Table | null = null;
let letters: string[] = [];
let lists: string[] = [];
const ayatBySurah = new Map<number, string[]>();

// Read on first use, so opening the app does not pay for a feature that may not run.
function getTable(): Table {
  if (table) return table;
  table = require('./alternatives.json') as Table;
  letters = table.letters.split(' ');
  lists = table.lists.split(';');
  return table;
}

export function alternativesOf(
  surah: number,
  ayah: number,
  word: number,
): string[] {
  const row = getTable().ayat[surah - 1];
  if (row === undefined) return [];
  let ayat = ayatBySurah.get(surah);
  if (!ayat) {
    ayat = row.split(';');
    ayatBySurah.set(surah, ayat);
  }
  const number = ayat[ayah - 1]?.split(',')[word];
  if (!number) return [];
  return lists[parseInt(number, 36) - 1]
    .split(',')
    .map(id => letters[parseInt(id, 36)]);
}
