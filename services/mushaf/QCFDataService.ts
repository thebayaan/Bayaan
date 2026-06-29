// Word-level QCF V2 glyph supplier. The page STRUCTURE (which lines are
// surah-headers vs basmallah vs ayah, what y position each occupies) comes
// from the DigitalKhatt service — see digitalKhattDataService.getPageLines().
// This service only owns the page-font glyph codes for ayah lines, plus
// the constant for the basmala line.

interface RawWord {
  c: string;
  l: string;
  t: 'w' | 'e';
  f: string;
}
interface RawLine {
  n: number;
  w: RawWord[];
}
interface RawPage {
  p: number;
  l: RawLine[];
}
interface RawData {
  pages: RawPage[];
}

export interface QCFWord {
  code: string;
  location: string;
  charType: 'word' | 'end';
  fallbackText: string;
}

// Basmala codepoints. KFGQPC encodes the basmala glyphs in the page-1
// font (`p1-v2`) at U+FC41..U+FC44 because Al-Fatiha starts with basmala
// as its verse 1. Other page-fonts don't reliably carry these glyphs, so
// the canonical pattern (used by qcf_quran Flutter package and similar)
// is to ALWAYS render basmala with the page-1 font regardless of which
// surah-start page we're on.
//
// The 4 codepoints are the four word-glyphs of the basmala:
// "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" → ﱁ ﱂﱃ ﱄ.
export const BASMALA_TEXT = 'ﱁﱂﱃﱄ';
export const BASMALA_FONT_FAMILY = 'p1-v2';

// Per-page line-content overrides applied at lookup time. Currently
// empty — the QUL Tarteel-sourced qcf-pages.json (built via
// scripts/build-qcf-from-qul.mjs) has correct line breaks straight from
// the curated KFGQPC V2 layout. Add entries here only if a future page
// needs hand-tuning beyond what the source data provides.
const LINE_OVERRIDES: Record<number, {moveLastWordToNextLine: number[]}> = {};

class QCFDataService {
  private raw: RawData | null = null;
  private wordsCache = new Map<string, QCFWord[]>();

  private ensureLoaded(): RawData {
    if (this.raw) return this.raw;
    this.raw = require('@/data/mushaf/qcf/qcf-pages.json') as RawData;
    return this.raw;
  }

  // Returns the QCF V2 word glyphs for a given page+line. Page lines are
  // 1-indexed and match digitalKhattDataService.getPageLines() line_number.
  // Returns [] for line numbers without ayah content (surah_name, basmallah).
  getWordsForLine(pageNumber: number, lineNumber: number): QCFWord[] {
    const cacheKey = `${pageNumber}:${lineNumber}`;
    const cached = this.wordsCache.get(cacheKey);
    if (cached) return cached;

    const data = this.ensureLoaded();
    const page = data.pages[pageNumber - 1];
    if (!page || page.p !== pageNumber) {
      this.wordsCache.set(cacheKey, []);
      return [];
    }
    const rawLine = page.l.find(l => l.n === lineNumber);

    const toQCFWord = (rw: RawWord): QCFWord => ({
      code: rw.c,
      location: rw.l,
      charType: rw.t === 'e' ? 'end' : 'word',
      fallbackText: rw.f,
    });

    let words: QCFWord[] = rawLine ? rawLine.w.map(toQCFWord) : [];

    // Apply per-page overrides:
    //   - If THIS line was demoted (its last word should sit on the next
    //     line), drop the trailing word.
    //   - If the PREVIOUS line was demoted, prepend its last word here.
    const override = LINE_OVERRIDES[pageNumber];
    if (override) {
      if (override.moveLastWordToNextLine.includes(lineNumber) && rawLine) {
        words = words.slice(0, -1);
      }
      const prevLineNumber = lineNumber - 1;
      if (override.moveLastWordToNextLine.includes(prevLineNumber)) {
        const prevRaw = page.l.find(l => l.n === prevLineNumber);
        const movedWord = prevRaw?.w.at(-1);
        if (movedWord) {
          words = [toQCFWord(movedWord), ...words];
        }
      }
    }

    this.wordsCache.set(cacheKey, words);
    return words;
  }

  // Verse keys ('3:53', '3:54', ...) in reading order, deduped. Mirrors
  // MushafVerseMapService.getOrderedVerseKeysForPage but driven off the
  // QCF data rather than DK line text.
  getOrderedVerseKeysForPage(pageNumber: number): string[] {
    const data = this.ensureLoaded();
    const page = data.pages[pageNumber - 1];
    if (!page || page.p !== pageNumber) return [];

    const seen = new Set<string>();
    const keys: string[] = [];
    for (const line of page.l) {
      for (const word of line.w) {
        const [s, v] = word.l.split(':');
        const key = `${s}:${v}`;
        if (!seen.has(key)) {
          seen.add(key);
          keys.push(key);
        }
      }
    }
    return keys;
  }
}

export const qcfDataService = new QCFDataService();
