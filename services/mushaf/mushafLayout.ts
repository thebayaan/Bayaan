// @ai-start
// RFC-023 step 3: the layout is fixed build-time data, the same for every
// rewayah (mushafTables.ts). DigitalKhattDataService builds it once, on its
// first use after the data loads (moved from DigitalKhattDataService).
import type {DKLine} from './DigitalKhattDataService';
import {loadPageLineRows, loadVerseIndex} from './mushafTables';
import {basmalaLineSurahs} from './RewayahBasmalaService';
import {verseIndexOfWord} from './wordStore';
// @ai-end

const TOTAL_PAGES = 604;

// @ai-start
export interface MushafLayout {
  pageLines: Map<number, DKLine[]>;
  surahStartPages: Record<number, number>;
  pageToSurah: Record<number, number>;
  /** Surah each basmallah line opens, keyed by layoutLineKey(page, line). */
  basmalaSurahs: Map<string, number>;
  /** Verse key → the page of its first word (getPageForVerse). */
  verseToPage: Map<string, number>;
}
// @ai-end

export function buildMushafLayout(): MushafLayout {
  const rows = loadPageLineRows(); // @ai
  const index = loadVerseIndex(); // @ai
  const pageLines = new Map<number, DKLine[]>();
  const surahStartPages: Record<number, number> = {};
  const pageToSurah: Record<number, number> = {};

  for (const row of rows) {
    const existing = pageLines.get(row.page_number);
    if (existing) existing.push(row);
    else pageLines.set(row.page_number, [row]);
  }

  // Build surah mappings by identifying the first Ayah of each surah.
  // This solves the "header at bottom of previous page" issue by anchoring the
  // surah to the page where its actual verse content begins.
  for (const row of rows) {
    if (row.line_type !== 'ayah') continue;
    // @ai-start
    const verse = verseIndexOfWord(index, row.first_word_id);
    const surahId = verse < 0 ? undefined : index.surah[verse];
    // @ai-end
    if (surahId && !surahStartPages[surahId]) {
      surahStartPages[surahId] = row.page_number;
    }
  }

  // Fallback: If any surahs are missing ayahs in the DB (unlikely),
  // use the surah_name lines as a secondary source.
  for (const row of rows) {
    if (row.line_type !== 'surah_name') continue;
    if (row.surah_number && !surahStartPages[row.surah_number]) {
      surahStartPages[row.surah_number] = row.page_number;
    }
  }

  // Fill pageToSurah for all pages
  const surahIds = Object.keys(surahStartPages)
    .map(Number)
    .sort((a, b) => surahStartPages[a] - surahStartPages[b]);
  for (let i = 0; i < surahIds.length; i++) {
    const surahId = surahIds[i];
    const startPage = surahStartPages[surahId];
    const endPage =
      i < surahIds.length - 1
        ? surahStartPages[surahIds[i + 1]] - 1
        : TOTAL_PAGES;
    for (let page = startPage; page <= endPage; page++) {
      if (!pageToSurah[page]) pageToSurah[page] = surahId;
    }
  }

  // @ai-start
  // The ayah lines hold the word ids in order, as the verses do.
  const ayahLines = rows.filter(row => row.line_type === 'ayah');
  const verseToPage = new Map<string, number>();
  for (let i = 0, line = 0; i < index.keys.length; i++) {
    const first = index.first[i];
    while (line < ayahLines.length && ayahLines[line].last_word_id < first) {
      line++;
    }
    if (line === ayahLines.length) break;
    if (ayahLines[line].first_word_id <= first) {
      verseToPage.set(index.keys[i], ayahLines[line].page_number);
    }
  }

  // Rows arrive sorted by page and line, as basmalaLineSurahs requires.
  const basmalaSurahs = basmalaLineSurahs(rows);
  return {pageLines, surahStartPages, pageToSurah, basmalaSurahs, verseToPage};
  // @ai-end
}
