// What the live check reads from one run of the second model: its own reading cut
// into words, the score of a text against the frames, and the quiet in the window.
// No state, no text of the Quran: letters here are numbers.

export const VOCAB = 31;
export const BLANK = 0;
export const SEP = 30;
export const NONE = -1e30;
export const MEL_PER_SECOND = 100;
/** One model frame is four log-mel frames, 40 ms. */
export const MEL_PER_FRAME = 4;
export const FRAME_SECONDS = 0.04;

const ALPHABET = 'ءابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const LETTER_ID = new Map([...ALPHABET].map((c, i) => [c, i + 1]));

export function idsOf(letters: string): number[] {
  const out: number[] = [];
  for (const c of letters) {
    const id = LETTER_ID.get(c);
    if (id !== undefined) out.push(id);
  }
  return out;
}

/** A word as the model wrote it. Frames are the model's, from the window's start. */
export interface Heard {
  ids: number[];
  /** Its first letter's first frame and its last letter's last frame. */
  from: number;
  to: number;
  /** The frame its last letter first showed. The model may hold a letter for seconds. */
  at: number;
  /** The frame each letter first showed. */
  letterAt: number[];
  /** Where its letters sit in the run's token list. */
  tokFrom: number;
  tokTo: number;
}

export interface Reading {
  rel: Float32Array;
  frames: number;
  /** Every token the model wrote, separators too, in order. */
  tokens: number[];
  words: Heard[];
}

/** Scores minus each frame's best, and the model's own reading cut into words. */
export function read(logp: Float32Array, frames: number): Reading {
  const rel = new Float32Array(frames * VOCAB);
  const tokens: number[] = [];
  const words: Heard[] = [];
  let current: Heard | null = null;
  let prev = -1;
  for (let t = 0; t < frames; t++) {
    const row = t * VOCAB;
    let best = 0;
    let bestV = logp[row];
    for (let k = 1; k < VOCAB; k++) {
      if (logp[row + k] > bestV) {
        bestV = logp[row + k];
        best = k;
      }
    }
    for (let k = 0; k < VOCAB; k++) rel[row + k] = logp[row + k] - bestV;
    if (best !== prev && best !== BLANK) {
      if (best === SEP) {
        current = null;
      } else {
        if (!current) {
          current = {
            ids: [],
            from: t,
            to: t,
            at: t,
            letterAt: [],
            tokFrom: tokens.length,
            tokTo: tokens.length,
          };
          words.push(current);
        }
        current.ids.push(best);
        current.letterAt.push(t);
        current.at = t;
      }
      tokens.push(best);
      if (current) current.tokTo = tokens.length;
    }
    if (best !== BLANK && best !== SEP && current) current.to = t;
    prev = best;
  }
  return {rel, frames, tokens, words};
}

export function editDistance(
  a: readonly number[],
  b: readonly number[],
): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev = new Array<number>(m + 1);
  let cur = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const del = prev[j] + 1;
      const ins = cur[j - 1] + 1;
      cur[j] = sub < del ? (sub < ins ? sub : ins) : del < ins ? del : ins;
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[m];
}

export function share(a: readonly number[], b: readonly number[]): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 0 : editDistance(a, b) / longest;
}

export function startsWith(word: readonly number[], prefix: readonly number[]) {
  if (prefix.length === 0 || prefix.length > word.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (word[i] !== prefix[i]) return false;
  }
  return true;
}

/**
 * The best path through these tokens over all frames: at most 0, and 0 when they are
 * what the model wrote. An optional token may be passed over; two optional tokens
 * must not be side by side.
 */
export function pathScore(
  rel: Float32Array,
  frames: number,
  tokens: readonly number[],
  optional: ReadonlySet<number>,
): number {
  const m = tokens.length;
  if (m === 0 || frames === 0) return NONE;
  // tok[j]: on token j. blk[j]: in the blank after it. lead: blanks before the text.
  let tok = new Float64Array(m).fill(NONE);
  let blk = new Float64Array(m).fill(NONE);
  let nextTok = new Float64Array(m);
  let nextBlk = new Float64Array(m);
  let lead = 0;
  for (let t = 0; t < frames; t++) {
    const row = t * VOCAB;
    const blank = rel[row + BLANK];
    for (let j = 0; j < m; j++) {
      let best = tok[j];
      // From the token before, its blank, or past an optional token before that.
      for (let back = 1; back <= 2; back++) {
        const p = j - back;
        if (p < 0) {
          if (lead > best) best = lead;
          break;
        }
        if (blk[p] > best) best = blk[p];
        if (tokens[p] !== tokens[j] && tok[p] > best) best = tok[p];
        if (!optional.has(p)) break;
      }
      nextTok[j] = best <= NONE ? NONE : best + rel[row + tokens[j]];
      const stay = tok[j] > blk[j] ? tok[j] : blk[j];
      nextBlk[j] = stay <= NONE ? NONE : stay + blank;
    }
    lead += blank;
    const a = tok;
    tok = nextTok;
    nextTok = a;
    const b = blk;
    blk = nextBlk;
    nextBlk = b;
  }
  let best = tok[m - 1] > blk[m - 1] ? tok[m - 1] : blk[m - 1];
  if (m >= 2 && optional.has(m - 1)) {
    if (tok[m - 2] > best) best = tok[m - 2];
    if (blk[m - 2] > best) best = blk[m - 2];
  }
  return best;
}

export function sameWord(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Stretches of quiet in a window, in model frames. `energy` has one value a log-mel frame. */
export function quietRuns(
  energy: Float32Array,
  config: {quietShare: number; quietSpread: number},
): {from: number; to: number}[] {
  const n = energy.length;
  if (n < 20) return [];
  const sorted = Float32Array.from(energy).sort();
  const low = sorted[Math.floor(n * 0.05)];
  const high = sorted[Math.floor(n * 0.95)];
  if (high - low < config.quietSpread) return [];
  const limit = low + config.quietShare * (high - low);
  const out: {from: number; to: number}[] = [];
  // A click of up to three frames does not end a stretch of quiet.
  let start = -1;
  let last = -1;
  for (let f = 0; f <= n; f++) {
    const quiet = f < n && energy[f] < limit;
    if (quiet) {
      if (start < 0) start = f;
      last = f;
    } else if (start >= 0 && (f === n || f - last > 3)) {
      if (last + 1 - start >= 8) {
        out.push({
          from: start / MEL_PER_FRAME,
          to: (last + 1) / MEL_PER_FRAME,
        });
      }
      start = -1;
    }
  }
  return out;
}
