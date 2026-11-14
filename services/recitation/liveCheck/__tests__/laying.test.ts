import {matchWords, type LayCosts, type Step} from '../laying';
import type {Heard} from '../reading';

// Laying heard words against written ones, one small case per kind of step. Words are
// made-up lists of letter numbers, each word's letters its own, so a share is plain to
// see. The costs are given here rather than taken from the check's defaults, which are
// still being tuned: what is tested is how the laying weighs them.

const COSTS: LayCosts = {
  anchorShare: 0.34,
  extraCost: 1.0,
  missCost: 0.9,
  moreMissCost: 0.05,
  joinCost: 0.75,
  backCost: 0.3,
  startAgainCost: 0.25,
};

const A = [1, 2, 3, 4];
const B = [5, 6, 7];
const C = [8, 9, 10, 11];
const D = [12, 13, 14];
const E = [15, 16, 17, 18];
const F = [19, 20, 21];
const G = [22, 23, 24];
/** A short word, for leaving out beside a long one. */
const S = [25, 26];
/** A word in no text here. */
const X = [27, 28, 29];

/** Heard words, a word every ten frames; only their letters matter to the laying. */
function heard(...words: number[][]): Heard[] {
  return words.map((ids, k) => ({
    ids,
    from: k * 10,
    to: k * 10 + 5,
    at: k * 10 + 5,
    letterAt: ids.map((_, q) => k * 10 + q),
    tokFrom: 0,
    tokTo: 0,
  }));
}

const lay = (
  said: number[][],
  text: number[][],
  {fixedStart = true, fixedEnd = false} = {},
) => matchWords(heard(...said), text, fixedStart, fixedEnd, COSTS);

const match = (i: number, j: number, share = 0): Step => ({
  kind: 'match',
  i,
  j,
  share,
});
const miss = (i: number, j: number): Step => ({kind: 'miss', i, j});

/** The steps alone, without the cost the list carries. */
const stepsOf = (steps: Step[]) => [...steps];

describe('matchWords', () => {
  it('matches a clean reading word for word, at no cost', () => {
    const steps = lay([A, B, C, D], [A, B, C, D]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      match(1, 1),
      match(2, 2),
      match(3, 3),
    ]);
    expect(steps.cost).toBe(0);
  });

  it('matches a changed word with the share of its letters that differ', () => {
    const steps = lay([A, B, [8, 9, 27, 28], D], [A, B, C, D]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      match(1, 1),
      match(2, 2, 0.5),
      match(3, 3),
    ]);
    expect(steps.cost).toBeCloseTo(0.5);
  });

  it('takes a word left out mid-ayah as a miss before the word heard next', () => {
    const steps = lay([A, B, D, E], [A, B, C, D, E, F]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      match(1, 1),
      miss(2, 2),
      match(2, 3),
      match(3, 4),
    ]);
    expect(steps.cost).toBeCloseTo(COSTS.missCost);
  });

  it('takes a short word left out beside a long one as a miss, not a join', () => {
    const steps = lay([A, B, C, D], [A, B, S, C, D, E]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      match(1, 1),
      miss(2, 2),
      match(2, 3),
      match(3, 4),
    ]);
    expect(steps.some(s => s.kind === 'join')).toBe(false);
  });

  it('finds the word before the last left out, with the end fixed or free', () => {
    for (const fixedEnd of [true, false]) {
      expect(stepsOf(lay([A, B, C, E], [A, B, C, D, E], {fixedEnd}))).toEqual([
        match(0, 0),
        match(1, 1),
        match(2, 2),
        miss(3, 3),
        match(3, 4),
      ]);
    }
  });

  it('finds two left out before the last, the second for less', () => {
    const steps = lay([A, B, E], [A, B, C, D, E], {fixedEnd: true});
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      match(1, 1),
      miss(2, 2),
      miss(2, 3),
      match(2, 4),
    ]);
    expect(steps.cost).toBeCloseTo(COSTS.missCost + COSTS.moreMissCost);
  });

  it('takes a word not in the text as extra', () => {
    const steps = lay([A, B, X, C, D], [A, B, C, D, E]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      match(1, 1),
      {kind: 'extra', i: 2},
      match(3, 2),
      match(4, 3),
    ]);
    expect(steps.cost).toBeCloseTo(COSTS.extraCost);
  });

  it('takes a word begun and then said whole as said again', () => {
    const steps = lay([A, B, [8, 9], C, D], [A, B, C, D]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      match(1, 1),
      {kind: 'again', i: 2, j: 2},
      match(3, 2),
      match(4, 3),
    ]);
    expect(steps.cost).toBeCloseTo(COSTS.startAgainCost);
  });

  it('joins two words run together letter for letter', () => {
    const steps = lay([A, [...B, ...C], D], [A, B, C, D]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      {kind: 'join', i: 1, j: 1, share: 0},
      match(2, 3),
    ]);
    expect(steps.cost).toBeCloseTo(COSTS.joinCost);
  });

  it('splits one word cut in two', () => {
    const steps = lay([A, [5, 6], [7], C], [A, B, C, D]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      {kind: 'split', i: 1, j: 1, share: 0},
      match(3, 2),
    ]);
    expect(steps.cost).toBeCloseTo(COSTS.joinCost);
  });

  it('refuses a join or a split whose letters are far from the text', () => {
    const joined = lay([A, [5, 6, 27, 28, 29, 11], D], [A, B, C, D]);
    expect(joined.some(s => s.kind === 'join')).toBe(false);
    const split = lay([A, [5, 27], [28, 29], C], [A, B, C, D]);
    expect(split.some(s => s.kind === 'split')).toBe(false);
  });

  it('follows a jump back of three words, for the cost of one jump', () => {
    const steps = lay([A, B, C, D, E, B, C, D, E, F], [A, B, C, D, E, F, G]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      match(1, 1),
      match(2, 2),
      match(3, 3),
      match(4, 4),
      match(5, 1),
      match(6, 2),
      match(7, 3),
      match(8, 4),
      match(9, 5),
    ]);
    expect(steps.cost).toBeCloseTo(COSTS.backCost);
  });

  it('follows a restart from the first word', () => {
    const steps = lay([A, B, C, D, A, B, C, D, E], [A, B, C, D, E]);
    expect(steps.map(s => (s.kind === 'match' ? s.j : -1))).toEqual([
      0, 1, 2, 3, 0, 1, 2, 3, 4,
    ]);
    expect(steps.cost).toBeCloseTo(COSTS.backCost);
  });

  it('starts anywhere when the start is free, and at the first word when fixed', () => {
    expect(stepsOf(lay([C, D], [A, B, C, D, E], {fixedStart: false}))).toEqual([
      match(0, 2),
      match(1, 3),
    ]);
    const fixed = lay([C, D], [A, B, C, D, E]);
    expect(stepsOf(fixed)).toEqual([
      miss(0, 0),
      miss(0, 1),
      match(0, 2),
      match(1, 3),
    ]);
    expect(fixed.cost).toBeCloseTo(COSTS.missCost + COSTS.moreMissCost);
  });

  it('matches a changed last word with its share, end free or fixed', () => {
    for (const fixedEnd of [false, true]) {
      const steps = lay([A, B, C, G], [A, B, C, D], {fixedEnd});
      expect(steps[steps.length - 1]).toEqual(match(3, 3, 1));
    }
  });

  it('misses a last word not said only when the end is fixed', () => {
    const fixed = lay([A, B, C], [A, B, C, D], {fixedEnd: true});
    expect(stepsOf(fixed)).toEqual([
      match(0, 0),
      match(1, 1),
      match(2, 2),
      miss(3, 3),
    ]);
    expect(fixed.cost).toBeCloseTo(COSTS.missCost);
    // With the end free the reader may simply not be there yet.
    const free = lay([A, B, C], [A, B, C, D]);
    expect(stepsOf(free)).toEqual([match(0, 0), match(1, 1), match(2, 2)]);
    expect(free.cost).toBe(0);
  });

  it('takes the newest word’s start as on its way, for nothing', () => {
    const steps = lay([A, B, [8, 9]], [A, B, C, D]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      match(1, 1),
      match(2, 2, 0.5),
    ]);
    expect(steps.cost).toBe(0);
  });

  it('takes the furthest of equal places', () => {
    expect(stepsOf(lay([A], [A, B, A, B], {fixedStart: false}))).toEqual([
      match(0, 2),
    ]);
  });

  it('lays an empty heard list as nothing, or as every word missed at a fixed end', () => {
    for (const fixedStart of [true, false]) {
      const steps = lay([], [A, B], {fixedStart});
      expect(stepsOf(steps)).toEqual([]);
      expect(steps.cost).toBe(0);
    }
    const ended = lay([], [A, B], {fixedEnd: true});
    expect(stepsOf(ended)).toEqual([miss(0, 0), miss(0, 1)]);
    expect(ended.cost).toBeCloseTo(COSTS.missCost + COSTS.moreMissCost);
  });

  it('takes heard words past a shorter text as extra', () => {
    const steps = lay([A, B, C, D], [A, B]);
    expect(stepsOf(steps)).toEqual([
      match(0, 0),
      match(1, 1),
      {kind: 'extra', i: 2},
      {kind: 'extra', i: 3},
    ]);
    expect(steps.cost).toBeCloseTo(2 * COSTS.extraCost);
  });

  it('keeps heard words in the order they were heard', () => {
    const steps = lay(
      [A, B, X, D, B, C, [8, 9], C, E, F],
      [A, B, C, D, E, F, G],
    );
    let last = -1;
    for (const s of steps) {
      expect(s.i).toBeGreaterThanOrEqual(last);
      last = s.i;
    }
  });
});
