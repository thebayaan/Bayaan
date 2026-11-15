/* eslint-env es2020 */
// CTC scoring of a word in its context, in plain JavaScript with no Node or
// browser API, so it can run under React Native.
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
// slice (`firstWithin`): the slice starts near the ayah's start.

export const BLANK = 0;
export const WORD = 30;
const VOCAB = 31;
const NONE = -1e30;

/** Log-probabilities minus each frame's best, row by row: [frames, 31]. */
export function relativeTo(logp, frames) {
  const rel = new Float32Array(frames * VOCAB);
  for (let t = 0; t < frames; t++) {
    const row = t * VOCAB;
    let best = -Infinity;
    for (let k = 0; k < VOCAB; k++) if (logp[row + k] > best) best = logp[row + k];
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
function stretch(rel, frames, tokens, entry, cutStart, step, first) {
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
function blanksFromEdge(rel, frames, step, first) {
  const out = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) {
    out[i + 1] = out[i] + rel[(first + step * i) * VOCAB + BLANK];
  }
  return out;
}

/**
 * Prepares one slice for one place in the text.
 * @param {Float32Array} rel relativeTo's output
 * @param {number} frames
 * @param {number[]} left tokens of the left context, each word followed by ▁
 *   (empty at the start of the text)
 * @param {number[]} right tokens of the right context, each word preceded by ▁
 *   (empty at the end of the text)
 * @param {{firstWithin?: number}} [opts] frames from the slice's start within which
 *   an ayah's first word must begin
 */
export function prepare(rel, frames, left, right, opts = {}) {
  // Left: free frames, then the text, or the text cut by the slice's start.
  const leftTokens = left.length ? left : [WORD];
  const exitL = stretch(rel, frames, leftTokens, null, true, 1, 0);
  if (!left.length && opts.firstWithin !== undefined) {
    for (let i = opts.firstWithin + 1; i <= frames; i++) exitL[i] = NONE;
  }
  const blanksL = blanksFromEdge(rel, frames, 1, 0);
  for (let i = 0; i <= frames; i++) if (blanksL[i] > exitL[i]) exitL[i] = blanksL[i];
  // Right: the same, read backwards from the slice's end.
  const rightTokens = right.length ? right : [WORD];
  const rev = [...rightTokens].reverse();
  const exitR = stretch(rel, frames, rev, null, true, -1, frames - 1);
  const blanksR = blanksFromEdge(rel, frames, -1, frames - 1);
  for (let i = 0; i <= frames; i++) if (blanksR[i] > exitR[i]) exitR[i] = blanksR[i];
  // The same for a word with nothing in it: no second ▁ on the right. At the end of
  // the text, only blanks may follow: a ▁ with free frames would hide any word.
  const restRev = right.length ? rev.slice(0, -1) : null;
  let exitRest = blanksR;
  if (restRev) {
    exitRest = stretch(rel, frames, restRev, null, true, -1, frames - 1);
    for (let i = 0; i <= frames; i++) if (blanksR[i] > exitRest[i]) exitRest[i] = blanksR[i];
  }
  return {rel, frames, exitL, exitR, exitRest};
}

/** Best score of this candidate here: at most 0. */
export function scoreWord(p, tokens) {
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
export function scoreNothing(p) {
  const {frames, exitL, exitRest} = p;
  let best = NONE;
  for (let i = 0; i <= frames; i++) {
    const v = exitL[i] + exitRest[frames - i];
    if (v > best) best = v;
  }
  return best;
}

/**
 * Viterbi alignment of a whole text over all frames, for word times.
 * @param {number[][]} words token lists, without separators
 * @returns {{start: number, end: number}[]} each word's first and last frame,
 *   frames counted from 0, and `score` on the array
 */
export function alignWords(rel, frames, words) {
  const tokens = [];
  const wordOf = [];
  words.forEach((w, i) => {
    if (i > 0) {
      tokens.push(WORD);
      wordOf.push(-1);
    }
    for (const t of w) {
      tokens.push(t);
      wordOf.push(i);
    }
  });
  const m = tokens.length;
  // States: 2j token j, 2j+1 blank after token j, 2m free before the text.
  const S = 2 * m + 1;
  const back = new Int32Array(frames * S);
  let cur = new Float64Array(S).fill(NONE);
  let nxt = new Float64Array(S);
  cur[2 * m] = 0;
  for (let t = 0; t < frames; t++) {
    const row = t * VOCAB;
    const blank = rel[row + BLANK];
    nxt.fill(NONE);
    // Free frames before the text cost nothing, and the text may end early.
    nxt[2 * m] = cur[2 * m];
    back[t * S + 2 * m] = 2 * m;
    for (let j = 0; j < m; j++) {
      const tk = 2 * j;
      const bl = tk + 1;
      let best = cur[tk];
      let from = tk;
      if (j === 0) {
        if (cur[2 * m] > best) {
          best = cur[2 * m];
          from = 2 * m;
        }
      } else {
        if (cur[2 * j - 1] > best) {
          best = cur[2 * j - 1];
          from = 2 * j - 1;
        }
        if (tokens[j] !== tokens[j - 1] && cur[2 * j - 2] > best) {
          best = cur[2 * j - 2];
          from = 2 * j - 2;
        }
      }
      if (best > NONE) {
        nxt[tk] = best + rel[row + tokens[j]];
        back[t * S + tk] = from;
      }
      let stay = cur[tk];
      let sfrom = tk;
      if (cur[bl] > stay) {
        stay = cur[bl];
        sfrom = bl;
      }
      if (stay > NONE) {
        nxt[bl] = stay + blank;
        back[t * S + bl] = sfrom;
      }
    }
    const swap = cur;
    cur = nxt;
    nxt = swap;
  }
  // The end: the last token or the blank after it; free frames after it are
  // handled by the blank state, which costs little where the model is silent.
  let state = cur[2 * m - 2] > cur[2 * m - 1] ? 2 * m - 2 : 2 * m - 1;
  const score = cur[state];
  const out = words.map(() => ({start: -1, end: -1}));
  for (let t = frames - 1; t >= 0; t--) {
    if (state < 2 * m && state % 2 === 0) {
      const w = wordOf[state / 2];
      if (w >= 0) {
        if (out[w].end < 0) out[w].end = t;
        out[w].start = t;
      }
    }
    state = back[t * S + state];
  }
  out.score = score;
  return out;
}
