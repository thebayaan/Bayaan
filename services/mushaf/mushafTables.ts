// @ai-generated
// RFC-023 step 3: the verse index and the page lines are the same for every
// rewayah, so a script generates them (scripts/rewayah/gen-mushaf-tables.mjs).
// They load with the Mushaf data (after the splash, RFC-023 step 1), not with
// the bundle.
import type {DKLine} from './DigitalKhattDataService';
import {
  buildVerseIndex,
  type VerseIndex,
  type VerseRangeRow,
} from './wordStore';

// The line codes of PAGE_LINES (scripts/rewayah/gen-mushaf-tables.mjs).
const SURAH_NAME = '#';
const BASMALA = '*';
const UPPER_A = 65; // 'A': an ayah line of 1 word
const LOWER_A = 97; // 'a': the same, centred

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

/**
 * Every page line, by page and line, as the layout database has them. The
 * order gives the rest: the line numbers, the word ids of the ayah lines (one
 * after the other from 1) and the surah of each surah name line.
 */
export function loadPageLineRows(): DKLine[] {
  const {PAGE_LINES} = generated();
  const rows: DKLine[] = [];
  let lastWord = 0;
  let surah = 0;
  PAGE_LINES.forEach((codes, pageIndex) => {
    for (let i = 0; i < codes.length; i++) {
      const line = {page_number: pageIndex + 1, line_number: i + 1};
      // 0 where a line type has no such value ('' in the layout database).
      if (codes[i] === SURAH_NAME) {
        surah += 1;
        rows.push({
          ...line,
          line_type: 'surah_name',
          is_centered: 1,
          first_word_id: 0,
          last_word_id: 0,
          surah_number: surah,
        });
      } else if (codes[i] === BASMALA) {
        rows.push({
          ...line,
          line_type: 'basmallah',
          is_centered: 1,
          first_word_id: 0,
          last_word_id: 0,
          surah_number: 0,
        });
      } else {
        const code = codes.charCodeAt(i);
        const centred = code >= LOWER_A;
        const words = code - (centred ? LOWER_A : UPPER_A) + 1;
        rows.push({
          ...line,
          line_type: 'ayah',
          is_centered: centred ? 1 : 0,
          first_word_id: lastWord + 1,
          last_word_id: lastWord + words,
          surah_number: 0,
        });
        lastWord += words;
      }
    }
  });
  return rows;
}
