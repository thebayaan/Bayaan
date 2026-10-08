import {digitalKhattDataService} from './DigitalKhattDataService'; // @ai
import {getLineWordSpans, spanTokens} from './lineWordSpans';

// Strip Arabic marks so Allah-name matching survives different mushaf forms:
// الله / ٱللَّه / لِلَّه / تَاللَّه / اللهم / رب / برب / وربك / ربكم
const ARABIC_MARKS = /\p{M}/gu;
const TATWEEL = /\u0640/g;
const ALLAH_MATCHES = ['اللهم', 'للهم', 'الله', 'لله'] as const;
const DROPPED_ALIF_MATCHES = new Set(['للهم', 'لله']);
const RABB_FORMS = [
  'رب',
  'ربي',
  'ربك',
  'ربكم',
  'ربكما',
  'ربكن',
  'ربنا',
  'ربه',
  'ربها',
  'ربهما',
  'ربهم',
  'ربهن',
] as const;
const RABB_PREFIXES = ['', 'و', 'ف', 'ب', 'ل'] as const;

interface NormalizedCharMap {
  normalized: string;
  normalizedToOriginal: number[];
}

function normalizeArabic(text: string): string {
  return text
    .normalize('NFKD')
    .replace(ARABIC_MARKS, '')
    .replace(TATWEEL, '')
    .replace(/[ٱأإآ]/g, 'ا')
    .trim();
}

export function wordContainsAllahName(text: string): boolean {
  const normalized = normalizeArabic(text);
  return (
    ALLAH_MATCHES.some(form => normalized.includes(form)) ||
    RABB_FORMS.some(
      form =>
        normalized === form ||
        RABB_PREFIXES.some(prefix => normalized === `${prefix}${form}`),
    )
  );
}

function normalizeArabicChar(char: string): string {
  return char
    .normalize('NFKD')
    .replace(ARABIC_MARKS, '')
    .replace(TATWEEL, '')
    .replace(/[ٱأإآ]/g, 'ا');
}

function isArabicMarkOrTatweel(char: string): boolean {
  return char.replace(ARABIC_MARKS, '').replace(TATWEEL, '').length === 0;
}

function buildNormalizedCharMap(text: string): NormalizedCharMap {
  let normalized = '';
  const normalizedToOriginal: number[] = [];

  for (let originalIndex = 0; originalIndex < text.length; originalIndex++) {
    const normalizedChar = normalizeArabicChar(text.charAt(originalIndex));
    if (!normalizedChar) continue;

    for (const outputChar of normalizedChar) {
      normalized += outputChar;
      normalizedToOriginal.push(originalIndex);
    }
  }

  return {normalized, normalizedToOriginal};
}

function findAllahNameRangesInWord(
  word: string,
): Array<{start: number; end: number}> {
  const {normalized, normalizedToOriginal} = buildNormalizedCharMap(word);
  if (!normalized) return [];

  const ranges: Array<{start: number; end: number}> = [];

  for (let searchStart = 0; searchStart < normalized.length; ) {
    let matchIndex = -1;
    let matchedForm: (typeof ALLAH_MATCHES)[number] | null = null;

    for (let i = searchStart; i < normalized.length; i++) {
      const form = ALLAH_MATCHES.find(candidate =>
        normalized.startsWith(candidate, i),
      );
      if (form) {
        matchIndex = i;
        matchedForm = form;
        break;
      }
    }

    if (matchIndex === -1 || !matchedForm) break;

    const normalizedStart =
      matchIndex + (DROPPED_ALIF_MATCHES.has(matchedForm) ? 1 : 0);
    const normalizedEnd = matchIndex + matchedForm.length - 1;

    const start = normalizedToOriginal[normalizedStart];
    let end = normalizedToOriginal[normalizedEnd];
    if (start !== undefined && end !== undefined) {
      while (
        end + 1 < word.length &&
        isArabicMarkOrTatweel(word.charAt(end + 1))
      ) {
        end += 1;
      }
      ranges.push({start, end});
    }

    searchStart = matchIndex + matchedForm.length;
  }

  return ranges;
}

function findRabbTitleRangesInWord(
  word: string,
): Array<{start: number; end: number}> {
  const {normalized, normalizedToOriginal} = buildNormalizedCharMap(word);
  if (!normalized) return [];

  for (const form of RABB_FORMS) {
    if (normalized === form) {
      const start = normalizedToOriginal[0];
      let end = normalizedToOriginal[normalized.length - 1];
      if (start === undefined || end === undefined) return [];
      while (
        end + 1 < word.length &&
        isArabicMarkOrTatweel(word.charAt(end + 1))
      ) {
        end += 1;
      }
      return [{start, end}];
    }

    for (const prefix of RABB_PREFIXES) {
      if (!prefix) continue;
      const candidate = `${prefix}${form}`;
      if (normalized === candidate) {
        const start = normalizedToOriginal[prefix.length];
        let end = normalizedToOriginal[candidate.length - 1];
        if (start === undefined || end === undefined) return [];
        while (
          end + 1 < word.length &&
          isArabicMarkOrTatweel(word.charAt(end + 1))
        ) {
          end += 1;
        }
        return [{start, end}];
      }
    }
  }

  return [];
}

export function getTextAllahNameCharMap(
  text: string,
): Map<number, string> | null {
  if (!text) return null;

  const charToColor = new Map<number, string>();
  let charOffset = 0;
  const words = text.split(' ');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const highlightRanges = [
      ...findAllahNameRangesInWord(word),
      ...findRabbTitleRangesInWord(word),
    ];
    for (const range of highlightRanges) {
      for (let charIndex = range.start; charIndex <= range.end; charIndex++) {
        charToColor.set(
          charOffset + charIndex,
          word.slice(range.start, range.end + 1),
        );
      }
    }
    charOffset += word.length;
    if (i < words.length - 1) charOffset += 1;
  }

  return charToColor.size > 0 ? charToColor : null;
}

/**
 * Allah-name / Rabb-title char map for a mushaf line, computed on the text the
 * line actually renders (the active words cache, laid out with the shared
 * span model: blank slots skipped, multi-token slots kept whole). Each
 * space-separated token is matched at its rendered offset, so a slot that
 * carries an inline verse number ('رَبِّكَ ۝٣') or two words still matches
 * whole-word forms.
 */
export function getLineAllahNameCharMap(
  pageNumber: number,
  lineIndex: number,
): Map<number, string> | null {
  const line = digitalKhattDataService.getPageLines(pageNumber)[lineIndex];
  if (!line || line.line_type === 'surah_name') return null;

  if (line.line_type === 'basmallah') {
    // The rewayah's own basmala, exactly as the line draws it. @ai
    return getTextAllahNameCharMap(digitalKhattDataService.getLineText(line)); // @ai
  }

  const charToColor = new Map<number, string>();

  for (const span of getLineWordSpans(line, digitalKhattDataService)) {
    for (const {token: wordText, start: charOffset} of spanTokens(
      span.text,
      span.start,
    )) {
      const highlightRanges = [
        ...findAllahNameRangesInWord(wordText),
        ...findRabbTitleRangesInWord(wordText),
      ];
      for (const range of highlightRanges) {
        for (let charIndex = range.start; charIndex <= range.end; charIndex++) {
          charToColor.set(
            charOffset + charIndex,
            wordText.slice(range.start, range.end + 1),
          );
        }
      }
    }
  }

  return charToColor.size > 0 ? charToColor : null;
}
