// @ai-generated
import {normalizeSearchText, toSearchKey} from '@/utils/search/normalize';

/**
 * Searching inside the Collection screens: every word of the query has to
 * appear in one of the fields. Punctuation and accents are ignored, so
 * "kahf" and "alkahf" both find "Al-Kahf", and Arabic matches without its
 * vowel marks.
 */
export function matchesQuery(
  query: string,
  fields: Array<string | number | null | undefined>,
): boolean {
  const words = toSearchKey(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const keys = fields
    .filter((f): f is string | number => f !== null && f !== undefined)
    .map(f => toSearchKey(String(f)))
    .filter(Boolean);
  const haystack = keys.join(' ');
  const compact = keys.map(k => k.replace(/ /g, '')).join(' ');
  return words.every(w => haystack.includes(w) || compact.includes(w));
}

/**
 * A verse reference typed as "2:255" (or a start of one, such as "2:2"),
 * with Arabic-Indic digits allowed. Matches a verse whose reference starts
 * with what was typed.
 */
export function matchesVerseRef(
  query: string,
  surahNumber: number,
  ayahNumber: number,
): boolean {
  const q = normalizeSearchText(query).replace(/\s/g, '');
  if (!/^\d+:\d*$/.test(q)) return false;
  return `${surahNumber}:${ayahNumber}`.startsWith(q);
}
