// @ai-generated
/**
 * Maps between a Mushaf 1440 page (QCFDataService, the 1441H print's lines)
 * and the same page as the DigitalKhatt data service lays it out (the 1421H
 * lines every shared overlay is computed on).
 *
 * The shared page overlays (verse highlight layers, recitation follow-along,
 * hidden text and mistake colours, verse-unit selection, the mistake sheet)
 * all speak in DigitalKhatt line indices and character offsets of the line
 * text (lineWordSpans.ts). The two layouts hold the same words per page, and a
 * Mushaf 1440 word's id is the DigitalKhatt word slot id of that word, so a
 * DigitalKhatt run maps to whole words by id, and a word back to the first
 * character of its slot. Valid while the data service serves Hafs (Mushaf
 * 1440 draws Hafs only).
 */
import type {DKLine} from './DigitalKhattDataService';
import {
  getLineWordSpans,
  type LineWordSpan,
  type WordSlotSource,
} from './lineWordSpans';
import type {QCFPageModel} from './QCFDataService';

/** A word's slot on the DigitalKhatt page. */
export interface DkWordSlot {
  lineIndex: number;
  span: LineWordSpan;
}

/** A word's place on the Mushaf 1440 page. */
export interface QCFWordPlace {
  lineIndex: number;
  wordIndex: number;
}

/** A highlight over consecutive words of one Mushaf 1440 line. */
export interface QCFWordRun {
  /** First and last word (reading order) the run covers, inclusive. */
  firstWord: number;
  lastWord: number;
  color: string;
  style?: 'band' | 'underline' | 'caret';
}

/** A Mushaf 1440 line's runs, or `wholeLine` for a basmala being recited. */
export interface QCFLineHighlights {
  runs: QCFWordRun[];
  /** Colours of bands over the whole line (a basmala line). */
  wholeLine: string[];
}

interface DkHighlight {
  start: number;
  end: number;
  color: string;
  style?: 'band' | 'underline' | 'caret';
}

export interface QCFDkPageMap {
  /** The DigitalKhatt slot of a word, if the page has it. */
  slotOf(wordId: number): DkWordSlot | undefined;
  /** Where a word sits on the Mushaf 1440 page. */
  placeOf(wordId: number): QCFWordPlace | undefined;
  /** Word ids a DigitalKhatt run [start, end] of a line touches. */
  wordIdsInRun(dkLineIndex: number, start: number, end: number): number[];
  /** Mushaf 1440 line of the basmala a DigitalKhatt basmala line draws. */
  basmalaLineOf(dkLineIndex: number): number | undefined;
  /** DigitalKhatt line of the basmala a Mushaf 1440 basmala line draws. */
  dkBasmalaLineOf(lineIndex: number): number | undefined;
  /** Verse key of a word on the Mushaf 1440 page. */
  verseKeyAt(lineIndex: number, wordIndex: number): string | undefined;
}

/**
 * The map of one page. `basmalaSurahOf` names the surah a DigitalKhatt
 * basmallah line opens (DigitalKhattDataService.getBasmalaSurah).
 */
export function buildQCFDkPageMap(
  page: QCFPageModel,
  dkLines: readonly DKLine[],
  source: WordSlotSource,
  basmalaSurahOf: (line: DKLine) => number | null,
): QCFDkPageMap {
  const slots = new Map<number, DkWordSlot>();
  const lineSpans: LineWordSpan[][] = dkLines.map((line, lineIndex) => {
    const spans = getLineWordSpans(line, source);
    for (const span of spans) slots.set(span.wordId, {lineIndex, span});
    return spans;
  });

  const dkBasmalaLineBySurah = new Map<number, number>();
  dkLines.forEach((line, lineIndex) => {
    const surah = basmalaSurahOf(line);
    if (surah !== null) dkBasmalaLineBySurah.set(surah, lineIndex);
  });

  const places = new Map<number, QCFWordPlace>();
  const basmalaLineBySurah = new Map<number, number>();
  page.lines.forEach((line, lineIndex) => {
    line.words.forEach((word, wordIndex) => {
      places.set(word.id, {lineIndex, wordIndex});
    });
    if (line.kind === 'basmallah' && line.surahNumber !== null) {
      basmalaLineBySurah.set(line.surahNumber, lineIndex);
    }
  });

  return {
    slotOf: wordId => slots.get(wordId),
    placeOf: wordId => places.get(wordId),
    wordIdsInRun(dkLineIndex, start, end) {
      const ids: number[] = [];
      for (const span of lineSpans[dkLineIndex] ?? []) {
        if (span.start <= end && span.end >= start) ids.push(span.wordId);
      }
      return ids;
    },
    basmalaLineOf(dkLineIndex) {
      const line = dkLines[dkLineIndex];
      if (!line || line.line_type !== 'basmallah') return undefined;
      const surah = basmalaSurahOf(line);
      return surah === null ? undefined : basmalaLineBySurah.get(surah);
    },
    verseKeyAt: (lineIndex, wordIndex) =>
      page.lines[lineIndex]?.words[wordIndex]?.verseKey,
    dkBasmalaLineOf(lineIndex) {
      const line = page.lines[lineIndex];
      if (!line || line.kind !== 'basmallah' || line.surahNumber === null) {
        return undefined;
      }
      return dkBasmalaLineBySurah.get(line.surahNumber);
    },
  };
}

/**
 * DigitalKhatt line highlights (runs of character offsets) as runs of whole
 * Mushaf 1440 words, per Mushaf 1440 line. The order of the runs is kept, so
 * later layers still paint over earlier ones. A run that spans a line break
 * of the 1441H print becomes one run per line; the two parts of a verse's
 * band that a 1421H line break split, and that meet on one 1441H line, are
 * joined into one band (underlines and carets stay per word, as drawn on the
 * DigitalKhatt pages).
 */
export function mapDkHighlightsToQCF(
  highlights: ReadonlyMap<number, readonly DkHighlight[]>,
  map: QCFDkPageMap,
): Map<number, QCFLineHighlights> {
  const out = new Map<number, QCFLineHighlights>();
  const lineOf = (lineIndex: number): QCFLineHighlights => {
    let entry = out.get(lineIndex);
    if (!entry) {
      entry = {runs: [], wholeLine: []};
      out.set(lineIndex, entry);
    }
    return entry;
  };
  const isBand = (run: QCFWordRun) => (run.style ?? 'band') === 'band';
  const addRun = (lineIndex: number, run: QCFWordRun) => {
    const runs = lineOf(lineIndex).runs;
    if (isBand(run)) {
      const joined = runs.find(
        other =>
          isBand(other) &&
          other.color === run.color &&
          (other.lastWord + 1 === run.firstWord ||
            run.lastWord + 1 === other.firstWord) &&
          map.verseKeyAt(
            lineIndex,
            Math.max(other.firstWord, run.firstWord),
          ) ===
            map.verseKeyAt(lineIndex, Math.min(other.lastWord, run.lastWord)),
      );
      if (joined) {
        joined.firstWord = Math.min(joined.firstWord, run.firstWord);
        joined.lastWord = Math.max(joined.lastWord, run.lastWord);
        return;
      }
    }
    runs.push(run);
  };
  for (const [dkLineIndex, runs] of highlights) {
    const basmalaLine = map.basmalaLineOf(dkLineIndex);
    for (const highlight of runs) {
      if (basmalaLine !== undefined) {
        if ((highlight.style ?? 'band') === 'band') {
          lineOf(basmalaLine).wholeLine.push(highlight.color);
        }
        continue;
      }
      const byLine = new Map<number, number[]>();
      for (const id of map.wordIdsInRun(
        dkLineIndex,
        highlight.start,
        highlight.end,
      )) {
        const place = map.placeOf(id);
        if (!place) continue;
        const indices = byLine.get(place.lineIndex) ?? [];
        indices.push(place.wordIndex);
        byLine.set(place.lineIndex, indices);
      }
      for (const [lineIndex, indices] of byLine) {
        indices.sort((a, b) => a - b);
        let first = indices[0];
        for (let i = 1; i <= indices.length; i++) {
          if (i < indices.length && indices[i] === indices[i - 1] + 1) continue;
          addRun(lineIndex, {
            firstWord: first,
            lastWord: indices[i - 1],
            color: highlight.color,
            style: highlight.style,
          });
          if (i < indices.length) first = indices[i];
        }
      }
    }
  }
  return out;
}

/**
 * Per-word colours from DigitalKhatt per-character colours (hidden words,
 * mistakes, Allah-name highlights), by word id. A word takes the colour its
 * characters have; where only some characters are coloured (the Name inside
 * بِٱللَّهِ), the whole word takes it: a word is one glyph here.
 */
export function mapDkCharColorsToQCFWords(
  lineColors: readonly (ReadonlyMap<number, string> | null)[] | null,
  dkLines: readonly DKLine[],
  source: WordSlotSource,
): Map<number, string> {
  const out = new Map<number, string>();
  if (!lineColors) return out;
  lineColors.forEach((colors, lineIndex) => {
    if (!colors || colors.size === 0) return;
    for (const span of getLineWordSpans(dkLines[lineIndex], source)) {
      for (let i = span.start; i <= span.wordEnd; i++) {
        const color = colors.get(i);
        if (color !== undefined) {
          out.set(span.wordId, color);
          break;
        }
      }
    }
  });
  return out;
}
