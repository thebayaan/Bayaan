// @ai-generated
// RFC-023 step 3: the verse index and the page lines are the same for every
// rewayah, so a script generates them (scripts/rewayah/gen-mushaf-tables.mjs).
// They load on the first Mushaf use: a user who only listens never parses them.
import type {DKLine} from './DigitalKhattDataService';
import {
  buildVerseIndex,
  type VerseIndex,
  type VerseRangeRow,
} from './wordStore';

const LINE_TYPES: readonly DKLine['line_type'][] = [
  'surah_name',
  'basmallah',
  'ayah',
];
const NUMBERS_PER_LINE = 7;

type GeneratedTables = typeof import('./mushafTables.generated');

let verseIndex: VerseIndex | null = null;

function generated(): GeneratedTables {
  return require('./mushafTables.generated') as GeneratedTables;
}

/** The verse index, built on first use. All 8 words DBs share it. */
export function loadVerseIndex(): VerseIndex {
  if (verseIndex) return verseIndex;
  const {SURAH_VERSE_COUNTS, VERSE_WORD_COUNTS} = generated();
  const rows: VerseRangeRow[] = [];
  let next = 0;
  let first = 1;
  SURAH_VERSE_COUNTS.forEach((verses, surahIndex) => {
    for (let ayah = 1; ayah <= verses; ayah++) {
      const last = first + VERSE_WORD_COUNTS[next] - 1;
      rows.push({surah: surahIndex + 1, ayah, first, last});
      first = last + 1;
      next += 1;
    }
  });
  verseIndex = buildVerseIndex(rows);
  return verseIndex;
}

/** Every page line, by page and line, as the layout database has them. */
export function loadPageLineRows(): DKLine[] {
  const {PAGE_LINES} = generated();
  const rows: DKLine[] = [];
  for (let i = 0; i < PAGE_LINES.length; i += NUMBERS_PER_LINE) {
    rows.push({
      page_number: PAGE_LINES[i],
      line_number: PAGE_LINES[i + 1],
      line_type: LINE_TYPES[PAGE_LINES[i + 2]],
      is_centered: PAGE_LINES[i + 3] as DKLine['is_centered'],
      // 0 where a line type has no such value ('' in the layout database).
      first_word_id: PAGE_LINES[i + 4],
      last_word_id: PAGE_LINES[i + 5],
      surah_number: PAGE_LINES[i + 6],
    });
  }
  return rows;
}
