/**
 * Quran passages inside adhkar rows, drawn with Digital Khatt (SkiaVerseText)
 * instead of the adhkar font.
 *
 * Each mapped row lists one span per Quran passage, in order. A passage is
 * the k-th ﴿ ... ﴾ block of the row's arabic (a ﴿ left open ends at the next
 * "))" or the end of the text), or the whole text when the row has no ﴿.
 * Word positions are Hafs Digital Khatt word positions (words DB
 * "surah:ayah:word"); a span that ends on a whole ayah keeps that ayah's end
 * marker. adhkarQuran.test.ts checks every span against the DK words and the
 * row text.
 */
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import type {AdhkarTextRange} from './adhkarText';

export interface AdhkarQuranSpan {
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  /** First word of ayahFrom (1-based). Omitted: the ayah's first word. */
  wordFrom?: number;
  /** Last word of ayahTo. Omitted: the whole ayah, end marker included. */
  wordTo?: number;
}

const AL_IKHLAS: AdhkarQuranSpan = {surah: 112, ayahFrom: 1, ayahTo: 4};
const AL_FALAQ: AdhkarQuranSpan = {surah: 113, ayahFrom: 1, ayahTo: 5};
const AN_NAS: AdhkarQuranSpan = {surah: 114, ayahFrom: 1, ayahTo: 6};
const AYAT_AL_KURSI: AdhkarQuranSpan = {surah: 2, ayahFrom: 255, ayahTo: 255};
const AZ_ZUKHRUF_13_14: AdhkarQuranSpan = {
  surah: 43,
  ayahFrom: 13,
  ayahTo: 14,
  wordFrom: 12,
};

function partial(
  surah: number,
  ayah: number,
  wordFrom: number,
  wordTo?: number,
): AdhkarQuranSpan {
  return {surah, ayahFrom: ayah, ayahTo: ayah, wordFrom, wordTo};
}

export const ADHKAR_QURAN_SPANS: Readonly<
  Record<string, readonly AdhkarQuranSpan[]>
> = {
  // Hisn al-Muslim rows with ﴿ ﴾ passages.
  '4': [{surah: 3, ayahFrom: 190, ayahTo: 200}],
  '50': [partial(23, 14, 18)],
  '70': [AL_IKHLAS, AL_FALAQ, AN_NAS],
  '71': [AYAT_AL_KURSI],
  '74': [partial(3, 159, 19, 26)],
  '75': [AYAT_AL_KURSI],
  '76': [AL_IKHLAS, AL_FALAQ, AN_NAS],
  '99': [AL_IKHLAS, AL_FALAQ, AN_NAS],
  '100': [AYAT_AL_KURSI],
  '101': [{surah: 2, ayahFrom: 285, ayahTo: 286}],
  '135': [{surah: 57, ayahFrom: 3, ayahTo: 3}],
  '206': [AZ_ZUKHRUF_13_14],
  '207': [AZ_ZUKHRUF_13_14],
  '235': [partial(2, 201, 4)],
  '236': [partial(2, 158, 1, 6)],
  // Quranic duas: the whole row is the passage.
  'quranic-1': [partial(2, 127, 8)],
  'quranic-2': [{surah: 2, ayahFrom: 128, ayahTo: 128}],
  'quranic-3': [partial(2, 201, 4)],
  'quranic-4': [partial(2, 250, 6)],
  'quranic-5': [partial(2, 285, 22)],
  'quranic-6': [partial(2, 286, 13, 19)],
  'quranic-7': [partial(2, 286, 20, 30)],
  'quranic-8': [partial(2, 286, 31)],
  'quranic-9': [{surah: 3, ayahFrom: 8, ayahTo: 8}],
  'quranic-10': [{surah: 3, ayahFrom: 9, ayahTo: 9}],
  'quranic-11': [partial(3, 16, 3)],
  'quranic-12': [{surah: 3, ayahFrom: 53, ayahTo: 53}],
  'quranic-13': [partial(3, 147, 7)],
  'quranic-14': [partial(3, 191, 13)],
  'quranic-15': [{surah: 3, ayahFrom: 192, ayahTo: 192}],
  'quranic-16': [{surah: 3, ayahFrom: 193, ayahTo: 193}],
  'quranic-17': [{surah: 3, ayahFrom: 194, ayahTo: 194}],
  'quranic-18': [partial(5, 83, 17)],
  'quranic-19': [partial(5, 114, 5)],
  'quranic-20': [partial(7, 23, 2)],
  'quranic-21': [partial(7, 47, 8)],
  'quranic-22': [partial(7, 89, 34)],
  'quranic-23': [partial(7, 126, 11)],
  'quranic-24': [{surah: 10, ayahFrom: 85, ayahTo: 86, wordFrom: 5}],
  'quranic-25': [{surah: 14, ayahFrom: 38, ayahTo: 38}],
  'quranic-26': [{surah: 14, ayahFrom: 40, ayahTo: 40}],
  'quranic-27': [{surah: 14, ayahFrom: 41, ayahTo: 41}],
  'quranic-28': [partial(18, 10, 7)],
  'quranic-29': [partial(23, 109, 7)],
  'quranic-30': [partial(23, 118, 2)],
  'quranic-31': [{surah: 25, ayahFrom: 65, ayahTo: 66, wordFrom: 3}],
  'quranic-32': [partial(25, 74, 3)],
  'quranic-33': [partial(35, 34, 2)],
  'quranic-34': [partial(40, 7, 14)],
  'quranic-35': [{surah: 40, ayahFrom: 8, ayahTo: 9}],
  'quranic-36': [partial(59, 10, 6)],
  'quranic-37': [partial(60, 4, 46)],
  'quranic-38': [{surah: 60, ayahFrom: 5, ayahTo: 5}],
  'quranic-39': [partial(66, 8, 35)],
  'quranic-40': [partial(66, 11, 10)],
};

/** The ﴿ ... ﴾ blocks of `arabic` (brackets included), or the whole text
 *  when it has none. */
export function findQuranPassages(arabic: string): AdhkarTextRange[] {
  if (!arabic.includes('﴿')) return [{start: 0, end: arabic.length}];
  const ranges: AdhkarTextRange[] = [];
  let from = 0;
  while (from < arabic.length) {
    const start = arabic.indexOf('﴿', from);
    if (start < 0) break;
    const close = arabic.indexOf('﴾', start);
    const marks = arabic.indexOf('))', start);
    let end: number;
    if (close >= 0 && (marks < 0 || close < marks)) end = close + 1;
    else end = marks >= 0 ? marks : arabic.length;
    ranges.push({start, end});
    from = end;
  }
  return ranges;
}

export interface AdhkarQuranPassages {
  ranges: AdhkarTextRange[];
  spans: readonly AdhkarQuranSpan[];
}

/** The row's Quran passages and their spans, or null when the row is not
 *  mapped or its text no longer has one passage per span. */
export function getAdhkarQuranPassages(
  dhikrId: string,
  arabic: string,
): AdhkarQuranPassages | null {
  const spans = ADHKAR_QURAN_SPANS[dhikrId];
  if (!spans) return null;
  const ranges = findQuranPassages(arabic);
  if (ranges.length !== spans.length) return null;
  return {ranges, spans};
}

/** Hafs verse keys a span covers, in order. */
export function spanVerseKeys(span: AdhkarQuranSpan): string[] {
  const keys: string[] = [];
  for (let ayah = span.ayahFrom; ayah <= span.ayahTo; ayah++) {
    keys.push(`${span.surah}:${ayah}`);
  }
  return keys;
}

/**
 * The span's Digital Khatt text: its words joined by single spaces (Hafs
 * slots), each whole ayah with its end marker. '' when any verse's words are
 * missing, so callers fall back to the adhkar text instead of drawing part
 * of the passage.
 */
export function joinSpanText(
  span: AdhkarQuranSpan,
  getVerseWords: (verseKey: string) => readonly DKWordInfo[],
): string {
  const parts: string[] = [];
  for (const verseKey of spanVerseKeys(span)) {
    const words = getVerseWords(verseKey);
    if (words.length === 0) return '';
    const ayah = Number(verseKey.split(':')[1]);
    const from = ayah === span.ayahFrom ? (span.wordFrom ?? 1) : 1;
    const to =
      ayah === span.ayahTo && span.wordTo !== undefined
        ? span.wordTo
        : Number.POSITIVE_INFINITY;
    for (const word of words) {
      if (word.wordPositionInVerse >= from && word.wordPositionInVerse <= to) {
        parts.push(word.text);
      }
    }
  }
  return parts.join(' ');
}
