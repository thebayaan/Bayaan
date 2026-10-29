// Lays a dhikr out for the 10-foot reader: the phone's text markers turned
// into tones (the words to say, narration, additions, references), long
// rows split into pages the remote steps through (turning at sentence and
// surah ends), and a type size that fits.
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

/**
 * A word, its weight (letters), and how good a place it is to turn the page
 * after it: -1 hardly ever (inside a parenthesis), 0 mid-phrase, 1 a comma
 * or a verse inside a quoted surah, 2 a sentence or verse end, 3 the close
 * of a quoted surah.
 */
type Token = {tone: Tone; text: string; weight: number; brk: number};

/** How far (in page shares) a turn may stray from even to end at a break. */
const ARABIC_WINDOW = 0.3;
const TRANSLATION_WINDOW = 0.5;
/** Preference for each break strength, weighed against straying. */
const BREAK_BONUS = [0, 0.15, 0.4, 0.6];
/** Turning inside a parenthesis costs as much as straying a full share. */
const INSIDE_PENALTY = 1;
/** No page grows past this many shares while a shorter choice exists. */
const PAGE_LIMIT = 1.3;

function words(
  tone: Tone,
  text: string,
  weigh: (w: string) => number,
  strength: (w: string) => number,
): Token[] {
  const tokens = text
    .split(/\s+/)
    .filter(Boolean)
    .map(word => ({
      tone,
      text: word,
      weight: weigh(word),
      brk: strength(word),
    }));
  // A change of tone (narration into the words to say) is a sentence break.
  const last = tokens[tokens.length - 1];
  if (last) last.brk = Math.max(last.brk, 2);
  return tokens;
}

function arabicTokens(arabic: string): Token[] {
  // Inside a quoted surah (﴿ … ﴾) a verse end is only a weak break, so a
  // page turns between surahs rather than inside one.
  let quoted = false;
  const strength = (word: string): number => {
    if (word.includes('﴿')) quoted = true;
    if (word.includes('﴾')) {
      quoted = false;
      return 3;
    }
    let brk = 0;
    if (/[.*۔!؟:]["'»)\]]*$/.test(word)) brk = 2;
    else if (/[،,؛;]$/.test(word)) brk = 1;
    return quoted ? Math.min(brk, 1) : brk;
  };
  return parseAdhkarArabic(arabic).flatMap(segment =>
    words(segment.kind, segment.text, arabicLength, strength),
  );
}

function translationTokens(translation: string): Token[] {
  if (!translation.trim()) return [];
  // Never turn inside a parenthesis, e.g. "(Al-Ikhlas, Al-Falaq, An-Nas)".
  let depth = 0;
  const strength = (word: string): number => {
    depth = Math.max(
      0,
      depth +
        (word.match(/\(/g)?.length ?? 0) -
        (word.match(/\)/g)?.length ?? 0),
    );
    if (depth > 0) return -1;
    if (/[.!?]["'”’)\]]*$/.test(word)) return 2;
    if (/[,;:]["'”’)\]]*$/.test(word)) return 1;
    return 0;
  };
  return segmentAdhkarTranslation(translation).flatMap(segment =>
    words(segment.kind, segment.text, w => w.length + 1, strength),
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

/**
 * Where pages turn: for each target (a running weight), the boundary near
 * it that best ends a sentence or a quoted surah, within `window` shares.
 * Boundaries are token offsets; with `minPage` 1 no page is left empty.
 */
export function chooseBreaks(
  tokens: readonly {weight: number; brk: number}[],
  targets: readonly number[],
  share: number,
  window: number,
  minPage: 0 | 1,
): number[] {
  const prefix = [0];
  for (const token of tokens) {
    prefix.push(prefix[prefix.length - 1] + token.weight);
  }
  const breaks: number[] = [];
  let from = 0;
  targets.forEach((target, k) => {
    const after = targets.length - k;
    const lo = Math.min(from + minPage, tokens.length);
    const hi = Math.max(lo, tokens.length - after * minPage);
    let best = lo;
    let bestScore = Infinity;
    for (let b = lo; b <= hi; b++) {
      const dist = Math.abs(prefix[b] - target) / share;
      const brk = b > 0 && b < tokens.length ? tokens[b - 1].brk : 0;
      const bonus =
        brk < 0
          ? -INSIDE_PENALTY
          : dist <= window
            ? (BREAK_BONUS[brk] ?? 0)
            : 0;
      const tooLong = prefix[b] - prefix[from] > share * PAGE_LIMIT ? 10 : 0;
      const score = dist - bonus + tooLong;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    breaks.push(best);
    from = best;
  });
  return breaks;
}

function cut<T>(items: readonly T[], breaks: readonly number[]): T[][] {
  const edges = [0, ...breaks, items.length];
  return edges.slice(1).map((end, i) => items.slice(edges[i], end));
}

/** Joins words of the same tone into runs. */
export function toRuns<T extends {tone: Tone; text: string}>(
  tokens: readonly T[],
): Run[] {
  const runs: Run[] = [];
  for (const token of tokens) {
    const last = runs[runs.length - 1];
    if (last && last.tone === token.tone) last.text += ` ${token.text}`;
    else runs.push({tone: token.tone, text: token.text});
  }
  return runs;
}

/**
 * The Quran's ornate brackets as the plain pair the Uthmanic face draws.
 * The font has no ﴿ ﴾ and Android's fallback draws them as "{·". A plain
 * parenthesis mirrors in right-to-left text, so ﴿ (which opens) is "(".
 */
export function plainQuranBrackets(text: string): string {
  return text.replace(/﴿/g, '(').replace(/﴾/g, ')');
}

type PageOptions = {
  /** Draw ﴿ ﴾ as plain brackets (Android; see plainQuranBrackets). */
  plainBrackets?: boolean;
};

/**
 * The pages of a dhikr: one for most, more for long hadith and Quran. Pages
 * turn at a sentence or surah end where one is near, the Arabic first; the
 * translation then turns at its sentence nearest the same point, so both
 * languages on a page say the same part.
 */
export function dhikrPages(
  arabic: string,
  translation: string,
  options: PageOptions = {},
): DhikrPage[] {
  const ar = arabicTokens(arabic);
  const en = translationTokens(translation);
  const arTotal = ar.reduce((n, t) => n + t.weight, 0);
  const enTotal = en.reduce((n, t) => n + t.weight, 0);
  const needed = Math.max(
    Math.ceil(arTotal / ARABIC_PAGE_LETTERS),
    Math.ceil(enTotal / TRANSLATION_PAGE_CHARS),
  );
  const count = Math.max(1, Math.min(needed, ar.length));
  const arShare = arTotal / count || 1;
  const arBreaks = chooseBreaks(
    ar,
    Array.from({length: count - 1}, (_, k) => arShare * (k + 1)),
    arShare,
    ARABIC_WINDOW,
    1,
  );
  // The translation turns at the same fraction of the way through.
  const arPrefix = (b: number): number =>
    ar.slice(0, b).reduce((n, t) => n + t.weight, 0);
  const enBreaks = chooseBreaks(
    en,
    arBreaks.map(b => (arPrefix(b) / (arTotal || 1)) * enTotal),
    enTotal / count || 1,
    TRANSLATION_WINDOW,
    0,
  );
  const enPages = cut(en, enBreaks);
  const shown = (t: Token): Token =>
    options.plainBrackets ? {...t, text: plainQuranBrackets(t.text)} : t;
  return cut(ar, arBreaks).map((tokens, i) => ({
    arabic: toRuns(tokens.map(shown)),
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
  // A page that runs long to end at a sentence sets a touch smaller.
  return letters <= 290 ? 44 : 40;
}

/** Translation type size (design px) for a page with this many characters. */
export function translationFontSize(chars: number): number {
  if (chars <= 120) return 32;
  if (chars <= 240) return 28;
  return chars <= 420 ? 25 : 23;
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
