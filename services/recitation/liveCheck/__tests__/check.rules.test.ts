import {
  ALPHABET,
  depsOf,
  drive,
  keysOf,
  madeUpAyah,
  madeUpWord,
  shifted,
  Timeline,
  type Take,
} from '@/test-utils/liveCheckReader';
import type {LiveConfig, LiveProbe} from '../check';

// The newest rules of the live check, one block each, driven through the fake reader
// in test-utils/liveCheckReader.ts. See docs/features/recitation-live-check.md for
// why each rule exists. These tests say what happens by the end of a take, never on
// which tick. Where a scenario leans on a threshold, it is given in the config here.
//
// Words are made-up letter strings. Places are surah:ayah:word.

/** One letter of a word moved on, never equal to the letters beside it. */
function oneOff(word: string, at = 1): string {
  const c = [...word];
  let k = ALPHABET.indexOf(c[at]);
  do {
    k = (k + 1) % ALPHABET.length;
  } while (ALPHABET[k] === c[at - 1] || ALPHABET[k] === c[at + 1]);
  c[at] = ALPHABET[k];
  return c.join('');
}

/** These words of an ayah said with one letter changed. */
const oneOffAt = (words: readonly string[], at: readonly number[]) =>
  Object.fromEntries(at.map(i => [i, oneOff(words[i])]));

/** Final bad opinions, as surah:ayah:word#reading verdict, sorted. */
const finalBad = (r: Take) =>
  [...r.finals]
    .filter(([, v]) => v.verdict !== 'fine')
    .map(([id, v]) => `${id} ${v.verdict}`)
    .sort();

/** Every bad opinion, final or not, sorted. */
const anyBad = (r: Take) => r.badKeys().sort();

/** A take starts with a little quiet before the first word. */
const take = () => new Timeline().quiet(0.6);

const A10 = madeUpAyah(31, 10);
const A8 = madeUpAyah(32, 8);
const B8 = madeUpAyah(33, 8);
// A fourth ayah, so that 1:3 always has one after it.
const deps = depsOf({1: [A10, A8, B8, madeUpAyah(34, 8)]});

/** The thresholds the run and evidence rules lean on, as check.ts sets them now. */
const BAR: Partial<LiveConfig> = {
  runWords: 3,
  anchorShare: 0.34,
  changedGap: 15,
  changedGapPerLetter: 5,
  changedShare: 0.2,
  missedGap: 15,
  missedGapPerLetter: 5,
};

/** Ayah 1:1 said with these words changed by one letter, then a pause and 1:2. */
const changedIn1 = (at: number[], opts: {only?: number[]} = {}) =>
  take()
    .sayAyah(1, 1, A10, {replace: oneOffAt(A10, at), only: opts.only})
    .quiet(1)
    .sayAyah(1, 2, A8);

const bad = (...words: number[]) => words.map(w => `1:1:${w}#0 changed`).sort();

describe('runs of words that did not read right', () => {
  it('calls one changed word between sound words changed', () => {
    const r = drive(changedIn1([4]), deps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(finalBad(r)).toEqual(bad(4));
    expect(anyBad(r)).toEqual(bad(4));
  });

  it('calls both of two neighbouring changed words between sound words changed', () => {
    const r = drive(changedIn1([4, 5]), deps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(finalBad(r)).toEqual(bad(4, 5));
  });

  it('calls a run of three changed when two sound words stand on one side of it', () => {
    // Words 3-5 changed: 2 is sound and 1 is not, but 6 and 7 are both sound.
    const r = drive(changedIn1([1, 3, 4, 5]), deps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(finalBad(r)).toEqual(bad(1, 3, 4, 5));
  });

  it('does not call a run of three with only one sound word on each side', () => {
    // Words 3-5 changed, with 2 and 6 sound but 1 and 7 changed too.
    const r = drive(changedIn1([1, 3, 4, 5, 7]), deps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(finalBad(r)).toEqual(bad(1, 7));
    expect(anyBad(r)).toEqual(bad(1, 7));
  });

  it('never calls a run of four changed words', () => {
    const r = drive(changedIn1([3, 4, 5, 6]), deps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(anyBad(r)).toEqual([]);
  });

  it('does not call a changed word whose neighbour was not heard right when no sound word stands beyond it', () => {
    // Words 4 and 5 changed, then the reader leaves the ayah for the next one: no
    // sound word follows the pair. (The same pair with the ayah read on is called,
    // in the second test of this block.)
    const r = drive(changedIn1([4, 5], {only: [0, 1, 2, 3, 4, 5]}), deps, {
      config: BAR,
    });
    expect(r.broken).toEqual([]);
    expect(anyBad(r)).toEqual([]);
  });

  it('does not call a run that ends the ayah with only one sound word before it', () => {
    // Words 8 and 9 (the last) changed and 6 changed: 7 is sound, 6 is not.
    const r = drive(changedIn1([6, 8, 9]), deps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(anyBad(r)).toEqual(bad(6));
    // With 6 read right the same ending pair is called.
    const control = drive(changedIn1([8, 9]), deps, {config: BAR});
    expect(finalBad(control)).toEqual(bad(8, 9));
  });
});

describe('the first word of an ayah', () => {
  it('calls a changed first word when the window starts in a pause with it', () => {
    const tl = take()
      .sayAyah(1, 1, A10)
      .quiet(1)
      .sayAyah(1, 2, A8, {replace: oneOffAt(A8, [0])})
      .quiet(1)
      .sayAyah(1, 3, B8);
    const r = drive(tl, deps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(finalBad(r)).toEqual(['1:2:0#0 changed']);
  });

  it('calls a changed first word at the take’s start', () => {
    const tl = take()
      .sayAyah(1, 2, A8, {replace: oneOffAt(A8, [0])})
      .quiet(1)
      .sayAyah(1, 3, B8);
    const r = drive(tl, deps, {
      config: BAR,
      lockAt: {surah: 1, ayah: 2, word: 0},
    });
    expect(r.broken).toEqual([]);
    expect(finalBad(r)).toEqual(['1:2:0#0 changed']);
  });

  it('does not call a run that starts the ayah when other words were heard before it in the same window', () => {
    // At the take's start the reader runs the last two words of 1:1 into 1:2 as one
    // utterance, with 1:2's first word and its fifth changed. The fifth, with sound
    // words around it, is called; the first is not.
    const tl = take()
      .say([
        ['1:1:8', A10[8]],
        ['1:1:9', A10[9]],
        ...A8.map(
          (w, i) =>
            [`1:2:${i}`, i === 0 || i === 4 ? oneOff(w) : w] as [
              string,
              string,
            ],
        ),
      ])
      .quiet(1)
      .sayAyah(1, 3, B8);
    const r = drive(tl, deps, {
      config: BAR,
      lockAt: {surah: 1, ayah: 2, word: 0},
    });
    expect(r.broken).toEqual([]);
    expect(anyBad(r)).toEqual(['1:2:4#0 changed']);
  });
});

describe('the evidence bar', () => {
  // The fake model gives the letter it reads -0.01 and every other token -15, so a
  // written letter forced over one said letter's three frames loses about 3 x 15 nats.
  const tl = () => changedIn1([4]);

  it('calls a changed word whose gap is over changedGap, and not one under it', () => {
    const gaps: number[] = [];
    drive(tl(), deps, {
      config: {...BAR, changedGapPerLetter: 1000},
      watch: {probe: line => line.key === '1:1:4' && gaps.push(line.gap)},
    });
    expect(gaps.length).toBeGreaterThan(0);
    const gap = Math.min(...gaps);
    expect(Math.max(...gaps)).toBeCloseTo(gap, 1);
    // Three frames of one letter, at 14.99 nats each.
    expect(gap).toBeCloseTo(3 * 14.99, 1);
    const over = drive(tl(), deps, {
      config: {...BAR, changedGap: gap - 5, changedGapPerLetter: 1000},
    });
    expect(over.broken).toEqual([]);
    expect(finalBad(over)).toEqual(bad(4));
    const under = drive(tl(), deps, {
      config: {...BAR, changedGap: gap + 5, changedGapPerLetter: 1000},
    });
    expect(under.broken).toEqual([]);
    expect(anyBad(under)).toEqual([]);
  });

  it('takes the per-letter bar when it is the lower one', () => {
    // changedGap far above the gap, but 5 nats a letter is under it.
    const r = drive(tl(), deps, {
      config: {...BAR, changedGap: 1000, changedGapPerLetter: 5},
    });
    expect(finalBad(r)).toEqual(bad(4));
  });
});

describe('a word begun, dropped and said again', () => {
  /** Words 0-3, the first two letters of word 4, a short stop, then word 4 whole. */
  const restart = (whole: string) =>
    take()
      .say([
        ...A10.slice(0, 4).map((w, i) => [`1:1:${i}`, w] as [string, string]),
        ['1:1:4', A10[4].slice(0, 2)],
        ['#pause', 0.3],
        ['1:1:4', whole],
        ...A10.slice(5).map((w, i) => [`1:1:${i + 5}`, w] as [string, string]),
      ])
      .quiet(1)
      .sayAyah(1, 2, A8);

  it('gets no bad verdict when the word is then said right', () => {
    const r = drive(restart(A10[4]), deps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(anyBad(r)).toEqual([]);
    const others = keysOf(1, 1, 10).filter(k => k !== '1:1:4');
    expect(others.filter(k => r.finalOf(k)?.verdict !== 'fine')).toEqual([]);
  });

  it('gets no verdict at all when the word said again differs in a later letter', () => {
    // The model's letters around the break are not trusted.
    const r = drive(restart(oneOff(A10[4], 3)), deps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(anyBad(r)).toEqual([]);
    expect(r.finalOf('1:1:4')).toBeNull();
  });
});

describe('words the model is known to misread (deps.blind)', () => {
  const blindDeps = {
    ...deps,
    blind: (surah: number, ayah: number, word: number) =>
      surah === 1 && ayah === 1 && word === 4,
  };

  it('never calls a blind word bad', () => {
    const r = drive(changedIn1([4]), blindDeps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(anyBad(r)).toEqual([]);
    expect(r.finalOf('1:1:4')).toBeNull();
  });

  it.each([3, 5])(
    'still calls a changed neighbour (word %s) of a changed blind word',
    other => {
      const r = drive(changedIn1([4, other]), blindDeps, {config: BAR});
      expect(r.broken).toEqual([]);
      expect(anyBad(r)).toEqual(bad(other));
    },
  );

  it('makes a blind word read right final fine', () => {
    const tl = take().sayAyah(1, 1, A10).quiet(1).sayAyah(1, 2, A8);
    const r = drive(tl, blindDeps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(anyBad(r)).toEqual([]);
    expect(r.finalOf('1:1:4')).toEqual({verdict: 'fine', reading: 0});
  });
});

describe('the last word of an ayah', () => {
  it('calls a changed last word followed by a long pause changed', () => {
    const r = drive(changedIn1([9]), deps, {config: BAR});
    expect(r.broken).toEqual([]);
    expect(finalBad(r)).toEqual(bad(9));
  });

  // No pause before the next ayah: 0.12 s of quiet is under pauseSeconds (0.2 s). With
  // no quiet at all the last look is cut 3 frames before the next ayah's first word,
  // which falls inside the last letter here; the fake model then squeezes the word to
  // one frame a letter, the gap is a hair under 15 nats, and the bar is lowered.
  const cutShort = (gap: number) =>
    take()
      .sayAyah(1, 1, A10, {replace: oneOffAt(A10, [9])})
      .quiet(gap)
      .sayAyah(1, 2, A8)
      .quiet(1)
      .sayAyah(1, 3, B8);
  const cases: [number, Partial<LiveConfig>][] = [
    [0.12, {pauseSeconds: 0.2}],
    [0, {pauseSeconds: 0.2, changedGap: 10, strongTimes: 1}],
  ];

  it.each(cases)(
    'with judgeCutShort on and %s s before the next ayah, calls a changed last word on the ayah’s last look',
    (gap, extra) => {
      const lines: LiveProbe[] = [];
      const r = drive(cutShort(gap), deps, {
        config: {...BAR, ...extra, judgeCutShort: true},
        watch: {probe: line => line.key === '1:1:9' && lines.push(line)},
      });
      expect(r.broken).toEqual([]);
      expect(finalBad(r)).toEqual(bad(9));
      // It was settled on the ayah's last look.
      expect(lines.filter(l => l.final).map(l => l.closing)).toEqual([true]);
    },
  );

  it.each(cases)(
    'with judgeCutShort off and %s s before the next ayah, does not call it',
    (gap, extra) => {
      const r = drive(cutShort(gap), deps, {
        config: {...BAR, ...extra, judgeCutShort: false},
      });
      expect(r.broken).toEqual([]);
      expect(anyBad(r)).toEqual([]);
    },
  );
});

describe('a word before a breath', () => {
  // 1:2 opens with a two-letter word, said after a short pause and followed by a
  // longer one, then the rest of the ayah.
  const first = madeUpWord(901, 2);
  const next = [first, ...madeUpAyah(35, 7)];
  const breathDeps = depsOf({1: [A10, next, B8]});
  const rest = next
    .slice(1)
    .map((w, i) => [`1:2:${i + 1}`, w] as [string, string]);

  it.each([
    [0.3, 1, false],
    [0.2, 1, false],
    [0.4, 1.2, false],
    [0.3, 1, true],
    [0.25, 0.8, true],
  ])(
    'calls no word of either ayah bad (%s s before the word, %s s after it, one utterance: %s)',
    (before, after, oneUtterance) => {
      const tl = take().sayAyah(1, 1, A10).quiet(before);
      if (oneUtterance) {
        tl.say([['1:2:0', first], ['#pause', after], ...rest]);
      } else {
        tl.say([['1:2:0', first]])
          .quiet(after)
          .say(rest);
      }
      tl.quiet(1).sayAyah(1, 3, B8);
      const r = drive(tl, breathDeps);
      expect(r.broken).toEqual([]);
      expect(anyBad(r)).toEqual([]);
      // Both ayat were judged, not skipped.
      expect(
        keysOf(1, 1, 10).filter(k => r.finalOf(k)?.verdict !== 'fine'),
      ).toEqual([]);
      expect(
        keysOf(1, 2, 8)
          .slice(3)
          .filter(k => r.finalOf(k)?.verdict !== 'fine'),
      ).toEqual([]);
    },
  );
});

describe('an ayah begun at its second word (handoverSkipFirst)', () => {
  const tl = () =>
    take()
      .sayAyah(1, 1, A10)
      .quiet(0.3)
      .sayAyah(1, 2, A8, {only: [1, 2, 3, 4, 5, 6, 7]})
      .quiet(1)
      .sayAyah(1, 3, B8);

  it('with the option on, makes the first word left out final missed and nothing else bad', () => {
    const r = drive(tl(), deps, {config: {...BAR, handoverSkipFirst: true}});
    expect(r.broken).toEqual([]);
    expect(r.finalOf('1:2:0')).toEqual({verdict: 'missed', reading: 0});
    expect(anyBad(r)).toEqual(['1:2:0#0 missed']);
  });

  it('with the option off, calls nothing bad', () => {
    const r = drive(tl(), deps, {config: {...BAR, handoverSkipFirst: false}});
    expect(r.broken).toEqual([]);
    expect(anyBad(r)).toEqual([]);
  });
});

describe('twin ayat', () => {
  // 1:2 and 1:3 are alike but for word 4, after an ayah unlike them.
  const twin = madeUpAyah(5, 8);
  const twin2 = [...twin];
  twin2[4] = madeUpAyah(6, 8)[4];
  const text = [madeUpAyah(1, 6), twin, twin2, madeUpAyah(7, 6)];
  const twinDeps = depsOf({1: text});
  const read = (gap: number, second: Record<number, string> = {}) =>
    take()
      .sayAyah(1, 1, text[0])
      .quiet(1)
      .sayAyah(1, 2, twin)
      .quiet(gap)
      .sayAyah(1, 3, twin2, {replace: second})
      .quiet(1)
      .sayAyah(1, 4, text[3]);

  it.each([0.3, 0.6, 1])(
    'calls nothing bad when both are read right (%s s between), and reads each word of the first twin once',
    gap => {
      const r = drive(read(gap), twinDeps);
      expect(r.broken).toEqual([]);
      expect(anyBad(r)).toEqual([]);
      const ids = [...r.finals.keys()].filter(id => id.startsWith('1:2:'));
      expect(ids.sort()).toEqual(
        keysOf(1, 2, 8)
          .map(k => `${k}#0`)
          .sort(),
      );
      expect(
        keysOf(1, 2, 8).filter(k => r.finalOf(k)?.verdict !== 'fine'),
      ).toEqual([]);
    },
  );

  it.each([0.3, 0.6])(
    'reads each word of the first twin once when the reader runs on into the second (%s s between, one utterance)',
    gap => {
      const tl = take()
        .sayAyah(1, 1, text[0])
        .quiet(1)
        .say([
          ...twin.map((w, i) => [`1:2:${i}`, w] as [string, string]),
          ['#pause', gap],
          ...twin2.map((w, i) => [`1:3:${i}`, w] as [string, string]),
        ])
        .quiet(1)
        .sayAyah(1, 4, text[3]);
      const r = drive(tl, twinDeps);
      expect(r.broken).toEqual([]);
      expect(anyBad(r)).toEqual([]);
      const ids = [...r.finals.keys()].filter(id => id.startsWith('1:2:'));
      expect(ids.filter(id => !id.endsWith('#0'))).toEqual([]);
    },
  );

  it.each([0.3, 1])(
    'calls the differing word of the second twin changed when another word is said there (%s s between)',
    gap => {
      const r = drive(read(gap, {4: shifted(twin2[4])}), twinDeps);
      expect(r.broken).toEqual([]);
      expect(anyBad(r)).toEqual(['1:3:4#0 changed']);
    },
  );

  // Meant, not a bug: the word said is the first twin's word 4, a word of the ayah
  // before, and a word heard as a word of a neighbouring ayah gets no verdict. The
  // check cannot tell a reader who mixed two neighbouring ayat from its own place
  // being one ayah off, and the follower's marks cover that reader.
  it.each([0.3, 1])(
    'gives no verdict when the first twin’s word is said in the second twin, the ayah after it (%s s between)',
    gap => {
      const r = drive(read(gap, {4: twin[4]}), twinDeps);
      expect(r.broken).toEqual([]);
      expect(anyBad(r)).toEqual([]);
      expect(r.finalOf('1:3:4')).toBeNull();
    },
  );
});

describe('a five-minute take', () => {
  /** A seeded generator (a linear congruential one, as in madeUpWord). */
  const generator = (seed: number) => {
    let x = (seed * 2654435761) % 4294967296;
    return () => {
      x = (x * 1664525 + 1013904223) % 4294967296;
      return x / 4294967296;
    };
  };

  it.each([1, 2, 3])(
    'keeps its promises and marks only changed words or their neighbours (seed %s)',
    seed => {
      const rnd = generator(seed);
      const text = Array.from({length: 80}, (_, a) =>
        madeUpAyah(100 + a, 5 + Math.floor(rnd() * 6), 4, 7),
      );
      const tl = take();
      const changed = new Set<string>();
      // Pauses of 0.2 to 1.2 s.
      const pause = () => 0.2 + Math.round(rnd() * 10) / 10;
      let a = 0;
      let repeats = 0;
      while (tl.f.length < 300 / 0.04) {
        const words = text[a];
        const replace: Record<number, string> = {};
        if (rnd() < 0.35) {
          const w = Math.floor(rnd() * words.length);
          replace[w] = rnd() < 0.5 ? shifted(words[w]) : oneOff(words[w]);
          changed.add(`1:${a + 1}:${w}`);
        }
        tl.sayAyah(1, a + 1, words, {replace}).quiet(pause());
        if (rnd() < 0.15) {
          // The reader goes back and reads the ayah again, right.
          tl.sayAyah(1, a + 1, words).quiet(pause());
          repeats += 1;
        }
        a += 1;
      }
      expect(tl.f.length * 0.04).toBeGreaterThanOrEqual(300);
      expect(repeats).toBeGreaterThan(0);
      expect(changed.size).toBeGreaterThan(5);

      const r = drive(tl, depsOf({1: text}));
      expect(r.broken).toEqual([]);
      const keyOf = (line: string) => line.split('#')[0];
      const near = (key: string) => {
        const [s, ay, w] = key.split(':').map(Number);
        return [w - 1, w, w + 1].some(k => changed.has(`${s}:${ay}:${k}`));
      };
      // Every final bad verdict is on a changed word or its direct neighbour.
      expect(finalBad(r).filter(b => !near(keyOf(b)))).toEqual([]);
      // No word far from a change gets a bad opinion, final or not.
      expect(anyBad(r).filter(b => !near(keyOf(b)))).toEqual([]);
      // And the take is not empty of verdicts: at least half the changes are caught.
      const caught = [...changed].filter(k =>
        finalBad(r).some(b => keyOf(b) === k),
      );
      expect(caught.length).toBeGreaterThanOrEqual(changed.size / 2);
    },
    60000,
  );
});
