import {
  BLANK,
  editDistance,
  NONE,
  pathScore,
  quietRuns,
  read,
  SEP,
  share,
  startsWith,
  VOCAB,
} from '../reading';

// The model's reading cut into words, the best path through a text, and the quiet in a
// window. Letters are numbers; nothing here is text of the Quran.

/** Log-probabilities whose best token in each frame is the one given. */
function says(tokens: number[]): Float32Array {
  const logp = new Float32Array(tokens.length * VOCAB).fill(-15);
  tokens.forEach((k, t) => {
    logp[t * VOCAB + k] = -0.01;
  });
  return logp;
}

/** What read() makes of these frames, words as plain objects. */
function readOf(frames: number[]) {
  const r = read(says(frames), frames.length);
  return {
    tokens: r.tokens,
    words: r.words.map(w => ({
      ids: w.ids,
      from: w.from,
      to: w.to,
      at: w.at,
      letterAt: w.letterAt,
      tokFrom: w.tokFrom,
      tokTo: w.tokTo,
    })),
  };
}

describe('read', () => {
  it('reads a held letter as one token', () => {
    expect(readOf([0, 1, 1, 0, 2, 2, 2, 0])).toEqual({
      tokens: [1, 2],
      words: [
        {
          ids: [1, 2],
          from: 1,
          to: 6,
          at: 4,
          letterAt: [1, 4],
          tokFrom: 0,
          tokTo: 2,
        },
      ],
    });
  });

  it('needs a blank between the same letter twice', () => {
    expect(readOf([1, 1, 1]).tokens).toEqual([1]);
    expect(readOf([1, 1, 0, 1, 0])).toEqual({
      tokens: [1, 1],
      words: [
        {
          ids: [1, 1],
          from: 0,
          to: 3,
          at: 3,
          letterAt: [0, 3],
          tokFrom: 0,
          tokTo: 2,
        },
      ],
    });
  });

  it('cuts words at separators', () => {
    expect(readOf([1, 0, 30, 0, 2, 3])).toEqual({
      tokens: [1, SEP, 2, 3],
      words: [
        {ids: [1], from: 0, to: 0, at: 0, letterAt: [0], tokFrom: 0, tokTo: 1},
        {
          ids: [2, 3],
          from: 4,
          to: 5,
          at: 5,
          letterAt: [4, 5],
          tokFrom: 2,
          tokTo: 4,
        },
      ],
    });
  });

  it('starts no word at a leading separator', () => {
    expect(readOf([30, 0, 1, 2, 0, 30, 0, 3])).toEqual({
      tokens: [SEP, 1, 2, SEP, 3],
      words: [
        {
          ids: [1, 2],
          from: 2,
          to: 3,
          at: 3,
          letterAt: [2, 3],
          tokFrom: 1,
          tokTo: 3,
        },
        {ids: [3], from: 7, to: 7, at: 7, letterAt: [7], tokFrom: 4, tokTo: 5},
      ],
    });
  });

  it('makes no empty word of doubled separators', () => {
    const doubled = readOf([1, 30, 0, 30, 2]);
    expect(doubled.tokens).toEqual([1, SEP, SEP, 2]);
    expect(doubled.words.map(w => [w.ids, w.tokFrom, w.tokTo])).toEqual([
      [[1], 0, 1],
      [[2], 3, 4],
    ]);
    // A separator held over frames is one token.
    expect(readOf([1, 30, 30, 30, 2]).tokens).toEqual([1, SEP, 2]);
  });

  it('keeps a word that runs to the very end', () => {
    expect(readOf([0, 30, 5, 6])).toEqual({
      tokens: [SEP, 5, 6],
      words: [
        {
          ids: [5, 6],
          from: 2,
          to: 3,
          at: 3,
          letterAt: [2, 3],
          tokFrom: 1,
          tokTo: 3,
        },
      ],
    });
  });

  it('reads the same letter on both sides of a separator as two words', () => {
    expect(readOf([4, 30, 4]).words.map(w => w.ids)).toEqual([[4], [4]]);
  });

  it('reads nothing from blanks', () => {
    expect(readOf([0, 0, 0])).toEqual({tokens: [], words: []});
    expect(readOf([])).toEqual({tokens: [], words: []});
  });

  it("puts 'at' where the last letter first showed, however long it is held", () => {
    const r = readOf([7, 7, 0, 8, 8, 8, 8, 8, 8, 0, 0]);
    expect(r.words[0]).toMatchObject({from: 0, at: 3, to: 8, letterAt: [0, 3]});
  });

  it('gives each word the slice of the token list that is its letters', () => {
    const frames = [0, 3, 3, 0, 30, 4, 0, 4, 5, 30, 30, 0, 6, 0, 30, 7, 7, 8];
    const r = read(says(frames), frames.length);
    expect(r.words.length).toBe(4);
    for (const w of r.words) {
      expect(r.tokens.slice(w.tokFrom, w.tokTo)).toEqual(w.ids);
      expect(w.letterAt.length).toBe(w.ids.length);
    }
  });

  it('scores each frame against its own best', () => {
    const logp = says([0, 2, 30]);
    logp[VOCAB + 5] = -3;
    const r = read(logp, 3);
    for (let t = 0; t < 3; t++) {
      const row = Array.from(r.rel.subarray(t * VOCAB, (t + 1) * VOCAB));
      expect(Math.max(...row)).toBe(0);
    }
    expect(r.rel[VOCAB + 5]).toBeCloseTo(-2.99, 5);
  });
});

// A seeded generator, so a failure is the same failure every run.
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

/** The tokens a path through the frames writes: repeats merged, blanks dropped. */
function collapse(path: readonly number[]): number[] {
  const out: number[] = [];
  let prev = -1;
  for (const k of path) {
    if (k !== prev && k !== BLANK) out.push(k);
    prev = k;
  }
  return out;
}

/**
 * The best CTC path by trying every path: any token at any frame, scored when it
 * writes the text, or the text with any of the optional tokens passed over.
 */
function bruteBest(
  rel: Float32Array,
  frames: number,
  tokens: readonly number[],
  optional: ReadonlySet<number>,
): number {
  const opt = [...optional];
  const targets = new Set<string>();
  for (let mask = 0; mask < 2 ** opt.length; mask++) {
    const drop = new Set(opt.filter((_, b) => Math.floor(mask / 2 ** b) % 2));
    targets.add(tokens.filter((_, j) => !drop.has(j)).join(','));
  }
  const symbols = [BLANK, ...new Set(tokens)];
  let best = NONE;
  const path: number[] = [];
  const walk = (t: number, score: number) => {
    if (t === frames) {
      if (targets.has(collapse(path).join(','))) best = Math.max(best, score);
      return;
    }
    for (const k of symbols) {
      path.push(k);
      walk(t + 1, score + rel[t * VOCAB + k]);
      path.pop();
    }
  };
  walk(0, 0);
  return best;
}

/** Scores relative to each frame's best, with the mass on a few tokens. */
function randomRel(frames: number, rnd: () => number): Float32Array {
  const live = [BLANK, 1, 2, 3, SEP];
  const spread = rnd() < 0.5 ? 15 : 3;
  const rel = new Float32Array(frames * VOCAB).fill(-40);
  for (let t = 0; t < frames; t++) {
    let top = -Infinity;
    for (const k of live) {
      rel[t * VOCAB + k] = -spread * rnd();
      top = Math.max(top, rel[t * VOCAB + k]);
    }
    for (let k = 0; k < VOCAB; k++) rel[t * VOCAB + k] -= top;
  }
  return rel;
}

describe('pathScore', () => {
  type Where = 'none' | 'first' | 'middle' | 'last';
  const cases = (where: Where, count: number, seed: number) => {
    const rnd = seeded(seed);
    const out: {
      rel: Float32Array;
      frames: number;
      tokens: number[];
      optional: Set<number>;
    }[] = [];
    while (out.length < count) {
      const frames = 1 + Math.floor(rnd() * 5);
      const m =
        (where === 'middle' ? 3 : where === 'none' ? 1 : 2) +
        Math.floor(rnd() * 3);
      const tokens = Array.from(
        {length: m},
        () => [1, 2, 3, SEP][Math.floor(rnd() * 4)],
      );
      const at =
        where === 'first'
          ? 0
          : where === 'last'
            ? m - 1
            : 1 + Math.floor(rnd() * (m - 2));
      const optional = where === 'none' ? new Set<number>() : new Set([at]);
      out.push({rel: randomRel(frames, rnd), frames, tokens, optional});
    }
    return out;
  };

  it.each<[Where, number]>([
    ['none', 11],
    ['first', 22],
    ['middle', 33],
    ['last', 44],
  ])('is the best CTC path, optional token: %s', (where, seed) => {
    let reachable = 0;
    for (const c of cases(where, 120, seed)) {
      const got = pathScore(c.rel, c.frames, c.tokens, c.optional);
      const want = bruteBest(c.rel, c.frames, c.tokens, c.optional);
      if (want <= NONE / 2) {
        expect(got).toBeLessThanOrEqual(NONE / 2);
      } else {
        reachable += 1;
        expect(got).toBeCloseTo(want, 4);
      }
    }
    // Enough of the cases fit their frames for the comparison to mean something.
    expect(reachable).toBeGreaterThan(40);
  });

  it('scores the model’s own reading exactly 0', () => {
    const rnd = seeded(99);
    let tried = 0;
    for (let n = 0; n < 300; n++) {
      const frames = 3 + Math.floor(rnd() * 30);
      const r = read(randomRel(frames, rnd), frames);
      if (r.tokens.length === 0) continue;
      tried += 1;
      expect(pathScore(r.rel, frames, r.tokens, new Set())).toBe(0);
    }
    expect(tried).toBeGreaterThan(200);
  });

  it('scores another text below 0, and nothing at all as no path', () => {
    const r = read(says([0, 1, 1, 0, 30, 2, 0]), 7);
    expect(pathScore(r.rel, 7, [1, SEP, 3], new Set())).toBeLessThan(-10);
    expect(pathScore(r.rel, 7, [], new Set())).toBe(NONE);
    expect(pathScore(r.rel, 0, [1], new Set())).toBe(NONE);
    // More tokens than frames cannot be written.
    expect(pathScore(r.rel, 2, [1, 2, 3], new Set())).toBeLessThanOrEqual(
      NONE / 2,
    );
  });

  it('passes over an optional separator for nothing when the model wrote none', () => {
    const r = read(says([0, 1, 1, 0, 2, 0]), 6);
    expect(pathScore(r.rel, 6, [1, SEP, 2], new Set([1]))).toBe(0);
    expect(pathScore(r.rel, 6, [1, SEP, 2], new Set())).toBeLessThan(-10);
  });
});

describe('editDistance, share and startsWith', () => {
  it('counts the letters changed, put in and left out', () => {
    expect(editDistance([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(editDistance([1, 2, 3], [1, 9, 3])).toBe(1);
    expect(editDistance([1, 2, 3], [1, 3])).toBe(1);
    expect(editDistance([1, 3], [1, 2, 3])).toBe(1);
    expect(editDistance([], [4, 5])).toBe(2);
    expect(editDistance([4, 5], [])).toBe(2);
    expect(editDistance([1, 2, 3, 4], [5, 6])).toBe(4);
    expect(editDistance([1, 2], [2, 1])).toBe(2);
  });

  it('shares the distance over the longer word', () => {
    expect(share([1, 2, 3, 4], [1, 2, 3, 9])).toBeCloseTo(0.25);
    expect(share([1, 2], [1, 2, 3, 4])).toBeCloseTo(0.5);
    expect(share([1], [2])).toBe(1);
    expect(share([], [])).toBe(0);
  });

  it('takes only a non-empty prefix no longer than the word', () => {
    expect(startsWith([1, 2, 3], [1, 2])).toBe(true);
    expect(startsWith([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(startsWith([1, 2, 3], [2])).toBe(false);
    expect(startsWith([1, 2, 3], [])).toBe(false);
    expect(startsWith([1, 2], [1, 2, 3])).toBe(false);
  });
});

describe('quietRuns', () => {
  const config = {quietShare: 0.3, quietSpread: 3};
  /** Log-mel frame means: loud everywhere but these stretches [from, to). */
  const energy = (
    n: number,
    quiet: [number, number][],
    loud = -3,
    low = -12,
  ) => {
    const e = new Float32Array(n).fill(loud);
    for (const [from, to] of quiet) e.fill(low, from, to);
    return e;
  };

  it('finds a quiet stretch, in model frames', () => {
    expect(quietRuns(energy(80, [[20, 40]]), config)).toEqual([
      {from: 5, to: 10},
    ]);
  });

  it('sets the threshold from the window’s own spread', () => {
    // The same shape a hundred units louder finds the same stretch.
    const loud = energy(80, [[20, 40]], 97, 88);
    expect(quietRuns(loud, config)).toEqual([{from: 5, to: 10}]);
    // Quiet at -12 and sound at -3: a frame under 30% of the way up is quiet.
    const e = energy(80, [[20, 40]]);
    e.fill(-9.4, 40, 50);
    e.fill(-9.2, 50, 60);
    expect(quietRuns(e, config)).toEqual([{from: 5, to: 12.5}]);
  });

  it('needs eight log-mel frames of quiet', () => {
    expect(quietRuns(energy(80, [[20, 27]]), config)).toEqual([]);
    expect(quietRuns(energy(80, [[20, 28]]), config)).toEqual([
      {from: 5, to: 7},
    ]);
  });

  it('finds none in a flat window, a window with too little spread, or a short one', () => {
    expect(quietRuns(new Float32Array(80).fill(-5), config)).toEqual([]);
    expect(quietRuns(energy(80, [[20, 40]], -3, -5), config)).toEqual([]);
    expect(quietRuns(energy(19, [[0, 10]]), config)).toEqual([]);
  });

  it('keeps stretches that touch either end of the window', () => {
    expect(
      quietRuns(
        energy(80, [
          [0, 12],
          [68, 80],
        ]),
        config,
      ),
    ).toEqual([
      {from: 0, to: 3},
      {from: 17, to: 20},
    ]);
  });
});
