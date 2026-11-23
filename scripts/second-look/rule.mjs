/* eslint-env node, es2020 */
// The cancel step's scoring: what stands behind a mark before it turns red. Reads
// log-probabilities and audio it is given; loads no model. Hypotheses here are lists of
// numbers inside the computation, never shown, logged as text or stored.
import fs from 'node:fs';
import {
  relativeTo,
  prepare,
  scoreWord,
} from '../recitation-bench/judge/ctc.mjs';
import {tokensOf} from '../recitation-bench/judge/judge.mjs';

const WORD = 30;
const BLANK = 0;
const VOCAB = 31;
const NONE = -1e30;
const SR = 16000;
const LETTERS = Array.from({length: 29}, (_, i) => i + 1);
const raw = JSON.parse(
  fs.readFileSync(
    new URL('./cancel_constants.npl.json', import.meta.url),
    'utf8',
  ),
);

export const CANCEL = {
  keepFirstPerLetter: raw.keepFirstPerLetter.value,
  keepGap: raw.keepGap.value,
  marginSeconds: raw.marginSeconds.value,
  silenceSeconds: raw.silenceSeconds.value,
};
/** The rule now in the app: a word scoring above this per letter is cancelled. */
export const SHIPPED_FITS_PER_LETTER = -2;
/** And its slice, around the latest bad verdict, and the least audio it will look at. */
export const SHIPPED_SLICE = {before: 4.6, after: 0.9, least: 1};

/** Tokens of the left and right context, as the judge builds them. */
export function contextOf(words, j, leftWords, rightWords) {
  const left = [];
  for (let i = Math.max(0, j - leftWords); i < j; i++)
    left.push(...tokensOf(words[i]), WORD);
  const right = [];
  for (let i = j + 1; i <= Math.min(words.length - 1, j + rightWords); i++)
    right.push(WORD, ...tokensOf(words[i]));
  return {left, right};
}

/** The best path through the word in this prepared context: the frames it holds. */
function alignIn(p, tokens) {
  const {rel, frames, exitL, exitR} = p;
  const m = tokens.length;
  const S = 2 * m;
  const back = new Int16Array(frames * S).fill(-2);
  let tok = new Float64Array(m).fill(NONE);
  let blk = new Float64Array(m).fill(NONE);
  let nTok = new Float64Array(m);
  let nBlk = new Float64Array(m);
  let best = NONE;
  let bestI = -1;
  let bestS = -1;
  for (let i = 0; i < frames; i++) {
    const row = i * VOCAB;
    const blank = rel[row + BLANK];
    const from = exitL[i];
    for (let j = 0; j < m; j++) {
      let prev = tok[j];
      let pf = 2 * j;
      if (j === 0) {
        if (from > prev) {
          prev = from;
          pf = -1;
        }
      } else {
        if (blk[j - 1] > prev) {
          prev = blk[j - 1];
          pf = 2 * (j - 1) + 1;
        }
        if (tokens[j] !== tokens[j - 1] && tok[j - 1] > prev) {
          prev = tok[j - 1];
          pf = 2 * (j - 1);
        }
      }
      nTok[j] = prev <= NONE ? NONE : prev + rel[row + tokens[j]];
      back[i * S + 2 * j] = pf;
      let stay = tok[j];
      let sf = 2 * j;
      if (blk[j] > stay) {
        stay = blk[j];
        sf = 2 * j + 1;
      }
      nBlk[j] = stay <= NONE ? NONE : stay + blank;
      back[i * S + 2 * j + 1] = sf;
    }
    let t = tok;
    tok = nTok;
    nTok = t;
    t = blk;
    blk = nBlk;
    nBlk = t;
    const after = exitR[frames - i - 1];
    if (tok[m - 1] + after > best) {
      best = tok[m - 1] + after;
      bestI = i;
      bestS = 2 * (m - 1);
    }
    if (blk[m - 1] + after > best) {
      best = blk[m - 1] + after;
      bestI = i;
      bestS = 2 * (m - 1) + 1;
    }
  }
  if (bestI < 0) return null;
  let start = -1;
  let s = bestS;
  for (let i = bestI; i >= 0 && s >= 0; i--) {
    if (s % 2 === 0 && s === 0) start = i;
    s = back[i * S + s];
  }
  return {score: best, startFrame: start, exit: bestI};
}

/**
 * The first pass on one slice: the expected word's score in its context, and where the
 * word sits. `endFrame` is the last frame its stretch holds, with the blanks after its
 * last letter.
 * @param {{leftWords: number, rightWords: number, firstWithin?: number}} ctx
 * @returns {{expected: number, perLetter: number, startFrame: number, endFrame: number} | null}
 */
export function firstPass(logp, frames, words, j, ctx) {
  const tokens = tokensOf(words[j]);
  const rel = relativeTo(logp, frames);
  const {left, right} = contextOf(words, j, ctx.leftWords, ctx.rightWords);
  const p = prepare(
    rel,
    frames,
    left,
    right,
    ctx.firstWithin === undefined ? {} : {firstWithin: ctx.firstWithin},
  );
  const expected = scoreWord(p, tokens);
  const a = alignIn(p, tokens);
  if (!a || a.startFrame < 0) return null;
  if (Math.abs(a.score - expected) > 1e-3)
    throw new Error(`alignment mismatch: ${a.score} against ${expected}`);
  return {
    expected,
    perLetter: expected / tokens.length,
    startFrame: a.startFrame,
    endFrame: a.exit,
  };
}

/** Is a padded look worth a model run? */
export function needsPaddedLook(perLetter, letters) {
  return perLetter > CANCEL.keepFirstPerLetter && letters >= 3;
}

/**
 * The word and its margins with digital silence each side, or null when too little is
 * left. `limit` is the last sample heard so far.
 */
export function paddedCut(audio, wordStart, wordEnd, limit) {
  const m = CANCEL.marginSeconds;
  const a = Math.max(0, Math.floor((wordStart - m) * SR));
  const b = Math.min(audio.length, limit, Math.ceil((wordEnd + m) * SR));
  if (b - a < 0.2 * SR) return null;
  const z = Math.round(CANCEL.silenceSeconds * SR);
  const out = new Float32Array(b - a + 2 * z);
  out.set(audio.subarray(a, b), z);
  return out;
}

/**
 * How far the best spelling with one inner letter changed beats the written word, on the
 * padded look: the word alone with free frames round it. Lower means that spelling won
 * by more. Null with no inner letter.
 */
export function innerGap(logp, frames, tokens) {
  if (tokens.length < 3) return null;
  const rel = relativeTo(logp, frames);
  const free = new Float64Array(frames + 1);
  const p = {rel, frames, exitL: free, exitR: free, exitRest: null};
  const expected = scoreWord(p, tokens);
  let best = Infinity;
  for (let i = 1; i < tokens.length - 1; i++) {
    for (const c of LETTERS) {
      if (c === tokens[i]) continue;
      const v = tokens.slice();
      v[i] = c;
      const g = expected - scoreWord(p, v);
      if (g < best) best = g;
    }
  }
  return best;
}

/**
 * The letter-slip rule. `first` is the expected word's score per letter, null when the
 * first pass failed; `gap` is innerGap's answer, null when there was none.
 * Any failure shows the mark.
 */
export function cancelAnswer({
  first,
  gap,
  identified = false,
  skipIdentified = false,
}) {
  if (skipIdentified && identified) return 'keep';
  if (first === null || first === undefined) return 'keep';
  if (first <= CANCEL.keepFirstPerLetter) return 'keep';
  if (gap !== null && gap !== undefined && gap <= CANCEL.keepGap) return 'keep';
  return 'cancel';
}

/** The rule now in the app, for comparison. */
export function shippedAnswer(perLetter) {
  if (perLetter === null || perLetter === undefined) return 'keep';
  return perLetter > SHIPPED_FITS_PER_LETTER ? 'cancel' : 'keep';
}
