// Two more questions the second model can answer about a stretch of recitation,
// for the marks Tilawa 1.0 raises that the judge's one-word question cannot read.
// Both compare two readings of the same slice with the CTC scoring in
// secondLook/ctc (best paths, each frame relative to its best token, so 0 means
// the path is what the model would say anyway):
//
// - An added word: the two written words one after the other, against the same
//   two words with a run of extra letters between them. A big gain means something
//   was said there. A repeat of the words just read is not an added word, so the
//   run is also read as such a repeat: if a repeat explains it about as well, it
//   was a repeat.
// - A skipped passage: the last words read, then the words that should have come
//   next, against the last words read, then the words the reader went on with.
//
// Words go in as letters (ayahLetters), and hypotheses stay numbers inside the
// computation: never shown, logged as text or stored.
import {
  BLANK,
  prepare,
  relativeTo,
  scoreNothing,
  WORD,
} from '../secondLook/ctc';
import {tokensOf} from '../secondLook/judge';

const VOCAB = 31;
const NONE = -1e30;

function leftTokens(words: readonly string[]): number[] {
  const out: number[] = [];
  for (const w of words) out.push(...tokensOf(w), WORD);
  return out;
}

function rightTokens(words: readonly string[]): number[] {
  const out: number[] = [];
  for (const w of words) out.push(WORD, ...tokensOf(w));
  return out;
}

/** Best score of `left` read straight on into `right`. */
function straightOn(
  rel: Float32Array,
  frames: number,
  left: readonly string[],
  right: readonly string[],
): number {
  return scoreNothing(
    prepare(rel, frames, leftTokens(left), rightTokens(right)),
  );
}

export interface InsertionScore {
  /** Extra letters between `left` and `right`, against none: higher means more was said. */
  gain: number;
  /**
   * The best repeat of the last words of `left` in that place, against the extra
   * letters: about 0 or above when the extra run was a repeat.
   */
  repeat: number;
}

/**
 * @param left - The words before the place, as letters (one or two)
 * @param right - The words after it
 */
export function insertionScore(
  logp: Float32Array,
  frames: number,
  left: readonly string[],
  right: readonly string[],
): InsertionScore {
  const rel = relativeTo(logp, frames);
  const p = prepare(rel, frames, leftTokens(left), rightTokens(right));
  const none = scoreNothing(p);
  // left ▁ [blanks, letters and ▁, with at least one letter] ▁ right
  let blanksOnly = NONE;
  let withLetter = NONE;
  let extra = NONE;
  for (let k = 0; k < frames; k++) {
    const row = k * VOCAB;
    const open = Math.max(p.exitL[k], blanksOnly);
    let bestLetter = NONE;
    let bestAny = rel[row + BLANK];
    for (let c = 1; c < VOCAB; c++) {
      const v = rel[row + c];
      if (c !== WORD && v > bestLetter) bestLetter = v;
      if (v > bestAny) bestAny = v;
    }
    const nextLetter = Math.max(
      withLetter <= NONE ? NONE : withLetter + bestAny,
      open <= NONE ? NONE : open + bestLetter,
    );
    blanksOnly = open <= NONE ? NONE : open + rel[row + BLANK];
    withLetter = nextLetter;
    const after = p.exitR[frames - k - 1];
    if (withLetter > NONE && withLetter + after > extra) {
      extra = withLetter + after;
    }
  }
  let repeat = NONE;
  for (let r = 1; r <= left.length; r++) {
    const again = straightOn(rel, frames, left, [...left.slice(-r), ...right]);
    if (again > repeat) repeat = again;
  }
  return {gain: extra - none, repeat: repeat - extra};
}

/**
 * The reader went from `left` straight on to `resumed`, against going on with
 * `said` (the words that should have come next): higher means the words were
 * skipped.
 */
export function skipGain(
  logp: Float32Array,
  frames: number,
  left: readonly string[],
  said: readonly string[],
  resumed: readonly string[],
): number {
  const rel = relativeTo(logp, frames);
  return (
    straightOn(rel, frames, left, resumed) - straightOn(rel, frames, left, said)
  );
}
