/**
 * What the right side says when a query finds nothing. A generic "No
 * matches" is right for a typo, but not for a query that is half typed
 * ("surah ", on its way to "surah yasin") or names a surah or verse that
 * doesn't exist ("115", "2:300"): those say what to type instead.
 */
import {SURAHS} from '../../../data/surahData';
import {
  normalizeSearchText,
  toSearchKey,
} from '../../../utils/search/normalize';

export type EmptyCopy = {title: string; hint: string};

const SURAH_COUNT = SURAHS.length;

// The prefix words tvSearch drops ("surah 36"), typed on their own.
const PREFIX_ONLY = /^(surah|surat|sura|soorah|سوره|سورت)$/;
const VERSE_FORM = /^(\d{1,3})\s*[:.]\s*(\d{1,3})$/;

const GENERIC_HINT =
  'Try a surah name or number, a reciter, a verse like 2:255, or a dua like “morning”.';

export function emptyStateCopy(query: string): EmptyCopy {
  const shown = query.trim();
  const key = toSearchKey(query);
  if (PREFIX_ONLY.test(key)) {
    return {
      title: 'Now type the surah',
      hint: 'Its name or number, like “surah Yasin” or “surah 36”.',
    };
  }
  const unprefixed = normalizeSearchText(query)
    .trim()
    .replace(/^(surah|surat|sura|soorah|سوره|سورت)\s+/i, '');
  const verse = unprefixed.match(VERSE_FORM);
  const number = /^\d+$/.test(unprefixed) ? Number(unprefixed) : null;
  const surahNumber = verse ? Number(verse[1]) : number;
  if (surahNumber !== null && (surahNumber < 1 || surahNumber > SURAH_COUNT)) {
    return {
      title: `There are ${SURAH_COUNT} surahs`,
      hint: `Type a number from 1 to ${SURAH_COUNT}: 36 is Ya-Sin, 114 is An-Nas.`,
    };
  }
  if (verse) {
    const surah = SURAHS.find(s => s.id === surahNumber);
    if (surah) {
      return {
        title: `${surah.name} has ${surah.verses_count} verses`,
        hint: `Type a verse from ${surah.id}:1 to ${surah.id}:${surah.verses_count}.`,
      };
    }
  }
  return {title: `No matches for “${shown}”`, hint: GENERIC_HINT};
}
