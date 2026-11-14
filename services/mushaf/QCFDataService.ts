// @ai-generated
// The pages of Mushaf 1440: the KFGQPC 1441H Madinah print, line by line,
// with each word's glyph code in its QCF V4 page font. Built by
// scripts/build-qcf-1441-layout.mjs into data/mushaf/qcf/qcf-pages.json.
//
// Mushaf 1440 has its own line breaks (the print its glyphs were drawn for),
// which differ from the 1421H layout the DigitalKhatt fonts follow on about
// half the pages; the words of every page are the same. A word's id is the
// DigitalKhatt (Hafs) word slot id of the same word, so overlays computed on
// the DigitalKhatt line text map onto these words by id (qcfDkWordMap.ts).

export type QCFLineKind = 'surah_name' | 'basmallah' | 'ayah';

export interface QCFWord {
  /** The DigitalKhatt word slot id of this word (1-based, Quran order). */
  id: number;
  /** "surah:ayah:word" (an ayah's last word is its end marker). */
  location: string;
  /** "surah:ayah" */
  verseKey: string;
  /** Glyph code(s) of the word in its page font. */
  code: string;
}

export interface QCFLine {
  /** Line in the page's 15-line grid (pages 1-2: 8 lines). */
  lineNumber: number;
  kind: QCFLineKind;
  /** The surah a title or basmala line opens; null on ayah lines. */
  surahNumber: number | null;
  /** A short line the print centres at its natural width. */
  centered: boolean;
  words: readonly QCFWord[];
}

export interface QCFPageModel {
  pageNumber: number;
  lines: readonly QCFLine[];
}

type RawWord = [id: number, location: string, code: string];

interface RawLine {
  n: number;
  /** 'a' ayah, 's' surah title, 'b' basmala */
  k: 'a' | 's' | 'b';
  /** Surah of a title / basmala line. */
  s?: number;
  /** 1 when centred. */
  c?: 1;
  w?: RawWord[];
}

interface RawData {
  format: number;
  pages: Array<{p: number; l: RawLine[]}>;
}

export const QCF_TOTAL_PAGES = 604;

const KIND: Record<RawLine['k'], QCFLineKind> = {
  a: 'ayah',
  s: 'surah_name',
  b: 'basmallah',
};

const EMPTY_PAGE_LINES: readonly QCFLine[] = Object.freeze([]);

function verseKeyOf(location: string): string {
  const second = location.indexOf(':', location.indexOf(':') + 1);
  return location.slice(0, second);
}

class QCFDataService {
  private raw: RawData | null = null;
  private pages = new Map<number, QCFPageModel>();
  private verseKeys = new Map<number, string[]>();

  private ensureLoaded(): RawData {
    if (this.raw) return this.raw;
    const data = require('@/data/mushaf/qcf/qcf-pages.json') as RawData;
    if (data.format !== 2 || data.pages.length !== QCF_TOTAL_PAGES) {
      throw new Error('Mushaf 1440 page data is not the 1441H layout');
    }
    this.raw = data;
    return data;
  }

  /** Lines of a page in order; an empty page outside 1..604. */
  getPage(pageNumber: number): QCFPageModel {
    const cached = this.pages.get(pageNumber);
    if (cached) return cached;
    const rawPage = this.ensureLoaded().pages[pageNumber - 1];
    if (!rawPage || rawPage.p !== pageNumber) {
      return {pageNumber, lines: EMPTY_PAGE_LINES};
    }
    const lines: QCFLine[] = rawPage.l.map(line => ({
      lineNumber: line.n,
      kind: KIND[line.k],
      surahNumber: line.k === 'a' ? null : (line.s ?? null),
      centered: line.c === 1,
      words: (line.w ?? []).map(([id, location, code]) => ({
        id,
        location,
        verseKey: verseKeyOf(location),
        code,
      })),
    }));
    const page: QCFPageModel = {pageNumber, lines};
    this.pages.set(pageNumber, page);
    return page;
  }

  /** Verse keys ("3:53", ...) of a page in reading order, each once. */
  getOrderedVerseKeysForPage(pageNumber: number): string[] {
    const cached = this.verseKeys.get(pageNumber);
    if (cached) return cached;
    const keys: string[] = [];
    for (const line of this.getPage(pageNumber).lines) {
      for (const word of line.words) {
        if (keys[keys.length - 1] !== word.verseKey) keys.push(word.verseKey);
      }
    }
    this.verseKeys.set(pageNumber, keys);
    return keys;
  }

  /**
   * Surahs shown on a page, in order: those with words on it and those whose
   * title opens on it.
   */
  getSurahsOnPage(pageNumber: number): number[] {
    const surahs: number[] = [];
    const add = (surah: number) => {
      if (!surahs.includes(surah)) surahs.push(surah);
    };
    for (const line of this.getPage(pageNumber).lines) {
      if (line.surahNumber !== null) add(line.surahNumber);
      for (const word of line.words) {
        add(Number(word.verseKey.slice(0, word.verseKey.indexOf(':'))));
      }
    }
    return surahs;
  }
}

export const qcfDataService = new QCFDataService();
