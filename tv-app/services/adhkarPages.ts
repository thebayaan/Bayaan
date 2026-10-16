// Lays a dhikr out for the 10-foot reader: the phone's text markers turned
// into tones (the words to say, narration, additions, references), long
// rows split into pages the remote steps through, and a type size that fits.
import {
  parseAdhkarArabic,
  segmentAdhkarTranslation,
} from '../../utils/adhkarText';
import {arabicLength} from './adhkarBrowse';

export type Tone = 'dhikr' | 'narration' | 'addition' | 'reference';

export type Run = {tone: Tone; text: string};

export type DhikrPage = {
  arabic: Run[];
  translation: Run[];
  /** Arabic letters on this page, for sizing the type. */
  arabicLength: number;
};

/** Arabic letters (no diacritics) that fit one page at the smallest size. */
export const ARABIC_PAGE_LETTERS = 260;
/** Translation characters that fit under it. */
export const TRANSLATION_PAGE_CHARS = 380;

type Token = {tone: Tone; text: string; weight: number};

function words(tone: Tone, text: string, weigh: (w: string) => number) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map(word => ({tone, text: word, weight: weigh(word)}));
}

function arabicTokens(arabic: string): Token[] {
  return parseAdhkarArabic(arabic).flatMap(segment =>
    words(segment.kind, segment.text, arabicLength),
  );
}

function translationTokens(translation: string): Token[] {
  if (!translation.trim()) return [];
  return segmentAdhkarTranslation(translation).flatMap(segment =>
    words(segment.kind, segment.text, w => w.length + 1),
  );
}

/** Splits tokens into `count` chunks of about equal weight, in order. */
export function splitEvenly<T extends {weight: number}>(
  tokens: readonly T[],
  count: number,
): T[][] {
  const chunks: T[][] = Array.from({length: Math.max(1, count)}, () => []);
  const total = tokens.reduce((n, t) => n + t.weight, 0);
  let done = 0;
  let page = 0;
  for (const token of tokens) {
    // Move on once this page has its share, but never past the last page.
    if (
      page < chunks.length - 1 &&
      chunks[page].length > 0 &&
      done + token.weight / 2 > (total * (page + 1)) / chunks.length
    ) {
      page += 1;
    }
    chunks[page].push(token);
    done += token.weight;
  }
  return chunks;
}

/** Joins words of the same tone into runs. */
export function toRuns(tokens: readonly Token[]): Run[] {
  const runs: Run[] = [];
  for (const token of tokens) {
    const last = runs[runs.length - 1];
    if (last && last.tone === token.tone) last.text += ` ${token.text}`;
    else runs.push({tone: token.tone, text: token.text});
  }
  return runs;
}

/** The pages of a dhikr: one for most, more for long hadith and Quran. */
export function dhikrPages(arabic: string, translation: string): DhikrPage[] {
  const ar = arabicTokens(arabic);
  const en = translationTokens(translation);
  const arTotal = ar.reduce((n, t) => n + t.weight, 0);
  const enTotal = en.reduce((n, t) => n + t.weight, 0);
  const count = Math.max(
    1,
    Math.ceil(arTotal / ARABIC_PAGE_LETTERS),
    Math.ceil(enTotal / TRANSLATION_PAGE_CHARS),
  );
  const arPages = splitEvenly(ar, count);
  const enPages = splitEvenly(en, count);
  return arPages.map((tokens, i) => ({
    arabic: toRuns(tokens),
    translation: toRuns(enPages[i] ?? []),
    arabicLength: tokens.reduce((n, t) => n + t.weight, 0),
  }));
}

/** Arabic type size (design px) for a page with this many letters. */
export function arabicFontSize(letters: number): number {
  if (letters <= 30) return 92;
  if (letters <= 70) return 76;
  if (letters <= 130) return 62;
  if (letters <= 200) return 52;
  return 44;
}

/** Translation type size (design px) for a page with this many characters. */
export function translationFontSize(chars: number): number {
  if (chars <= 120) return 32;
  if (chars <= 240) return 28;
  return 25;
}

/**
 * The line under the translation: how many times to say it, then the
 * instruction or source, its lines joined, e.g. "Recite 100 times · Muslim".
 */
export function sourceLine(repeatCount: number, instruction: string): string {
  const lines = instruction.split('\n').map(line => line.trim());
  const parts = [
    repeatCount > 1 ? `Recite ${repeatCount} times` : '',
    ...lines,
  ];
  return parts.filter(Boolean).join(' · ');
}
