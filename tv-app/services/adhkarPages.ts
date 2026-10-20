// Lays a dhikr out for the 10-foot reader: the phone's text markers turned
// into tones (the words to say, narration, additions, references, surah
// headings), long rows split into pages the remote steps through (turning at
// sentence and surah ends), the translator's notes kept off the reading
// pages, and a type size that fits.
import {
  parseAdhkarArabic,
  segmentAdhkarTranslation,
} from '../../utils/adhkarText';
import {arabicLength} from './adhkarBrowse';

export type Tone = 'dhikr' | 'narration' | 'addition' | 'reference' | 'heading';

export type Run = {tone: Tone; text: string};

export type DhikrPage = {
  arabic: Run[];
  translation: Run[];
  /**
   * The translator's notes and the instruction's explanation (glossaries,
   * the meaning of a Name), as a paragraph under the translation. A page of
   * notes alone (no Arabic) follows the dhikr when they would crowd its last.
   */
  notes: string;
  /** Arabic letters on this page, for sizing the type. */
  arabicLength: number;
};

/** Arabic letters (no diacritics) that fit one page at the smallest size. */
export const ARABIC_PAGE_LETTERS = 260;
/** Translation characters that fit under a full page of Arabic. */
export const TRANSLATION_PAGE_CHARS = 640;
/** No page of a long dhikr has fewer Arabic letters than this. */
export const MIN_PAGE_LETTERS = 60;
/**
 * How full the last page may get with the notes added (1 is a full page of
 * Arabic, or of translation, alone); fuller, the notes get their own page.
 */
const NOTES_PAGE_LOAD = 1.5;
/** Notes this short always stay under the last page. */
const SHORT_NOTES_CHARS = 120;
// A note that only restates the count ("three times", "one hundred times"),
// which the ring and the source line already say.
const COUNT_ONLY = /^([a-z]+[- ]){0,2}[a-z]+ times\.?$/i;

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
  const tokens = parseAdhkarArabic(arabic).flatMap(segment =>
    words(segment.kind, segment.text, arabicLength, strength),
  );
  // The data's verse separators ("أَحَدٌ*") and the plain parentheses that
  // wrap a recited surah are Hisn al-Muslim markup, not text to show (the
  // breaks are read from them first). A word left empty gives its break to
  // the word before.
  const shown: Token[] = [];
  for (const token of tokens) {
    const text = token.text.replace(/[*()]/g, '');
    const last = shown[shown.length - 1];
    if (!/\S/.test(text)) {
      if (last) last.brk = Math.max(last.brk, token.brk);
      continue;
    }
    shown.push({...token, text});
  }
  return shown;
}

/**
 * "Soorah al-Ikhlaas 112" as a heading, "Surah al-Ikhlaas (112)", so a
 * quoted surah's name reads apart from its first verse number.
 */
export function surahHeading(label: string): string {
  return label
    .replace(/\bSoorah\b/gi, 'Surah')
    .replace(/\bAayah\b/gi, 'Ayah')
    .replace(/(\b(?!Ayah\b)[A-Za-z-]+)\s(\d+)$/, '$1 ($2)')
    .trim();
}

type Segment = {kind: Tone; text: string};

/**
 * A translation's reading part, and its notes: the narration after the last
 * words to say (glossaries, a hadith's virtue, "three times"). A translation
 * that is all narration is all reading.
 */
function splitTranslation(translation: string): {
  body: Segment[];
  notes: string[];
} {
  const segments: Segment[] = segmentAdhkarTranslation(translation).map(
    segment =>
      segment.kind === 'reference' && /^Soorah\b/i.test(segment.text)
        ? {kind: 'heading', text: surahHeading(segment.text)}
        : segment,
  );
  let end = segments.length;
  while (end > 0 && segments[end - 1].kind === 'narration') end -= 1;
  if (end === 0) return {body: segments, notes: []};
  return {
    body: segments.slice(0, end),
    notes: segments
      .slice(end)
      .map(segment => segment.text)
      .filter(text => !COUNT_ONLY.test(text.trim())),
  };
}

/**
 * Whether a whole text sits inside one pair of parentheses, as some
 * narrations do ("(When retiring to his bed every night, ...)"): that outer
 * pair says nothing about where a page may turn.
 */
export function wrappedInParens(text: string): boolean {
  const t = text.trim().replace(/[.]$/, '');
  if (!t.startsWith('(') || !t.endsWith(')')) return false;
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') depth += 1;
    else if (t[i] === ')') depth -= 1;
    if (depth === 0 && i < t.length - 1) return false;
  }
  return depth === 0;
}

function translationTokens(segments: readonly Segment[]): Token[] {
  // Never turn inside a parenthesis, e.g. "(Al-Ikhlas, Al-Falaq, An-Nas)",
  // except the one wrapping a whole segment.
  let depth = 0;
  let floor = 0;
  const strength = (word: string): number => {
    depth = Math.max(
      0,
      depth +
        (word.match(/\(/g)?.length ?? 0) -
        (word.match(/\)/g)?.length ?? 0),
    );
    if (depth > floor) return -1;
    if (/[.!?]["'”’)\]]*$/.test(word)) return 2;
    if (/[,;:]["'”’)\]]*$/.test(word)) return 1;
    return 0;
  };
  const tokens = segments.flatMap(segment => {
    depth = 0;
    floor = wrappedInParens(segment.text) ? 1 : 0;
    return words(segment.kind, segment.text, w => w.length + 1, strength);
  });
  // A long narration often runs as one sentence of steps ("... recite the
  // last three chapters of the Quran and then wipe over his body"): the
  // word before "then" or "and then" is as good a turn as a comma.
  tokens.forEach((token, i) => {
    const next = tokens[i + 1]?.text.toLowerCase();
    const after = tokens[i + 2]?.text.toLowerCase();
    if (token.brk < 0) return;
    if (next === 'then' || (next === 'and' && after === 'then')) {
      token.brk = Math.max(token.brk, 1);
    }
  });
  return tokens;
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
 * A run's text as it joins the flowing block: after a space, except that a
 * surah heading stands on a line of its own.
 */
export function runText(runs: readonly Run[], i: number): string {
  const run = runs[i];
  if (i === 0) return run.text;
  const breaks = run.tone === 'heading' || runs[i - 1].tone === 'heading';
  return `${breaks ? '\n' : ' '}${run.text}`;
}

/** Characters in a page's runs, for sizing its type. */
export function runsLength(runs: readonly Run[]): number {
  return runs.reduce((n, r) => n + r.text.length, 0);
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
  /** The instruction's explanation (see instructionNote), shown as notes. */
  note?: string;
};

/**
 * How many pages a dhikr's reading takes: as many as its Arabic needs, so a
 * dhikr whose Arabic fits one page is never split for its translation. A
 * long one also takes a page for each full page of translation, never so
 * many that a page holds only a word or two of Arabic.
 */
export function pageCount(
  arabicLetters: number,
  translationChars: number,
): number {
  const arabicPages = Math.ceil(arabicLetters / ARABIC_PAGE_LETTERS);
  if (arabicPages <= 1) return 1;
  const wanted = Math.max(
    arabicPages,
    Math.ceil(translationChars / TRANSLATION_PAGE_CHARS),
  );
  return Math.max(
    1,
    Math.min(wanted, Math.floor(arabicLetters / MIN_PAGE_LETTERS)),
  );
}

/**
 * The pages of a dhikr: one for most, more for long hadith and Quran. Pages
 * turn at a sentence or surah end where one is near, the Arabic first; the
 * translation then turns at its sentence nearest the same point, so both
 * languages on a page say the same part. Notes go under the last page, or on
 * a page of their own after it when they would crowd it.
 */
export function dhikrPages(
  arabic: string,
  translation: string,
  options: PageOptions = {},
): DhikrPage[] {
  const ar = arabicTokens(arabic);
  const {body, notes: translatorNotes} = splitTranslation(translation);
  const en = translationTokens(body);
  const notes = [...translatorNotes, options.note ?? '']
    .map(note => note.trim())
    .filter(Boolean)
    .join(' ');
  const arTotal = ar.reduce((n, t) => n + t.weight, 0);
  const enTotal = en.reduce((n, t) => n + t.weight, 0);
  const count = Math.max(1, Math.min(pageCount(arTotal, enTotal), ar.length));
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
  const pages: DhikrPage[] = cut(ar, arBreaks).map((tokens, i) => ({
    arabic: toRuns(tokens.map(shown)),
    translation: toRuns(enPages[i] ?? []),
    notes: '',
    arabicLength: tokens.reduce((n, t) => n + t.weight, 0),
  }));
  if (!notes) return pages;
  const last = pages[pages.length - 1];
  const load =
    last.arabicLength / ARABIC_PAGE_LETTERS +
    (runsLength(last.translation) + notes.length) / TRANSLATION_PAGE_CHARS;
  if (notes.length <= SHORT_NOTES_CHARS || load <= NOTES_PAGE_LOAD) {
    last.notes = notes;
  } else pages.push({arabic: [], translation: [], notes, arabicLength: 0});
  return pages;
}

/**
 * The page a recitation has reached, `progress` (0 to 1) of the way
 * through: the reading pages share the clip by their Arabic letters. A page
 * of notes alone is never reached; it stays for OK to turn to.
 */
export function pageAtProgress(
  pages: readonly DhikrPage[],
  progress: number,
): number {
  const total = pages.reduce((n, p) => n + p.arabicLength, 0);
  if (total <= 0) return 0;
  let reached = 0;
  let last = 0;
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].arabicLength <= 0) continue;
    if (progress * total < reached) break;
    last = i;
    reached += pages[i].arabicLength;
  }
  return last;
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
 * Notes type size (design px): a touch under the translation beside them,
 * as large as a translation on a page of their own.
 */
export function notesFontSize(chars: number, alone: boolean): number {
  if (alone) return chars <= 400 ? 28 : 25;
  return chars <= 160 ? 25 : 23;
}

/** An instruction line longer than this is an explanation, not a source. */
const SOURCE_LINE_CHARS = 90;
// A line that already says how many times ("ten times or once if lazy").
const SAYS_COUNT = /\b(\d*times?|once|twice|thrice)\b/i;

/**
 * An instruction line as the reader shows it: the data's "[Soorah ...]"
 * labels and bracketed glosses unwrapped, "Soorah" as "Surah", no stray
 * space before a verse number ("Al-Baqarah :255"), and no "Then" left over
 * from the phone's list, where it followed the dhikr before.
 */
function cleanInstruction(line: string): string {
  return line
    .replace(/\[(Soorah[^\]]*)\]/gi, (_, label: string) => surahHeading(label))
    .replace(/\[([^\]]*)\]/g, '($1)')
    .replace(/\bSoorah\b/gi, 'Surah')
    .replace(/\s+:(\d)/g, ' $1')
    .replace(/(\d)(times?)\b/gi, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^then\s+/i, '')
    .replace(/^(?!i\.e\.|e\.g\.)\p{Ll}/u, c => c.toUpperCase());
}

function instructionLines(instruction: string): string[] {
  return instruction.split('\n').map(cleanInstruction).filter(Boolean);
}

/**
 * The line under the translation: how many times to say it, then the
 * instruction's short lines (its source, a reference), e.g. "Recite 100
 * times · Muslim". Long explanations are notes (instructionNote). A line
 * that already gives the count stands for it ("Ten times or once if lazy"),
 * and one that names what to recite takes it ("Recite Surah al-Ikhlaas
 * (112), ... · 3 times").
 */
export function sourceLine(repeatCount: number, instruction: string): string {
  const lines = instructionLines(instruction).filter(
    line => line.length <= SOURCE_LINE_CHARS,
  );
  if (repeatCount <= 1 || lines.some(line => SAYS_COUNT.test(line))) {
    return lines.join(' · ');
  }
  const recites = /^recite\b/i.test(lines[0] ?? '');
  const parts = recites
    ? [...lines, `${repeatCount} times`]
    : [`Recite ${repeatCount} times`, ...lines];
  return parts.join(' · ');
}

/** The instruction's long lines: an explanation, a Name's meaning. */
export function instructionNote(instruction: string): string {
  return instructionLines(instruction)
    .filter(line => line.length > SOURCE_LINE_CHARS)
    .join(' ');
}
