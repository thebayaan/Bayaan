// CTC scoring of a word in its context, ported from
// scripts/recitation-bench/judge/ctc.mjs, with wordSpan from
// scripts/second-look/rule.mjs.
//
// Scores are best-path log-likelihoods relative to each frame's best token, so
// they are at most 0 and 0 means the path is what the model would say anyway.
// A candidate is scored inside its ayah's text:
//
//   [free frames] left context ▁ CANDIDATE ▁ right context [free frames]
//
// Every frame between the ends of the text must be explained by it, so an extra
// or missing letter cannot hide. A frame outside the text costs nothing. The
// slice may cut the text: the path may start inside the left context at the first
// frame and end inside the right context at the last one. At an edge of the text
// (or when the reader stopped), the word may instead be bordered by blanks only,
// or by a ▁ with free frames beyond it (the next ayah, or a restart). An ayah's
// first word has no left context to place it, so it must also come early in the
// slice (firstWithin): the slice starts near the ayah's start.

export const BLANK = 0;
export const WORD = 30;
const VOCAB = 31;
const NONE = -1e30;

/** Log-probabilities minus each frame's best, row by row: [frames, 31]. */
export function relativeTo(logp: Float32Array, frames: number): Float32Array {
  const rel = new Float32Array(frames * VOCAB);
  for (let t = 0; t < frames; t++) {
    const row = t * VOCAB;
    let best = -Infinity;
    for (let k = 0; k < VOCAB; k++) {
      if (logp[row + k] > best) best = logp[row + k];
    }
    for (let k = 0; k < VOCAB; k++) rel[row + k] = logp[row + k] - best;
  }
  return rel;
}

/**
 * One stretch of tokens through time. exit[i] is the best score with frames
 * 0..i-1 consumed and the stretch finished at frame i-1.
 * entry[i] is what the stretch may start from at frame i; null means free frames.
 * cutStart lets the path start on any token at frame 0, and counts a stretch
 * that lies wholly before the slice as finished at the start.
 * step and first read the frames forwards (1, 0) or backwards (-1, frames - 1).
 */
function stretch(
  rel: Float32Array,
  frames: number,
  tokens: readonly number[],
  entry: Float64Array | null,
  cutStart: boolean,
  step: number,
  first: number,
): Float64Array {
  const m = tokens.length;
  const exit = new Float64Array(frames + 1).fill(NONE);
  const tok = new Float64Array(m).fill(NONE);
  const blk = new Float64Array(m).fill(NONE);
  const newTok = new Float64Array(m);
  const newBlk = new Float64Array(m);
  exit[0] = cutStart ? 0 : NONE;
  for (let i = 0; i < frames; i++) {
    const row = (first + step * i) * VOCAB;
    const blank = rel[row + BLANK];
    const from = entry ? entry[i] : 0;
    for (let j = 0; j < m; j++) {
      let prev = tok[j];
      if (j === 0) {
        if (from > prev) prev = from;
      } else {
        if (blk[j - 1] > prev) prev = blk[j - 1];
        if (tokens[j] !== tokens[j - 1] && tok[j - 1] > prev) prev = tok[j - 1];
      }
      if (cutStart && i === 0 && prev < 0) prev = 0;
      newTok[j] = prev <= NONE ? NONE : prev + rel[row + tokens[j]];
      let stay = tok[j] > blk[j] ? tok[j] : blk[j];
      // The slice may also start in the blank after a token.
      if (cutStart && i === 0 && stay < 0) stay = 0;
      newBlk[j] = stay <= NONE ? NONE : stay + blank;
    }
    tok.set(newTok);
    blk.set(newBlk);
    exit[i + 1] = tok[m - 1] > blk[m - 1] ? tok[m - 1] : blk[m - 1];
  }
  return exit;
}

/** Sum of blanks over frames first, first+step, ... for i frames, for all i. */
function blanksFromEdge(
  rel: Float32Array,
  frames: number,
  step: number,
  first: number,
): Float64Array {
  const out = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) {
    out[i + 1] = out[i] + rel[(first + step * i) * VOCAB + BLANK];
  }
  return out;
}

/** One slice prepared for one place in the text. */
export interface PreparedSlice {
  rel: Float32Array;
  frames: number;
  exitL: Float64Array;
  exitR: Float64Array;
  /** The same as exitR for a word with nothing in it: no second ▁ on the right. */
  exitRest: Float64Array;
}

/**
 * Prepares one slice for one place in the text.
 * @param rel - relativeTo's output
 * @param left - Tokens of the left context, each word followed by ▁ (empty at
 *   the start of the text)
 * @param right - Tokens of the right context, each word preceded by ▁ (empty at
 *   the end of the text)
 * @param firstWithin - Frames from the slice's start within which an ayah's first
 *   word must begin
 */
export function prepare(
  rel: Float32Array,
  frames: number,
  left: readonly number[],
  right: readonly number[],
  firstWithin?: number,
): PreparedSlice {
  // Left: free frames, then the text, or the text cut by the slice's start.
  const leftTokens = left.length ? left : [WORD];
  const exitL = stretch(rel, frames, leftTokens, null, true, 1, 0);
  if (!left.length && firstWithin !== undefined) {
    for (let i = firstWithin + 1; i <= frames; i++) exitL[i] = NONE;
  }
  const blanksL = blanksFromEdge(rel, frames, 1, 0);
  for (let i = 0; i <= frames; i++) {
    if (blanksL[i] > exitL[i]) exitL[i] = blanksL[i];
  }
  // Right: the same, read backwards from the slice's end.
  const rightTokens = right.length ? right : [WORD];
  const rev = [...rightTokens].reverse();
  const exitR = stretch(rel, frames, rev, null, true, -1, frames - 1);
  const blanksR = blanksFromEdge(rel, frames, -1, frames - 1);
  for (let i = 0; i <= frames; i++) {
    if (blanksR[i] > exitR[i]) exitR[i] = blanksR[i];
  }
  // The same for a word with nothing in it. At the end of the text, only blanks
  // may follow: a ▁ with free frames would hide any word.
  let exitRest = blanksR;
  if (right.length) {
    exitRest = stretch(
      rel,
      frames,
      rev.slice(0, -1),
      null,
      true,
      -1,
      frames - 1,
    );
    for (let i = 0; i <= frames; i++) {
      if (blanksR[i] > exitRest[i]) exitRest[i] = blanksR[i];
    }
  }
  return {rel, frames, exitL, exitR, exitRest};
}

/** Best score of this candidate here: at most 0. */
export function scoreWord(p: PreparedSlice, tokens: readonly number[]): number {
  const {rel, frames, exitL, exitR} = p;
  const exit = stretch(rel, frames, tokens, exitL, false, 1, 0);
  let best = NONE;
  for (let i = 1; i <= frames; i++) {
    const v = exit[i] + exitR[frames - i];
    if (v > best) best = v;
  }
  return best;
}

/**
 * Best score with no word here at all (the reader went straight on). Needs the
 * right context to mean anything: with free frames right after the left context,
 * any word could hide there.
 */
export function scoreNothing(p: PreparedSlice): number {
  const {frames, exitL, exitRest} = p;
  let best = NONE;
  for (let i = 0; i <= frames; i++) {
    const v = exitL[i] + exitRest[frames - i];
    if (v > best) best = v;
  }
  return best;
}

/** Where a word sits on its best path. */
export interface WordSpan {
  score: number;
  /** Its first letter's first frame. */
  startFrame: number;
  /** The last frame its stretch holds, with the blanks after its last letter. */
  endFrame: number;
}

/** The best path through the word in this prepared context: the frames it holds. */
export function wordSpan(
  p: PreparedSlice,
  tokens: readonly number[],
): WordSpan | null {
  const {rel, frames, exitL, exitR} = p;
  const m = tokens.length;
  const S = 2 * m;
  const back = new Int16Array(frames * S).fill(-2);
  let tok = new Float64Array(m).fill(NONE);
  let blk = new Float64Array(m).fill(NONE);
  let nextTok = new Float64Array(m);
  let nextBlk = new Float64Array(m);
  let best = NONE;
  let bestFrame = -1;
  let bestState = -1;
  for (let i = 0; i < frames; i++) {
    const row = i * VOCAB;
    const blank = rel[row + BLANK];
    const from = exitL[i];
    for (let j = 0; j < m; j++) {
      let prev = tok[j];
      let cameFrom = 2 * j;
      if (j === 0) {
        if (from > prev) {
          prev = from;
          cameFrom = -1;
        }
      } else {
        if (blk[j - 1] > prev) {
          prev = blk[j - 1];
          cameFrom = 2 * (j - 1) + 1;
        }
        if (tokens[j] !== tokens[j - 1] && tok[j - 1] > prev) {
          prev = tok[j - 1];
          cameFrom = 2 * (j - 1);
        }
      }
      nextTok[j] = prev <= NONE ? NONE : prev + rel[row + tokens[j]];
      back[i * S + 2 * j] = cameFrom;
      let stay = tok[j];
      let stayFrom = 2 * j;
      if (blk[j] > stay) {
        stay = blk[j];
        stayFrom = 2 * j + 1;
      }
      nextBlk[j] = stay <= NONE ? NONE : stay + blank;
      back[i * S + 2 * j + 1] = stayFrom;
    }
    [tok, nextTok] = [nextTok, tok];
    [blk, nextBlk] = [nextBlk, blk];
    const after = exitR[frames - i - 1];
    if (tok[m - 1] + after > best) {
      best = tok[m - 1] + after;
      bestFrame = i;
      bestState = 2 * (m - 1);
    }
    if (blk[m - 1] + after > best) {
      best = blk[m - 1] + after;
      bestFrame = i;
      bestState = 2 * (m - 1) + 1;
    }
  }
  if (bestFrame < 0) return null;
  let start = -1;
  let state = bestState;
  for (let i = bestFrame; i >= 0 && state >= 0; i--) {
    if (state === 0) start = i;
    state = back[i * S + state];
  }
  if (start < 0) return null;
  return {score: best, startFrame: start, endFrame: bestFrame};
}
