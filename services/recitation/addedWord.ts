// The added-word rule: is a run of heard sounds between two words a whole extra
// word? Ported from the bench (scripts/recitation-bench/added/rule.mjs). The engine
// reports the run on the right word's verdict (`gap`); this says whether to mark it.
//
// A run's sounds are not Quran text. They stay inside this computation and are
// never shown, logged or stored. The numbers come from followerConstants.npl.json.
import type {CostTable, QuranCorpus, WordGap} from '@tilawa/core';
import followerConstants from './followerConstants.npl.json';

const P = followerConstants.addedWord;

/** What the engine reports about a run. */
export type WordGapReport = WordGap;

type RuleCorpus = Pick<
  QuranCorpus,
  | 'wordPhonemes'
  | 'wordSurah'
  | 'wordAyah'
  | 'wordInAyah'
  | 'wordCount'
  | 'ayahWordCount'
>;
type RuleTable = Pick<CostTable, 'encode' | 'cost'>;

/** Every word of the corpus, folded: the words a run can be. */
export interface WordVocab {
  exact: Set<string>;
  /** The same without a final short vowel. */
  loose: Set<string>;
}

export interface RuleContext {
  corpus: RuleCorpus;
  table: RuleTable;
  /** Null until buildVocab has finished. */
  vocab: WordVocab | null;
}

const SHORT_VOWELS = new Set(['َ', 'ُ', 'ِ']);
const LONG_VOWELS = new Set(['ا', 'ۥ', 'ۦ', 'ى']);
const NASALS = new Set(['ن', 'م']);
// Marks the model writes that are not sounds of their own.
const SIGNS = new Set(['ڇ', 'ؙ', 'ۣ', 'ٞ', 'ۜ', '۪', 'ـ']);
// Spellings of one sound.
const CANON: Readonly<Record<string, string>> = {
  ۥ: 'و',
  ۦ: 'ي',
  ں: 'ن',
  '۾': 'م',
  ٱ: 'ا',
  ى: 'ي',
  أ: 'ء',
  إ: 'ء',
  آ: 'ء',
  ؤ: 'ء',
  ئ: 'ء',
  ٲ: 'ء',
};

export function collapse(text: string): string {
  let out = '';
  for (const c of text) {
    if (out.length === 0 || out[out.length - 1] !== c) out += c;
  }
  return out;
}

function shape(chars: string) {
  let consonants = 0;
  let vowels = 0;
  for (const c of collapse(chars)) {
    if (SIGNS.has(c)) continue;
    if (SHORT_VOWELS.has(c) || LONG_VOWELS.has(c)) vowels += 1;
    else consonants += 1;
  }
  return {sounds: consonants + vowels, consonants, vowels};
}

/** Sounds of a run, lengthened ones counted once. */
export function soundCount(chars: string): number {
  return shape(chars).sounds;
}

/** A run that can be a word: a consonant and a vowel plus one more sound. */
export function wordShaped(chars: string): boolean {
  const s = shape(chars);
  return s.sounds >= P.minSounds && s.consonants >= 1 && s.vowels >= 1;
}

/** Sounds with spellings of one sound folded and lengths counted once. */
export function fold(text: string): string {
  let out = '';
  for (const c0 of text) {
    if (SIGNS.has(c0)) continue;
    const c = CANON[c0] ?? c0;
    if (out.length === 0 || out[out.length - 1] !== c) out += c;
  }
  return out;
}

function dropFinalVowel(folded: string): string {
  return SHORT_VOWELS.has(folded[folded.length - 1])
    ? folded.slice(0, -1)
    : folded;
}

/** Words folded per step. A plain interpreter takes about 6 ms for this many. */
const VOCAB_STEP_WORDS = 1000;

function nextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Builds the vocabulary in small steps, so the JS thread stays free: all at once
 * it holds that thread for about 0.45 s in a plain interpreter on a busy Mac.
 */
export async function buildVocab(
  corpus: Pick<RuleCorpus, 'wordCount' | 'wordPhonemes'>,
  pause: () => Promise<void> = nextTick,
  step: number = VOCAB_STEP_WORDS,
): Promise<WordVocab> {
  const exact = new Set<string>();
  const loose = new Set<string>();
  for (let g = 0; g < corpus.wordCount; g++) {
    const folded = fold(corpus.wordPhonemes(g));
    exact.add(folded);
    loose.add(dropFinalVowel(folded));
    if (g % step === step - 1) await pause();
  }
  return {exact, loose};
}

/**
 * The run is one word of the Quran. A long word may differ in its final vowel, as
 * at a stop; short ones must match whole, or any fragment would pass.
 */
function isRealWord(chars: string, vocab: WordVocab): boolean {
  const folded = fold(chars);
  if (vocab.exact.has(folded)) return true;
  return (
    folded.length >= P.looseFrom && vocab.loose.has(dropFinalVowel(folded))
  );
}

/**
 * The same, allowing for the edges a run can lose or gain: its first consonant
 * merged with the same consonant ending the left word (`prev`), so the run starts
 * on a vowel; or a nasal tail of the left word left in front of it.
 */
function isWordInRun(chars: string, prev: string, vocab: WordVocab): boolean {
  if (isRealWord(chars, vocab)) return true;
  const folded = fold(chars);
  if (SHORT_VOWELS.has(folded[0]) && prev && isRealWord(prev + chars, vocab)) {
    return true;
  }
  return (
    folded.length >= P.nasalFrom &&
    NASALS.has(folded[0]) &&
    !SHORT_VOWELS.has(folded[1]) &&
    isRealWord(folded.slice(1), vocab)
  );
}

/**
 * Edit cost of parsing `gap` as (a prefix of `right`) then (a slice of `left`
 * starting at a word start, ending anywhere). That is what a reader going back
 * leaves: they read on past the word, stopped, went back to a word start, and read
 * up to where they were. `left` holds words, nearest last.
 */
function restartCost(
  gap: string,
  left: readonly string[],
  right: readonly string[],
  table: RuleTable,
): number {
  const g = table.encode(gap);
  const R = table.encode(right.join(''));
  const L = table.encode(left.join(''));
  const isStart = new Uint8Array(L.length + 1);
  let at = 0;
  for (const w of left) {
    isStart[at] = 1;
    at += w.length;
  }
  let pr = new Float32Array(R.length + 1);
  let pl = new Float32Array(L.length + 1);
  for (let j = 1; j <= R.length; j++) pr[j] = pr[j - 1] + 1;
  // Jumping to any word start of the left text costs nothing, from anywhere.
  for (let j = 0; j <= L.length; j++) pl[j] = isStart[j] ? 0 : Infinity;
  for (let j = 1; j <= L.length; j++) {
    if (pl[j - 1] + 1 < pl[j]) pl[j] = pl[j - 1] + 1;
  }
  for (let i = 1; i <= g.length; i++) {
    const nr = new Float32Array(R.length + 1);
    const nl = new Float32Array(L.length + 1);
    nr[0] = pr[0] + 1;
    for (let j = 1; j <= R.length; j++) {
      nr[j] = Math.min(
        pr[j - 1] + table.cost(g[i - 1], R[j - 1]),
        pr[j] + 1,
        nr[j - 1] + 1,
      );
    }
    let minR = Infinity;
    for (let j = 0; j <= R.length; j++) if (nr[j] < minR) minR = nr[j];
    nl[0] = Math.min(pl[0] + 1, isStart[0] ? minR : Infinity);
    for (let j = 1; j <= L.length; j++) {
      let x = Math.min(
        pl[j - 1] + table.cost(g[i - 1], L[j - 1]),
        pl[j] + 1,
        nl[j - 1] + 1,
      );
      if (isStart[j] && minR < x) x = minR;
      nl[j] = x;
    }
    pr = nr;
    pl = nl;
  }
  let best = Infinity;
  for (let j = 0; j <= R.length; j++) if (pr[j] < best) best = pr[j];
  for (let j = 0; j <= L.length; j++) if (pl[j] < best) best = pl[j];
  return best;
}

/**
 * Edit cost of `gap` against a stretch of `text` that ends exactly at its end,
 * starting anywhere: the tail of a word said again.
 */
function echoCost(gap: string, text: string, table: RuleTable): number {
  const g = table.encode([...gap].reverse().join(''));
  const t = table.encode([...text].reverse().join(''));
  let prev = new Float32Array(t.length + 1);
  for (let j = 1; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= g.length; i++) {
    const cur = new Float32Array(t.length + 1);
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(
        prev[j - 1] + table.cost(g[i - 1], t[j - 1]),
        prev[j] + 1,
        cur[j - 1] + 1,
      );
    }
    prev = cur;
  }
  let best = Infinity;
  for (let j = 0; j <= t.length; j++) if (prev[j] < best) best = prev[j];
  return best;
}

/** The most edit cost a repeat of n sounds may carry. */
function tolerance(n: number): number {
  if (n <= P.shortRun) return P.tolShort;
  if (n <= P.midRun) return P.tolMid;
  return P.tolLong * n;
}

/**
 * Lowest cost of `gap` against a stretch of the words that starts at a word start.
 * `wholeWords`: the stretch must also end at a word's end.
 */
function sliceCost(
  gap: string,
  words: readonly string[],
  table: RuleTable,
  wholeWords = false,
): number {
  const g = table.encode(gap);
  const t = table.encode(words.join(''));
  const isStart = new Uint8Array(t.length + 1);
  const isEnd = new Uint8Array(t.length + 1);
  let at = 0;
  for (const w of words) {
    isStart[at] = 1;
    at += w.length;
    isEnd[at] = 1;
  }
  let prev = new Float32Array(t.length + 1);
  for (let j = 1; j <= t.length; j++) {
    prev[j] = isStart[j] ? 0 : prev[j - 1] + 1;
  }
  for (let i = 1; i <= g.length; i++) {
    const cur = new Float32Array(t.length + 1);
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(
        prev[j - 1] + table.cost(g[i - 1], t[j - 1]),
        prev[j] + 1,
        cur[j - 1] + 1,
      );
    }
    prev = cur;
  }
  let best = Infinity;
  for (let j = 0; j <= t.length; j++) {
    if ((!wholeWords || isEnd[j]) && prev[j] < best) best = prev[j];
  }
  return best;
}

/** What nearby text explains a run, if anything. */
function explainedBy(
  chars: string,
  leftWord: number,
  rightWord: number,
  {corpus, table}: RuleContext,
): 'repeat' | 'echo' | 'restart' | null {
  const gap = collapse(chars);
  const n = gap.length;
  const tol = tolerance(n);
  const short = n <= P.shortRun;
  const back = short ? P.backShort : P.back;
  const ahead = short ? P.aheadShort : P.ahead;
  const surah = corpus.wordSurah[leftWord];
  const left: string[] = [];
  for (
    let k = leftWord;
    k >= 0 && leftWord - k < back && corpus.wordSurah[k] === surah;
    k--
  ) {
    left.unshift(collapse(corpus.wordPhonemes(k)));
  }
  const right: string[] = [];
  for (
    let k = rightWord;
    k < corpus.wordCount &&
    k - rightWord < ahead &&
    corpus.wordSurah[k] === surah;
    k++
  ) {
    right.push(collapse(corpus.wordPhonemes(k)));
  }
  const nearest = left[left.length - 1] ?? '';
  // The next words begun early: a stutter, or read on before going back.
  if (sliceCost(gap, [right.join('')], table) <= tol) return 'repeat';
  // Whole words said again, or the current word half said again.
  if (sliceCost(gap, left, table, short) <= tol) return 'repeat';
  if (sliceCost(gap, [nearest], table) <= tol) return 'repeat';
  // The tail of what came just before, said again.
  if (echoCost(gap, short ? nearest : left.join(''), table) <= tol) {
    return 'echo';
  }
  // Read on, stopped, went back.
  if (n >= P.twoPartsFrom && restartCost(gap, left, right, table) <= tol) {
    return 'restart';
  }
  return null;
}

/** Lowest cost of a run against the start of a phrase readers add. */
function phraseCost(chars: string, table: RuleTable): number {
  let best = Infinity;
  const g = table.encode(collapse(chars));
  for (const phrase of P.notTextPhrases) {
    const p = table.encode(collapse(phrase));
    let prev = new Float32Array(p.length + 1);
    for (let j = 1; j <= p.length; j++) prev[j] = j;
    for (let i = 1; i <= g.length; i++) {
      const cur = new Float32Array(p.length + 1);
      cur[0] = i;
      for (let j = 1; j <= p.length; j++) {
        cur[j] = Math.min(
          prev[j - 1] + table.cost(g[i - 1], p[j - 1]),
          prev[j] + 1,
          cur[j - 1] + 1,
        );
      }
      prev = cur;
    }
    for (let j = 0; j <= p.length; j++) if (prev[j] < best) best = prev[j];
  }
  return best;
}

/** The rule's limits were set on scores read at three decimals. */
export function atThreeDecimals(x: number): number {
  return +x.toFixed(3);
}

/**
 * Why a run is not an added word, or null if it is one.
 * @param rightWord - The right word's number in the corpus
 */
export function rejectReason(
  gap: WordGapReport,
  rightWord: number,
  context: RuleContext,
): string | null {
  const {corpus, table, vocab} = context;
  if (!vocab) return 'not_ready';
  if (!wordShaped(gap.chars)) return 'shape';
  const endsAyah = (g: number) =>
    corpus.wordInAyah[g] ===
    corpus.ayahWordCount(corpus.wordSurah[g], corpus.wordAyah[g]) - 1;
  if (
    atThreeDecimals(gap.fitL) > (endsAyah(gap.leftWord) ? P.fitLast : P.fit) ||
    atThreeDecimals(gap.fitR) > (endsAyah(rightWord) ? P.fitLast : P.fit)
  ) {
    return 'fit';
  }
  if (!isWordInRun(gap.chars, gap.prev, vocab)) return 'not_a_word';
  if (typeof gap.noGap !== 'number') return 'no_scores';
  if (atThreeDecimals(gap.noGap) > P.noGap) return 'no_evidence';
  const explained = explainedBy(gap.chars, gap.leftWord, rightWord, context);
  if (explained) return explained;
  if (phraseCost(gap.chars, table) <= tolerance(collapse(gap.chars).length)) {
    return 'phrase';
  }
  return null;
}
