import {
  depsOf,
  drive,
  fakeModel,
  keysOf,
  madeUpAyah,
  shifted,
  Timeline,
  type Take,
} from '@/test-utils/liveCheckReader';
import {createLiveCheck} from '../check';

// The live check driven the way the app drives it: a tick every 48 log-mel frames, the
// follower's place, then plan() and step() up to three times with the same `heard`. A
// fake model reads a made-up recitation (test-utils/liveCheckReader.ts). Every run
// checks what the check promises on every opinion: a final opinion never changes,
// 'fine' is only ever final and never comes before the word was said, a reading
// number never goes back, and a plan stays inside the ten seconds the stream keeps.
//
// The thresholds are still being tuned, so these tests say what happens by the end of
// a take, not on which tick. Where a scenario leans on a threshold it is given here.

const S1 = [
  madeUpAyah(1, 8),
  madeUpAyah(2, 8),
  madeUpAyah(3, 6),
  madeUpAyah(4, 6),
];
const S2 = [madeUpAyah(21, 7), madeUpAyah(22, 7), madeUpAyah(23, 7)];
const deps = depsOf({1: S1, 2: S2});

/** A take starts with a little quiet before the first word. */
const take = () => new Timeline().quiet(0.6);

/** The check kept its promises, and called nothing bad. */
function expectClean(r: Take) {
  expect(r.broken).toEqual([]);
  expect(r.badKeys()).toEqual([]);
}

/** These words have a final 'fine'. */
function expectFine(r: Take, keys: string[]) {
  const notFine = keys.filter(k => r.finalOf(k)?.verdict !== 'fine');
  expect(notFine).toEqual([]);
}

/** The words of these places without any final verdict. */
const unjudged = (r: Take, keys: string[]) => keys.filter(k => !r.finalOf(k));

/** Final bad opinions, as surah:ayah:word#reading verdict. */
const finalBad = (r: Take) =>
  [...r.finals]
    .filter(([, v]) => v.verdict !== 'fine')
    .map(([id, v]) => `${id} ${v.verdict}`);

describe('a clean reading', () => {
  it('judges every word fine and final when a pause follows each ayah', () => {
    const tl = take().sayAyah(1, 1, S1[0]).quiet(1).sayAyah(1, 2, S1[1]);
    const r = drive(tl, deps);
    expectClean(r);
    expectFine(r, [...keysOf(1, 1, 8), ...keysOf(1, 2, 8)]);
  });

  it('calls nothing bad with only 0.2 s between ayat, and leaves the first two words of each later ayah unjudged', () => {
    // With no pause to cut in, a new ayah's window starts where the check guessed it
    // does, and its first `leftWords` words are context only.
    const tl = take()
      .sayAyah(1, 1, S1[0])
      .quiet(0.2)
      .sayAyah(1, 2, S1[1])
      .quiet(0.2)
      .sayAyah(1, 3, S1[2]);
    const r = drive(tl, deps, {config: {leftWords: 2, pauseSeconds: 0.2}});
    expectClean(r);
    const all = [...keysOf(1, 1, 8), ...keysOf(1, 2, 8), ...keysOf(1, 3, 6)];
    expect(unjudged(r, all)).toEqual(['1:2:0', '1:2:1', '1:3:0', '1:3:1']);
  });

  it('calls nothing bad in an ayah longer than the window, and judges nearly all of it', () => {
    const long = [madeUpAyah(1, 30), madeUpAyah(2, 6)];
    const tl = take()
      .sayAyah(1, 1, long[0], {letterFrames: 4})
      .quiet(1)
      .sayAyah(1, 2, long[1]);
    // Thirty slow words are about twenty seconds, two windows and more.
    expect(tl.endTick('1:1:29') * 0.48).toBeGreaterThan(2 * 9.6);
    const r = drive(tl, depsOf({1: long}), {
      config: {windowSeconds: 9.6, leftWords: 2},
    });
    expectClean(r);
    expect(unjudged(r, keysOf(1, 1, 30)).length).toBeLessThanOrEqual(6);
  });
});

describe('a last look that had to wait', () => {
  it('is given up once its window has left the ten seconds the stream keeps, and the check goes on', () => {
    // A long ayah ends, and from the run after the one that saw it end the model is
    // busy for a few ticks (the second look holds it): the ayah's last look is asked
    // for and never run. Its window is then older than the stream keeps.
    const long = [madeUpAyah(1, 30), madeUpAyah(2, 6), madeUpAyah(3, 6)];
    const tl = take()
      .sayAyah(1, 1, long[0], {letterFrames: 4})
      .quiet(0.6)
      .sayAyah(1, 2, long[1])
      .quiet(1)
      .sayAyah(1, 3, long[2]);
    const end = Math.ceil(tl.endTick('1:1:29'));
    let waited = 0;
    for (let first = end; first <= end + 3; first++) {
      for (const ticks of [2, 3, 4]) {
        const r = drive(tl, depsOf({1: long}), {
          failRun: (tick, round) =>
            (tick === first && round > 0) ||
            (tick > first && tick < first + ticks),
        });
        expect(r.broken).toEqual([]);
        expect(r.badKeys()).toEqual([]);
        expectFine(r, keysOf(1, 3, 6).slice(2));
        waited += 1;
      }
    }
    expect(waited).toBe(12);
  });
});

describe('a mistake', () => {
  const after = (tl: Timeline) => tl.quiet(1).sayAyah(1, 2, S1[1]);

  it('makes a word changed mid-ayah final changed, and nothing else bad', () => {
    const tl = after(
      take().sayAyah(1, 1, S1[0], {replace: {4: shifted(S1[0][4])}}),
    );
    const r = drive(tl, deps);
    expect(r.broken).toEqual([]);
    expect(r.finalOf('1:1:4')).toEqual({verdict: 'changed', reading: 0});
    expect(finalBad(r)).toEqual(['1:1:4#0 changed']);
    expect(r.badKeys().every(k => k.startsWith('1:1:4#'))).toBe(true);
  });

  it('makes a word left out mid-ayah final missed, and nothing else bad', () => {
    const tl = after(
      take().sayAyah(1, 1, S1[0], {only: [0, 1, 2, 3, 5, 6, 7]}),
    );
    const r = drive(tl, deps);
    expect(r.broken).toEqual([]);
    expect(r.finalOf('1:1:4')).toEqual({verdict: 'missed', reading: 0});
    expect(finalBad(r)).toEqual(['1:1:4#0 missed']);
    expectFine(r, ['1:1:3', '1:1:5', ...keysOf(1, 2, 8)]);
  });

  it('makes a changed first word after a pause final changed', () => {
    const tl = take()
      .sayAyah(1, 1, S1[0])
      .quiet(1)
      .sayAyah(1, 2, S1[1], {replace: {0: shifted(S1[1][0])}});
    const r = drive(tl, deps);
    expect(r.broken).toEqual([]);
    expect(r.finalOf('1:2:0')?.verdict).toBe('changed');
    expect(finalBad(r)).toEqual(['1:2:0#0 changed']);
  });

  it('makes a changed last word followed by a pause final changed', () => {
    const tl = after(
      take().sayAyah(1, 1, S1[0], {replace: {7: shifted(S1[0][7])}}),
    );
    const r = drive(tl, deps);
    expect(r.broken).toEqual([]);
    expect(r.finalOf('1:1:7')?.verdict).toBe('changed');
    expect(finalBad(r)).toEqual(['1:1:7#0 changed']);
  });

  it('settles a narrow gap only on a second run, and a plan stepped twice counts once', () => {
    // With a wide gap never enough alone, a 'changed' needs two runs that agree.
    const config = {strongTimes: 1000, persistRuns: 2};
    const build = () =>
      after(take().sayAyah(1, 1, S1[0], {replace: {4: shifted(S1[0][4])}}));
    const once = drive(build(), deps, {config});
    const twice = drive(build(), deps, {config, stepTwice: true});
    for (const r of [once, twice]) {
      expect(r.broken).toEqual([]);
      expect(r.finalOf('1:1:4')?.verdict).toBe('changed');
    }
    expect(once.seen.some(s => s.key === '1:1:4' && !s.final)).toBe(true);
    expect(twice.finals.get('1:1:4#0')?.tick).toBe(
      once.finals.get('1:1:4#0')?.tick,
    );
  });

  // A reader who changes or drops a word often spoils the one beside it, so the test
  // for sound words is on the run of words that did not read right, not on each word.
  it.each([
    [3, 4],
    [4, 5],
  ])(
    'calls two neighbouring words changed (%s and %s) when sound words stand on both sides of the pair',
    (a, b) => {
      const tl = after(
        take().sayAyah(1, 1, S1[0], {
          replace: {[a]: shifted(S1[0][a]), [b]: shifted(S1[0][b])},
        }),
      );
      const r = drive(tl, deps);
      expect(r.broken).toEqual([]);
      expect(r.badKeys().sort()).toEqual([
        `1:1:${a}#0 changed`,
        `1:1:${b}#0 changed`,
      ]);
    },
  );

  it('never calls a word bad that the model is known to misread, and still judges the rest', () => {
    const tl = after(
      take().sayAyah(1, 1, S1[0], {
        replace: {2: shifted(S1[0][2]), 5: shifted(S1[0][5])},
      }),
    );
    const blindDeps = {
      ...deps,
      blind: (surah: number, ayah: number, word: number) =>
        surah === 1 && ayah === 1 && word === 2,
    };
    const r = drive(tl, blindDeps);
    expect(r.broken).toEqual([]);
    expect(r.badKeys()).toEqual(['1:1:5#0 changed']);
    expect(r.finalOf('1:1:2')).toBeNull();
  });

  it('calls none of four neighbouring words changed: a run that long is the model lost, not the reader', () => {
    const tl = after(
      take().sayAyah(1, 1, S1[0], {
        replace: {
          2: shifted(S1[0][2]),
          3: shifted(S1[0][3]),
          4: shifted(S1[0][4]),
          5: shifted(S1[0][5]),
        },
      }),
    );
    const r = drive(tl, deps);
    expectClean(r);
  });

  it('makes a narrow gap final only after a run before it agreed, in the ayah’s last look too', () => {
    // Words near the end are often judged last in the look the ayah gets once it is
    // over; that look alone must not settle a narrow gap.
    const config = {strongTimes: 1000, persistRuns: 2};
    let finalsSeen = 0;
    for (const word of [5, 6]) {
      for (const gap of [0.4, 1]) {
        for (const missed of [false, true]) {
          const tl = take()
            .sayAyah(1, 1, S1[0], {
              only: missed
                ? [0, 1, 2, 3, 4, 5, 6, 7].filter(i => i !== word)
                : undefined,
              replace: missed ? {} : {[word]: shifted(S1[0][word])},
            })
            .quiet(gap)
            .sayAyah(1, 2, S1[1]);
          const r = drive(tl, deps, {config});
          expect(r.broken).toEqual([]);
          for (const [id, f] of r.finals) {
            if (f.verdict === 'fine') continue;
            finalsSeen += 1;
            const first = r.seen.findIndex(s => s.id === id);
            expect([id, r.seen[first].final]).toEqual([id, false]);
          }
        }
      }
    }
    expect(finalsSeen).toBeGreaterThan(0);
  });
});

describe('reading again', () => {
  /** Words 0-5, a pause, then back to word 3 and on to the end. */
  const backThree = (first: Record<number, string> = {}) =>
    take()
      .say([
        ...[0, 1, 2, 3, 4, 5].map(
          i => [`1:1:${i}`, first[i] ?? S1[0][i]] as [string, string],
        ),
        ['#pause', 0.8],
        ...[3, 4, 5, 6, 7].map(i => [`1:1:${i}`, S1[0][i]] as [string, string]),
      ])
      .quiet(1)
      .sayAyah(1, 2, S1[1]);

  it('follows a reader who pauses and goes back three words, numbering the readings 0 then 1', () => {
    const r = drive(backThree(), deps);
    expectClean(r);
    expect(r.finals.get('1:1:4#0')?.verdict).toBe('fine');
    for (const key of ['1:1:3', '1:1:4', '1:1:5']) {
      expect([key, r.finalOf(key)]).toEqual([
        key,
        {verdict: 'fine', reading: 1},
      ]);
    }
    expect([...r.finals.keys()].filter(id => /#[2-9]/.test(id))).toEqual([]);
    expectFine(r, [...keysOf(1, 1, 8), ...keysOf(1, 2, 8)]);
  });

  it('judges a word wrong in the first pass and right in the second on its newest reading', () => {
    const r = drive(backThree({4: shifted(S1[0][4])}), deps);
    expect(r.broken).toEqual([]);
    expect(r.finalOf('1:1:4')?.verdict).toBe('fine');
    expect(r.finalOf('1:1:4')?.reading).toBeGreaterThan(0);
    // The first reading may keep its mistake; nothing else is bad.
    expect(r.badKeys().filter(k => !k.startsWith('1:1:4#0 changed'))).toEqual(
      [],
    );
  });

  it('numbers an ayah read twice with 2 s between as readings 0 and 1, all fine', () => {
    const tl = take()
      .sayAyah(1, 1, S1[0])
      .quiet(2)
      .sayAyah(1, 1, S1[0])
      .quiet(1)
      .sayAyah(1, 2, S1[1]);
    const r = drive(tl, deps);
    expectClean(r);
    for (const key of keysOf(1, 1, 8)) {
      expect([key, r.finals.get(`${key}#0`)?.verdict]).toEqual([key, 'fine']);
      expect([key, r.finals.get(`${key}#1`)?.verdict]).toEqual([key, 'fine']);
    }
    expectFine(r, keysOf(1, 2, 8));
  });

  it('keeps a mistake in the first reading of an ayah, and passes the second', () => {
    const tl = take()
      .sayAyah(1, 1, S1[0], {replace: {3: shifted(S1[0][3])}})
      .quiet(2)
      .sayAyah(1, 1, S1[0])
      .quiet(1)
      .sayAyah(1, 2, S1[1]);
    const r = drive(tl, deps);
    expect(r.broken).toEqual([]);
    expect(r.finals.get('1:1:3#0')?.verdict).toBe('changed');
    expect(r.finals.get('1:1:3#1')?.verdict).toBe('fine');
    expect(finalBad(r)).toEqual(['1:1:3#0 changed']);
  });

  // An ayah read twice and then the next once. The window that waits for the next
  // ayah lays the second reading of the ayah before against the next ayah's text; that
  // must not count as a reading of its first word (it once did, and the one true
  // reading was then numbered 1).
  it('numbers the one reading of the next ayah’s first word 0', () => {
    const tl = take()
      .sayAyah(1, 1, S1[0])
      .quiet(2)
      .sayAyah(1, 1, S1[0])
      .quiet(1)
      .sayAyah(1, 2, S1[1]);
    const r = drive(tl, deps);
    expect(r.finalOf('1:2:0')).toEqual({verdict: 'fine', reading: 0});
  });
});

describe('twin ayat', () => {
  // Two ayat alike but for word 4, after an ayah unlike them.
  const twin = madeUpAyah(5, 8);
  const twin2 = [...twin];
  twin2[4] = madeUpAyah(6, 8)[4];
  const text = [madeUpAyah(1, 6), twin, twin2, madeUpAyah(7, 6)];
  const twinDeps = depsOf({1: text});
  const read = (lead: boolean, gap: number) => {
    const tl = take();
    if (lead) tl.sayAyah(1, 1, text[0]).quiet(1);
    return tl
      .sayAyah(1, 2, twin)
      .quiet(gap)
      .sayAyah(1, 3, twin2)
      .quiet(1)
      .sayAyah(1, 4, text[3]);
  };

  it.each([0.3, 0.6])(
    'calls nothing bad when both are read right with %s s between',
    gap => {
      const r = drive(read(true, gap), twinDeps);
      expectClean(r);
      expectFine(r, ['1:2:4', '1:3:4', ...keysOf(1, 4, 6)]);
    },
  );

  // With 0.3 s between, the second twin's start must not be taken as the first twin
  // read again (it once was: words 0-2 of 1:2 got a second final reading).
  it('gives the first twin’s words one reading each', () => {
    const r = drive(read(true, 0.3), twinDeps);
    const again = [...r.finals.keys()].filter(
      id => id.startsWith('1:2:') && !id.endsWith('#0'),
    );
    expect(again).toEqual([]);
  });

  // A take that starts on the first twin: the free start of the first window ties
  // between the first twin and the second's first words in its text, and the tie goes
  // to the furthest place. The check must stay on the first twin all the same (it once
  // moved to the second and judged its words while the reader was still in the first).
  it('judges the first twin, not the second, when the take starts on it', () => {
    const r = drive(read(false, 1), twinDeps, {
      lockAt: {surah: 1, ayah: 2, word: 0},
    });
    expect(r.broken).toEqual([]);
    expect(unjudged(r, keysOf(1, 2, 8)).length).toBeLessThanOrEqual(2);
  });
});

describe('the follower', () => {
  it('judges nothing before the word it relocated onto after being lost', () => {
    const tl = take()
      .sayAyah(1, 1, S1[0], {only: [0, 1, 2, 3, 4]})
      .quiet(0.8)
      .sayAyah(1, 3, S1[2])
      .quiet(1)
      .sayAyah(1, 4, S1[3]);
    const lostAt = Math.ceil(tl.endTick('1:1:4'));
    const relocatedAt = Math.ceil(tl.startTick('1:3:3'));
    const r = drive(tl, deps, {
      events: {
        [lostAt]: check => check.lost(),
        [relocatedAt]: check =>
          check.relocated({surah: 1, ayah: 3, word: 3}, relocatedAt * 0.48),
      },
    });
    expectClean(r);
    expect(
      r.seen.filter(s => ['1:3:0', '1:3:1', '1:3:2'].includes(s.key)),
    ).toEqual([]);
    expect(r.seen.some(s => s.key.startsWith('1:2:'))).toBe(false);
    expectFine(r, [...keysOf(1, 3, 6).slice(3), ...keysOf(1, 4, 6)]);
  });

  it.each([false, true])(
    'follows a jump to another surah (relocated: %s)',
    withLock => {
      const tl = take()
        .sayAyah(1, 1, S1[0])
        .quiet(1)
        .sayAyah(2, 1, S2[0])
        .quiet(1)
        .sayAyah(2, 2, S2[1]);
      const at = Math.ceil(tl.startTick('2:1:1'));
      const r = drive(tl, deps, {
        events: withLock
          ? {[at]: c => c.relocated({surah: 2, ayah: 1, word: 1}, at * 0.48)}
          : {},
      });
      expectClean(r);
      expectFine(r, [...keysOf(1, 1, 8), ...keysOf(2, 2, 7)]);
      // Nothing of surah 1 after it was left.
      const left = tl.startTick('2:1:0');
      expect(
        r.seen.filter(
          s => s.key.startsWith('1:') && s.tick > left && !r.finals.has(s.id),
        ),
      ).toEqual([]);
    },
  );
});

describe('the app’s calls', () => {
  const tl = take().sayAyah(1, 1, S1[0]).quiet(1).sayAyah(1, 2, S1[1]);
  const output = (from: number, to: number) => {
    const f0 = Math.floor(from / 4);
    const f1 = Math.floor(to / 4);
    return {logp: fakeModel(tl, f0, f1), frames: f1 - f0};
  };
  const started = () => {
    const check = createLiveCheck(deps);
    check.relocated({surah: 1, ayah: 1, word: 0}, 0);
    check.setPlace({surah: 1, ayah: 1, word: 0, totalWords: 8});
    return check;
  };

  it('says nothing for a stale plan or a plan stepped again', () => {
    const check = started();
    const stale = check.plan(480);
    const newest = check.plan(528) ?? check.plan(528);
    expect(stale).not.toBeNull();
    expect(newest).not.toBeNull();
    if (!stale || !newest) return;
    const old = output(stale.from, stale.to);
    expect(check.step(stale, old.logp, old.frames)).toEqual([]);
    const now = output(newest.from, newest.to);
    // The same plans on a check that has not moved on do give opinions.
    const fresh = started();
    const control = fresh.plan(480);
    expect([control?.from, control?.to]).toEqual([stale.from, stale.to]);
    if (control) {
      expect(fresh.step(control, old.logp, old.frames)).not.toEqual([]);
    }
    expect(check.step(newest, now.logp, now.frames)).not.toEqual([]);
    expect(check.step(newest, now.logp, now.frames)).toEqual([]);
  });

  it('keeps every plan inside the stream when plan() is asked again and again with no step()', () => {
    const check = started();
    for (let heard = 48; heard < 48 * 1000; heard += 48) {
      for (let n = 0; n < 4; n++) {
        const plan = check.plan(heard);
        if (!plan) break;
        expect(plan.to).toBeLessThanOrEqual(heard);
        expect(plan.from).toBeGreaterThanOrEqual(heard - 1000);
        expect(plan.from).toBeLessThan(plan.to);
      }
    }
  });

  it('carries on as before once runs that never came back stop', () => {
    const r = drive(
      take().sayAyah(1, 1, S1[0]).quiet(1).sayAyah(1, 2, S1[1]),
      deps,
      {planOnly: tick => tick < 10},
    );
    expectClean(r);
    expectFine(r, [...keysOf(1, 1, 8), ...keysOf(1, 2, 8)]);
  });

  it.each([6, 12, 25])(
    'calls nothing bad over a 3 s hole in the ticks from tick %s',
    from => {
      const holed = take()
        .sayAyah(1, 1, S1[0])
        .quiet(1)
        .sayAyah(1, 2, S1[1])
        .quiet(0.3)
        .sayAyah(1, 3, S1[2]);
      // Seven ticks of 0.48 s: heard jumps by more than three seconds.
      const r = drive(holed, deps, {skip: t => t >= from && t < from + 7});
      expectClean(r);
      // The ayah after the hole is judged from its third word on.
      expectFine(r, keysOf(1, 3, 6).slice(2));
    },
  );
});

describe('poor input', () => {
  const three = (gap: number) =>
    take()
      .sayAyah(1, 1, S1[0])
      .quiet(gap)
      .sayAyah(1, 2, S1[1])
      .quiet(gap)
      .sayAyah(1, 3, S1[2]);

  it.each([1, 0.2])(
    'calls nothing bad with no energy at all, %s s between ayat',
    gap => {
      const r = drive(three(gap), deps, {noEnergy: true});
      expectClean(r);
      // Without quiet an ayah ends only when the next one starts: the first is judged.
      expect(unjudged(r, keysOf(1, 1, 8))).toEqual([]);
    },
  );

  it('calls nothing bad when the model writes only blank for a few ticks', () => {
    const r = drive(three(1), deps, {
      modelAt: tick => ({blank: tick >= 8 && tick <= 10}),
    });
    expectClean(r);
    expectFine(r, [...keysOf(1, 1, 8), ...keysOf(1, 2, 8)]);
  });

  it('skips an ayah with no letters and picks up after it', () => {
    const tl = three(1).quiet(1).sayAyah(1, 4, S1[3]);
    const r = drive(tl, depsOf({1: [S1[0], null, S1[2], S1[3]]}));
    expectClean(r);
    expect(r.seen.some(s => s.key.startsWith('1:2:'))).toBe(false);
    expectFine(r, [...keysOf(1, 1, 8), ...keysOf(1, 4, 6)]);
  });

  it('judges the surah’s last ayah, then says nothing new through a minute of quiet', () => {
    const tl = take().sayAyah(1, 3, S1[2]).quiet(1).sayAyah(1, 4, S1[3]);
    const end = tl.endTick('1:4:5');
    const r = drive(tl, deps, {
      lockAt: {surah: 1, ayah: 3, word: 0},
      tailSeconds: 60,
    });
    expectClean(r);
    expectFine(r, [...keysOf(1, 3, 6), ...keysOf(1, 4, 6)]);
    const firstSeen = new Map<string, number>();
    for (const s of r.seen)
      if (!firstSeen.has(s.id)) firstSeen.set(s.id, s.tick);
    const late = [...firstSeen].filter(([, tick]) => tick > end + 20);
    expect(late).toEqual([]);
  });
});

describe('a long take', () => {
  it('keeps the time a tick takes flat over 60 minutes', () => {
    const text = Array.from({length: 600}, (_, a) =>
      madeUpAyah(a + 1, 6 + (a % 7)),
    );
    const tl = take();
    const ticks = 7500;
    for (let a = 0; tl.f.length < ticks * 12; a++) {
      tl.sayAyah(1, a + 1, text[a]).quiet(0.4 + (a % 4) * 0.3);
    }
    const times: number[] = [];
    const r = drive(tl, depsOf({1: text}), {
      onTick: (_tick, ms) => times.push(ms),
    });
    expect(r.ticks).toBeGreaterThanOrEqual(ticks);
    expectClean(r);
    const median = (list: number[]) => {
      const sorted = [...list].sort((x, y) => x - y);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const first = median(times.slice(0, 1000));
    const last = median(times.slice(-1000));
    // Shared, noisy machines: only a growth with the take's length would fail this.
    expect(last).toBeLessThan(3 * first + 1);
  }, 240000);
});
