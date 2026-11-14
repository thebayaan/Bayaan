/* eslint-env node, es2020 */
// The frozen cancel rules of the test of real slips under voices (LEARNERS.md), as
// plain functions of a slice's model output. No model and no file is read here, and no
// threshold is chosen here: B is the app's first second look, as it stood when this test
// ran, C is the letter-slip rule as it was frozen, D is judge/judge_constants.json and
// judge/engine_constants.npl.json.
import {BLANK, WORD, prepare, relativeTo, scoreWord} from '../judge/ctc.mjs';
import {judgeWord, tokensOf} from '../judge/judge.mjs';

export const SR = 16000;
const VOCAB = 31;
const FRAME = 0.04;
const NONE = -1e30;
const NO_ALTERNATIVES = {mut: [], near: []};

// B: the app's first second look. The app has since moved to scripts/second-look/RULE.md.
export const SLICE_BEFORE_S = 4.6;
export const SLICE_AFTER_S = 0.9;
export const MIN_SLICE_S = 1;
export const FITS_ABOVE_PER_LETTER = -2;
const CHUNK_S = 0.48;

// C: the letter-slip rule.
export const KEEP_AT_OR_BELOW_PER_LETTER = -6;
export const KEEP_GAP_AT_OR_BELOW = -3.34;
const CUT_MARGIN_S = 0.3;
const CUT_PAD_S = 1;
const MIN_CUT_S = 0.2;

const round3 = x => (x === null || x === undefined || !Number.isFinite(x) ? null : +x.toFixed(3));

/** Tokens of the left and right context, as the app's judge builds them. */
export function contextOf(L, j, leftWords = 2, rightWords = 1) {
  const left = [];
  for (let i = Math.max(0, j - leftWords); i < j; i++) left.push(...tokensOf(L[i]), WORD);
  const right = [];
  for (let i = j + 1; i <= Math.min(L.length - 1, j + rightWords); i++) right.push(WORD, ...tokensOf(L[i]));
  return {left, right};
}

/** A context with no text at all: free frames on both sides at no cost. */
export function freeContext(rel, frames) {
  const zeros = new Float64Array(frames + 1);
  return {rel, frames, exitL: zeros, exitR: zeros, exitRest: null};
}

/**
 * The best path through the word in this prepared context, with back-pointers. Its
 * score equals scoreWord's, which the caller asserts.
 * @returns {{score: number, ts: number[], te: number[], exit: number}|null} ts and te:
 *   first and last frame of each letter's token; exit: the last frame of the word's
 *   stretch, with the blanks after its last letter
 */
export function alignIn(p, tokens) {
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
  const ts = new Array(m).fill(-1);
  const te = new Array(m).fill(-1);
  let s = bestS;
  for (let i = bestI; i >= 0 && s >= 0; i--) {
    if (s % 2 === 0) {
      const j = s / 2;
      if (te[j] < 0) te[j] = i;
      ts[j] = i;
    }
    s = back[i * S + s];
  }
  return {score: best, ts, te, exit: bestI};
}

const ALL_LETTERS = Array.from({length: 29}, (_, i) => i + 1);

/**
 * For each inner letter, the spelling with that letter changed that comes closest to
 * the written word: expected minus its score, so negative means the spelling beats the
 * written word. Null for a word with no inner letter.
 */
export function innerSubGap(p, tokens, expected) {
  const m = tokens.length;
  let best = null;
  for (let i = 1; i < m - 1; i++) {
    for (const c of ALL_LETTERS) {
      if (c === tokens[i]) continue;
      const v = tokens.slice();
      v[i] = c;
      const g = expected - scoreWord(p, v);
      if (best === null || g < best) best = g;
    }
  }
  return best;
}

/** The letter-slip experiment scored logs stored at 0.01 nat. Its copy stays exact. */
export function quantised(logp) {
  const out = new Float32Array(logp.length);
  for (let i = 0; i < logp.length; i++) {
    const v = Math.round(logp[i] * 100);
    out[i] = (v < -32000 ? -32000 : v) / 100;
  }
  return out;
}

/** The padded look's gap on one model output, at both precisions. */
function paddedGaps(logp, frames, tokens) {
  const gap = lp => {
    const rel = relativeTo(lp, frames);
    const free = freeContext(rel, frames);
    return round3(innerSubGap(free, tokens, scoreWord(free, tokens)));
  };
  return {gapSub: gap(quantised(logp)), gapSubRaw: gap(logp)};
}

/**
 * The first pass and the padded look around time t.
 * @param {object} o
 * @param {Float32Array} o.wave the condition's audio
 * @param {number} o.limit samples this look may read: the audio fed so far
 * @param {string[]} o.letters the ayah's words as letters
 * @param {number} o.j the word
 * @param {number} o.t the verdict's time
 * @param {(from: number, to: number) => Promise<{logp: Float32Array, frames: number}>} o.slice
 * @param {(from: number, to: number) => Promise<{logp: Float32Array, frames: number}>} o.padded
 *   the model on samples from..to with o.pad seconds of digital silence each side
 * @returns {Promise<object|null>} null with too little audio to check
 */
export async function look({limit, letters, j, t, slice, padded}) {
  const from = Math.max(0, Math.floor((t - SLICE_BEFORE_S) * SR));
  const to = Math.min(limit, Math.ceil((t + SLICE_AFTER_S) * SR));
  if (to - from < MIN_SLICE_S * SR) return null;
  const tokens = tokensOf(letters[j]);
  const m = [...letters[j]].length;
  const r = await slice(from, to);
  // The app's score: judge.ts is judge.mjs with its firstWithin rule off.
  const v = judgeWord(r.logp, r.frames, letters, j, NO_ALTERNATIVES, {firstWithin: r.frames});
  const rel = relativeTo(r.logp, r.frames);
  const {left, right} = contextOf(letters, j);
  const p = prepare(rel, r.frames, left, right);
  const expected = scoreWord(p, tokens);
  const al = alignIn(p, tokens);
  if (!al || Math.abs(al.score - expected) > 1e-3 || Math.abs(expected - v.expected) > 2e-3) {
    throw new Error(`alignment mismatch at ${t}: ${al?.score}, ${expected}, ${v.expected}`);
  }
  const wordStart = +(from / SR + al.ts[0] * FRAME).toFixed(3);
  const wordEnd = +(from / SR + (al.exit + 1) * FRAME).toFixed(3);
  const relQ = relativeTo(quantised(r.logp), r.frames);
  const expectedQ = scoreWord(prepare(relQ, r.frames, left, right), tokens);
  const out = {
    from: +(from / SR).toFixed(4),
    to: +(to / SR).toFixed(4),
    frames: r.frames,
    expected: v.expected,
    perLetter: v.expected / m,
    perLetterQ: round3(expectedQ / tokens.length),
    wordStart,
    wordEnd,
    pad: null,
    gapSub: null,
    gapSubRaw: null,
  };
  const ca = Math.max(0, Math.floor((wordStart - CUT_MARGIN_S) * SR));
  const cb = Math.min(limit, Math.ceil((wordEnd + CUT_MARGIN_S) * SR));
  if (cb - ca >= MIN_CUT_S * SR) {
    const c = await padded(ca, cb, CUT_PAD_S);
    const gaps = paddedGaps(c.logp, c.frames, tokens);
    out.pad = {from: +(ca / SR).toFixed(4), to: +(cb / SR).toFixed(4), frames: c.frames};
    out.gapSub = gaps.gapSub;
    out.gapSubRaw = gaps.gapSubRaw;
  }
  return out;
}

/** B: the mark goes when the written word fits above -2 per letter. No look, it stays. */
export const ruleB = l => (l && l.perLetter > FITS_ABOVE_PER_LETTER ? 'cancel' : 'keep');

/** C: the mark stays at -6 per letter or below, or when a one-inner-letter spelling beats the word. */
export function ruleC(l) {
  if (!l) return 'keep';
  if (l.perLetterQ <= KEEP_AT_OR_BELOW_PER_LETTER) return 'keep';
  if (Number.isFinite(l.gapSub) && l.gapSub <= KEEP_GAP_AT_OR_BELOW) return 'keep';
  return 'cancel';
}

/** E: B on marks of a word not heard. Marks of a wrong word stand. */
export const ruleE = (kind, l) => (kind === 'missed' ? ruleB(l) : 'keep');

/** D: an interior wrong or a skipped word goes when its total score is at or above -fit. */
export function ruleD(state, place, expected, fit) {
  if (expected === null || expected === undefined) return 'keep';
  const eligible = state === 'skipped' || (state === 'wrong' && place === 'interior');
  return eligible && expected >= -fit ? 'cancel' : 'keep';
}

/**
 * The audio time the app has fed when a mark falls due: whole chunks.
 * @returns {number} samples
 */
export function fedSamples(shownAt, length) {
  const fed = Math.min(length / SR, Math.floor(shownAt / CHUNK_S + 1e-9) * CHUNK_S);
  return Math.min(length, Math.round(fed * SR));
}

/**
 * Rule D's slice, judge/e2e_harness.mjs's rule: inside the word's ayah as far as the
 * tracker's frames say, up to the longest slice, ending one hold after the verdict.
 * @param {object} o
 * @param {string} o.key 's:a'
 * @param {number} o.t the verdict's time
 * @param {number} o.length samples of audio
 * @param {Map<string, {from: number|null, to: number|null}>} o.tracked the tracker's
 *   word frames at the end of the take
 * @param {Map<string, number>} o.cursorIn when the cursor first entered each ayah
 * @param {Record<string, number>} o.wordsOf the engine's words per ayah
 * @param {object} o.C the constants
 * @returns {{start: number, end: number}} samples
 */
export function fitSlice({key, t, length, tracked, cursorIn, wordsOf, C}) {
  const [s, a] = key.split(':').map(Number);
  const ayahStart = k => {
    const w = tracked.get(`${k}:0`);
    if (w && w.from !== null) return w.from * 0.04 - C.trackerLag;
    return cursorIn.has(k) ? cursorIn.get(k) - C.cursorLag : null;
  };
  const sliceFrom = () => {
    const first = ayahStart(key);
    const n = wordsOf[`${s}:${a - 1}`];
    const prev = n ? tracked.get(`${s}:${a - 1}:${n - 1}`) : null;
    const after = prev && prev.to !== null ? prev.to * 0.04 + C.afterPrevious : null;
    if (first === null) return after;
    return after === null ? first - C.noPrevious : Math.min(after, first - C.cut);
  };
  let endSec = t + C.hold;
  const next = ayahStart(`${s}:${a + 1}`);
  if (next !== null && next > 0) endSec = Math.min(endSec, Math.max(t, next + C.tail));
  const end = Math.min(length, Math.round(endSec * SR));
  let start = Math.max(0, end - Math.round(C.longest * SR));
  const here = sliceFrom();
  if (here !== null) start = Math.max(start, Math.round(here * SR));
  if (end - start < C.minSlice * SR) start = Math.max(0, end - 3 * SR);
  return {start: Math.max(0, start), end};
}

/** Rule D's constants, by name, from the two frozen files. */
export function fitConstants(judge, engine) {
  return {
    fit: judge.fit.value,
    leftWords: judge.leftWords.value,
    rightWords: judge.rightWords.value,
    longest: judge.sliceSeconds.value,
    cut: judge.cutSeconds.value,
    tail: judge.tailSeconds.value,
    firstWithin: judge.firstWithinFrames.value,
    hold: engine.holdSeconds.value,
    trackerLag: engine.trackerLagSeconds.value,
    cursorLag: engine.cursorLagSeconds.value,
    afterPrevious: engine.afterPreviousSeconds.value,
    noPrevious: engine.noPreviousSeconds.value,
    minSlice: engine.minSliceSeconds.value,
  };
}
