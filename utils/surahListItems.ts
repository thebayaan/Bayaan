// @ai-generated
import type {Surah} from '@/data/surahData';
import {getJuzForSurah} from '@/data/juzData';

export type SurahListItem =
  | {type: 'juz-header'; juz: number; key: string}
  | {
      type: 'surah-row';
      surahs: Surah[];
      key: string;
      /**
       * Multi-column lists only: the juz each surah in the row starts, or
       * null for a surah in the same juz as the one before it. Left out
       * when no surah in the row starts a juz.
       */
      juzStarts?: (number | null)[];
    };

export interface SurahListOptions {
  /** Cards get their own keys, so switching views never reuses a row. */
  viewMode: 'card' | 'list';
  /** Surahs per row: grid columns, or list columns on iPad. */
  numColumns: number;
  /**
   * Mark where each juz starts (list view only). One column gets a sticky
   * header row per juz; more columns label the surah that starts each juz.
   */
  juzHeaders: boolean;
}

function groupIntoRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/**
 * Rows for the surah list, in order, `numColumns` surahs to a row. With one
 * column, each juz is a section under a sticky header. With more, the
 * surahs flow on without breaks, since juz 3 to 10 hold a single surah
 * each and sections would leave half of those rows empty; the surah that
 * starts a juz carries its label instead.
 */
export function buildSurahListItems(
  surahs: Surah[],
  {viewMode, numColumns, juzHeaders}: SurahListOptions,
): {items: SurahListItem[]; stickyIndices: number[]} {
  const items: SurahListItem[] = [];
  const stickyIndices: number[] = [];
  const keyPrefix = viewMode === 'card' ? 'card' : 'surah';
  const pushRows = (section: Surah[]) => {
    for (const row of groupIntoRows(section, Math.max(1, numColumns))) {
      items.push({
        type: 'surah-row',
        surahs: row,
        key: `${keyPrefix}-${row.map(s => s.id).join('-')}`,
      });
    }
  };

  if (viewMode === 'card' || !juzHeaders) {
    pushRows(surahs);
    return {items, stickyIndices};
  }

  if (numColumns > 1) {
    let previousJuz: number | null = null;
    const juzStarts = surahs.map(surah => {
      const juz = getJuzForSurah(surah.id);
      const starts = juz !== previousJuz;
      previousJuz = juz;
      return starts ? juz : null;
    });
    for (let i = 0; i < surahs.length; i += numColumns) {
      const row = surahs.slice(i, i + numColumns);
      const rowStarts = juzStarts.slice(i, i + numColumns);
      items.push({
        type: 'surah-row',
        surahs: row,
        key: `${keyPrefix}-${row.map(s => s.id).join('-')}`,
        ...(rowStarts.some(juz => juz !== null) && {juzStarts: rowStarts}),
      });
    }
    return {items, stickyIndices};
  }

  let section: Surah[] = [];
  let currentJuz: number | null = null;
  for (const surah of surahs) {
    const juz = getJuzForSurah(surah.id);
    if (juz !== currentJuz) {
      pushRows(section);
      section = [];
      currentJuz = juz;
      stickyIndices.push(items.length);
      items.push({type: 'juz-header', juz, key: `juz-${juz}`});
    }
    section.push(surah);
  }
  pushRows(section);
  return {items, stickyIndices};
}
