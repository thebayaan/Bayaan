import {
  BASMALLAH_TEXT,
  digitalKhattDataService,
} from './DigitalKhattDataService';
import {quranTextService} from './QuranTextService';

// Strip Arabic marks so Allah-name matching survives different mushaf forms:
// الله / ٱللَّه / لِلَّه / تَاللَّه / اللهم
const ARABIC_MARKS = /\p{M}/gu;
const TATWEEL = /\u0640/g;
const ALLAH_MATCHES = ['اللهم', 'للهم', 'الله', 'لله'] as const;
const DROPPED_ALIF_MATCHES = new Set(['للهم', 'لله']);

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
  return ALLAH_MATCHES.some(form => normalized.includes(form));
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

export function getTextAllahNameCharMap(
  text: string,
): Map<number, string> | null {
  if (!text) return null;

  const charToColor = new Map<number, string>();
  let charOffset = 0;
  const words = text.split(' ');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const allahRanges = findAllahNameRangesInWord(word);
    for (const range of allahRanges) {
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

export function getLineAllahNameCharMap(
  pageNumber: number,
  lineIndex: number,
): Map<number, string> | null {
  const lines = digitalKhattDataService.getPageLines(pageNumber);
  if (lineIndex >= lines.length) return null;

  const line = lines[lineIndex];
  if (line.line_type === 'surah_name') return null;

  const lineText = quranTextService.getLineText(pageNumber, lineIndex);
  if (!lineText) return null;

  if (line.line_type === 'basmallah') {
    return getTextAllahNameCharMap(BASMALLAH_TEXT);
  }

  const charToColor = new Map<number, string>();
  let charOffset = 0;

  for (let wordId = line.first_word_id; wordId <= line.last_word_id; wordId++) {
    const wordText = digitalKhattDataService.getWordText(wordId);
    if (!wordText) {
      if (wordId < line.last_word_id) charOffset += 1;
      continue;
    }

    const allahRanges = findAllahNameRangesInWord(wordText);
    for (const range of allahRanges) {
      for (let charIndex = range.start; charIndex <= range.end; charIndex++) {
        charToColor.set(
          charOffset + charIndex,
          wordText.slice(range.start, range.end + 1),
        );
      }
    }

    charOffset += wordText.length;
    if (wordId < line.last_word_id) charOffset += 1;
  }

  return charToColor.size > 0 ? charToColor : null;
}
