import {share, startsWith, type Heard} from './reading';

// Laying what the model heard, word by word, against what is written.

/** What each way of accounting for a word costs. */
export interface LayCosts {
  /** A heard word this close to the written one (share of letters) anchors a place. */
  anchorShare: number;
  extraCost: number;
  missCost: number;
  /** Each further word left out in the same run. */
  moreMissCost: number;
  joinCost: number;
  backCost: number;
  startAgainCost: number;
}

export type Step =
  /** Heard word i is written word j, with this share of letters differing. */
  | {kind: 'match'; i: number; j: number; share: number}
  /** Heard word i is written words j and j + 1 run together. */
  | {kind: 'join'; i: number; j: number; share: number}
  /** Heard words i and i + 1 are written word j. */
  | {kind: 'split'; i: number; j: number; share: number}
  /** Heard word i is not in the text. */
  | {kind: 'extra'; i: number}
  /** Heard word i is the start of written word j, said again after it. */
  | {kind: 'again'; i: number; j: number}
  /** Written word j was not heard; heard word i came next (none, at the end of the text). */
  | {kind: 'miss'; i: number; j: number};

const enum Op {
  None,
  Match,
  Join,
  Split,
  Extra,
  Again,
}

/**
 * Lays the heard words against the written ones. The reading may start anywhere in
 * the text unless `fixedStart`. It may stop anywhere in it unless `fixedEnd`, which
 * is for an ayah known to be over: then the text's last words are accounted for too.
 *
 * After each heard word the reader may jump back (cheap: reading again is not a
 * mistake) and may leave words out. The first word left out costs most and the ones
 * after it less, so a heard word that is a later written word is taken as that word,
 * with the words between left out, rather than as a word that is not in the text.
 */
export function matchWords(
  heard: readonly Heard[],
  text: readonly (readonly number[])[],
  fixedStart: boolean,
  fixedEnd: boolean,
  config: LayCosts,
): Step[] & {cost: number} {
  const m = heard.length;
  const n = text.length;
  const width = n + 1;
  const size = (m + 1) * width;
  // Three layers after each heard word: as it arrived, after a jump back, after
  // words left out.
  const arrive = new Float64Array(size).fill(Infinity);
  const op = new Uint8Array(size);
  const settled = new Float64Array(size).fill(Infinity);
  const backFrom = new Int32Array(size).fill(-1);
  const missFrom = new Int32Array(size).fill(-1);
  const jumped = new Float64Array(width);
  const settle = (i: number) => {
    const row = i * width;
    // A jump back from the best place further on.
    let best = Infinity;
    let bestJ = -1;
    for (let j = n; j >= 0; j--) {
      const here = arrive[row + j];
      if (best + config.backCost < here) {
        jumped[j] = best + config.backCost;
        backFrom[row + j] = bestJ;
      } else {
        jumped[j] = here;
        backFrom[row + j] = -1;
      }
      if (here < best) {
        best = here;
        bestJ = j;
      }
    }
    // Words left out, in one run from where the reader was. A heard word must
    // follow, unless the text's end is fixed.
    const mayMiss = i < m || fixedEnd;
    for (let j = 0; j <= n; j++) {
      let cost = jumped[j];
      let from = -1;
      if (mayMiss) {
        for (let s = 1; s <= j && s <= 8; s++) {
          const c =
            jumped[j - s] + config.missCost + (s - 1) * config.moreMissCost;
          if (c < cost) {
            cost = c;
            from = j - s;
          }
        }
      }
      settled[row + j] = cost;
      missFrom[row + j] = from;
    }
  };
  if (fixedStart) arrive[0] = 0;
  else for (let j = 0; j <= n; j++) arrive[j] = 0;
  for (let i = 0; i < m; i++) {
    settle(i);
    const row = i * width;
    const next = row + width;
    const h = heard[i].ids;
    const last = i === m - 1;
    const put = (at: number, cost: number, how: Op) => {
      if (cost < arrive[at]) {
        arrive[at] = cost;
        op[at] = how;
      }
    };
    for (let j = 0; j <= n; j++) {
      const c = settled[row + j];
      if (c === Infinity) continue;
      put(next + j, c + config.extraCost, Op.Extra);
      if (j >= n) continue;
      const w = text[j];
      // The newest word may still be on its way: its start costs nothing.
      put(
        next + j + 1,
        c + (last && startsWith(w, h) ? 0 : share(h, w)),
        Op.Match,
      );
      if (!last && h.length < w.length && startsWith(w, h)) {
        put(next + j, c + config.startAgainCost, Op.Again);
      }
      // Two words run together, or one cut in two: only when the letters are right
      // or nearly, or a word left out beside a longer one would pass for it.
      if (j + 1 < n) {
        const d = share(h, [...w, ...text[j + 1]]);
        if (d <= config.anchorShare) {
          put(next + j + 2, c + config.joinCost + d, Op.Join);
        }
      }
      if (i + 1 < m) {
        const d = share([...h, ...heard[i + 1].ids], w);
        if (d <= config.anchorShare) {
          put(next + width + j + 1, c + config.joinCost + d, Op.Split);
        }
      }
    }
  }
  settle(m);
  // Where the reading stops: at the text's end if it is fixed, otherwise wherever
  // is cheapest, and of equal places the furthest on.
  let j = n;
  if (!fixedEnd) {
    let best = Infinity;
    for (let k = 0; k <= n; k++) {
      if (settled[m * width + k] <= best) {
        best = settled[m * width + k];
        j = k;
      }
    }
  }
  const stop = j;
  const steps: Step[] = [];
  let i = m;
  for (;;) {
    const at = i * width + j;
    if (missFrom[at] >= 0) {
      const from = missFrom[at];
      for (let q = j - 1; q >= from; q--) steps.push({kind: 'miss', i, j: q});
      j = from;
    }
    const back = backFrom[i * width + j];
    if (back >= 0) j = back;
    const how = op[i * width + j];
    if (how === Op.Match) {
      i -= 1;
      j -= 1;
      steps.push({kind: 'match', i, j, share: share(heard[i].ids, text[j])});
    } else if (how === Op.Join) {
      i -= 1;
      j -= 2;
      steps.push({
        kind: 'join',
        i,
        j,
        share: share(heard[i].ids, [...text[j], ...text[j + 1]]),
      });
    } else if (how === Op.Split) {
      i -= 2;
      j -= 1;
      steps.push({
        kind: 'split',
        i,
        j,
        share: share([...heard[i].ids, ...heard[i + 1].ids], text[j]),
      });
    } else if (how === Op.Extra) {
      i -= 1;
      steps.push({kind: 'extra', i});
    } else if (how === Op.Again) {
      i -= 1;
      steps.push({kind: 'again', i, j});
    } else {
      break;
    }
  }
  steps.reverse();
  return Object.assign(steps, {
    cost: settled[m * width + (fixedEnd ? n : stop)],
  });
}
