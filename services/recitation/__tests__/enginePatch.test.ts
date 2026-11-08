// The patched engine itself, on real code from node_modules: the log-mel ring, the
// tracker's word places, the gap report and the junction check, over a made-up
// corpus and made-up model output. Nothing here is Quran text. What these do on real
// audio is measured on the bench (scripts/recitation-bench/stack).
import followerConstants from '../followerConstants.npl.json';

const DIST = '../../../node_modules/@tilawa/core/dist/recitation';
const {QuranCorpus} = jest.requireActual(`${DIST}/corpus.js`);
const {costTable} = jest.requireActual(`${DIST}/phonemeCost.js`);
const {DEFAULT_CONFIG} = jest.requireActual(`${DIST}/config.js`);
const {Tracker} = jest.requireActual(`${DIST}/tracker.js`);
const {VerdictTracer} = jest.requireActual(`${DIST}/verdicts.js`);
const {FramePosteriors, encodePhonemes} = jest.requireActual(
  `${DIST}/posteriors.js`,
);
const {BLANK_ID, VOCAB_SIZE} = jest.requireActual(`${DIST}/tokens.js`);
const {JunctionCheck} = jest.requireActual(`${DIST}/junction.js`);
const {MelFrames} = jest.requireActual(`${DIST}/melFrames.js`);
const {KaldiFbank} = jest.requireActual(`${DIST}/fbank.js`);
const {createZipformerSession, DEFAULT_ZIPFORMER_IO} = jest.requireActual(
  `${DIST}/session.js`,
);

// Made-up words, in the follower's phonemes.
const WORDS = [
  ['بَتَك', 'لَمَس', 'نَدَف', 'رَجَط'],
  ['غَزَق', 'شَهَل', 'حَصَر', 'كَتَب'],
  ['سَقَب', 'فَرَد'],
];
const EXTRA = 'زَرَع';
const ids = (word: string): number[] => encodePhonemes(word);

function makeCorpus(ayat: string[][] = WORDS) {
  const word = (ph: string) => ['g', ph, 'p'];
  return new QuranCorpus({
    v: 2,
    surahs: Array.from({length: 114}, (_, i) => ({
      n: i + 1,
      name: 's',
      nameEn: 's',
      ayahs:
        i === 0
          ? ayat.map((words, a) => ({n: a + 1, m: '', w: words.map(word)}))
          : [{n: 1, m: '', w: [word(EXTRA)]}],
    })),
  });
}

const CFG = {...DEFAULT_CONFIG, commitDwell: 2, wholeWordAtCut: true};
const table = costTable();

/** Model output where each listed token is near certain, in order. */
function postOf(tokens: number[], extraFrames = 0) {
  const rows: number[][] = [];
  const blank = () => {
    const row = new Array(VOCAB_SIZE).fill(-12);
    row[BLANK_ID] = -0.01;
    rows.push(row);
  };
  blank();
  for (const id of tokens) {
    const row = new Array(VOCAB_SIZE).fill(-12);
    row[id] = -0.01;
    rows.push(row);
    blank();
  }
  for (let i = 0; i < extraFrames; i++) blank();
  const post = new FramePosteriors(VOCAB_SIZE);
  post.push(Float32Array.from(rows.flat()), rows.length, 0);
  return post;
}

/** A tracker that heard this text, one sound a frame; a tracer over it. */
function traced(
  corpus: unknown,
  startWord: number,
  heard: string,
  post: unknown,
  config = CFG,
) {
  const tracker = new Tracker(corpus, table, 1, startWord, config);
  tracker.feed([...heard].map((ch, i) => ({ch, frame: i, margin: 1})));
  const tracer = new VerdictTracer(tracker, table, config);
  tracer.posteriors = post;
  return {tracker, tracer};
}

describe('the log-mel ring', () => {
  const frame = (n: number) => new Float32Array(80).fill(n);

  it('reads a span back, row by row, with its first frame', () => {
    const ring = new MelFrames();
    for (let n = 0; n < 50; n++) ring.push(frame(n));
    const got = ring.read(10, 20);
    expect(got.first).toBe(10);
    expect(got.frames).toBe(10);
    expect(got.data.length).toBe(800);
    expect(got.data[0]).toBe(10);
    expect(got.data[80 * 9 + 79]).toBe(19);
  });

  it('holds about the last 10 s and clips what has gone or not come', () => {
    const ring = new MelFrames();
    for (let n = 0; n < 1500; n++) ring.push(frame(n));
    const got = ring.read(100, 9999);
    expect(got.first).toBe(500);
    expect(got.frames).toBe(1000);
    expect(got.data[0]).toBe(500);
    expect(got.data[80 * 999]).toBe(1499);
  });

  it('reads across the wrap of the ring', () => {
    const ring = new MelFrames();
    for (let n = 0; n < 1100; n++) ring.push(frame(n));
    const got = ring.read(990, 1010);
    for (let i = 0; i < 20; i++) expect(got.data[i * 80]).toBe(990 + i);
  });

  it('moves on to a later frame, repeating the last one across the hole', () => {
    const ring = new MelFrames();
    for (let n = 0; n < 10; n++) ring.push(frame(n));
    ring.moveTo(13);
    ring.push(frame(13));
    const got = ring.read(8, 14);
    expect(got.first).toBe(8);
    expect(got.frames).toBe(6);
    expect([0, 1, 2, 3, 4, 5].map(i => got.data[i * 80])).toEqual([
      8, 9, 9, 9, 9, 13,
    ]);
  });

  it('moves on from nothing with nothing to repeat', () => {
    const ring = new MelFrames();
    ring.moveTo(100);
    expect(ring.read(0, 200).frames).toBe(0);
    ring.push(frame(1));
    expect(ring.read(0, 200)).toMatchObject({first: 100, frames: 1});
  });

  it('gives a copy, and nothing after a clear', () => {
    const ring = new MelFrames();
    ring.push(frame(7));
    const got = ring.read(0, 1);
    ring.push(frame(8));
    expect(got.data[0]).toBe(7);
    ring.clear();
    expect(ring.read(0, 10).frames).toBe(0);
  });
});

describe('the session', () => {
  class FakeTensor {
    constructor(
      readonly type: string,
      readonly data: Float32Array | BigInt64Array | Int32Array,
      readonly dims: readonly number[],
    ) {}
  }
  // A model that always says blank: the tracker never starts.
  const fakeModel = {
    async run(feeds: Record<string, FakeTensor>) {
      const out: Record<string, FakeTensor> = {};
      for (const [name, value] of Object.entries(feeds)) {
        if (name !== 'x') out[`new_${name}`] = value;
      }
      const frames = 12;
      const logp = new Float32Array(frames * DEFAULT_ZIPFORMER_IO.vocabSize);
      out.log_probs = new FakeTensor('float32', logp, [
        1,
        frames,
        DEFAULT_ZIPFORMER_IO.vocabSize,
      ]);
      return out;
    },
  };
  const make = (extra: object = {}) =>
    createZipformerSession({
      session: fakeModel,
      Tensor: FakeTensor,
      corpus: {
        v: 2,
        surahs: Array.from({length: 114}, (_, i) => ({
          n: i + 1,
          name: 's',
          nameEn: 's',
          ayahs: [{n: 1, m: '', w: [['g', 'بَتَك', 'p']]}],
        })),
      },
      structural: false,
      enableFallback: false,
      ...extra,
    });
  // A tone with a slow swell: frames that differ from each other.
  const wave = (n: number) =>
    Float32Array.from({length: n}, (_, i) =>
      Math.fround(
        0.2 * Math.sin(i * 0.05) * (1 + Math.sin(i * 0.0007)) +
          0.01 * Math.sin(i * 0.41),
      ),
    );

  it('keeps the same log-mel frames as one pass over the whole stream', async () => {
    const session = await make();
    const audio = wave(7680 * 20);
    for (let off = 0; off < audio.length; off += 7680) {
      await session.feed(audio.subarray(off, off + 7680));
    }
    const whole = new KaldiFbank().acceptWaveform(audio);
    const got = session.readMelFrames(whole.length - 800, whole.length);
    expect(got.first).toBe(whole.length - 800);
    expect(got.frames).toBe(800);
    for (let f = 0; f < got.frames; f++) {
      expect(got.data.subarray(f * 80, (f + 1) * 80)).toEqual(
        whole[got.first + f],
      );
    }
  });

  describe('when the decoder starts again (the engine went idle or finished a surah)', () => {
    const CHUNK = 7680;
    const CHUNKS_BEFORE = 10;
    const RESTART_SAMPLES = CHUNK * CHUNKS_BEFORE;
    const RESTART_FRAME = RESTART_SAMPLES / 160;

    async function restarted() {
      const session = await make();
      const audio = wave(CHUNK * (CHUNKS_BEFORE + 5));
      for (let i = 0; i < CHUNKS_BEFORE; i++) {
        await session.feed(audio.subarray(i * CHUNK, (i + 1) * CHUNK));
      }
      session.handle({type: 'idle', reason: 'silent'});
      for (let i = CHUNKS_BEFORE; i < CHUNKS_BEFORE + 5; i++) {
        await session.feed(audio.subarray(i * CHUNK, (i + 1) * CHUNK));
      }
      return {session, whole: new KaldiFbank().acceptWaveform(audio)};
    }

    function expectSameFrames(
      got: {first: number; frames: number; data: Float32Array},
      whole: Float32Array[],
    ) {
      for (let f = 0; f < got.frames; f++) {
        expect(got.data.subarray(f * 80, (f + 1) * 80)).toEqual(
          whole[got.first + f],
        );
      }
    }

    it('a read by stream number gets the new audio', async () => {
      const {session, whole} = await restarted();
      // The first new frame reflects at its edge, so it starts one on.
      const got = session.readMelFrames(RESTART_FRAME + 1, RESTART_FRAME + 200);
      expect(got.first).toBe(RESTART_FRAME + 1);
      expect(got.frames).toBe(199);
      expectSameFrames(got, whole);
    });

    it('the audio before it can still be read', async () => {
      const {session, whole} = await restarted();
      const got = session.readMelFrames(RESTART_FRAME - 100, RESTART_FRAME - 1);
      expect(got.first).toBe(RESTART_FRAME - 100);
      expect(got.frames).toBe(99);
      expectSameFrames(got, whole);
    });

    it('a read across it has no hole in its numbers', async () => {
      const {session} = await restarted();
      const got = session.readMelFrames(RESTART_FRAME - 50, RESTART_FRAME + 50);
      expect(got.first).toBe(RESTART_FRAME - 50);
      expect(got.frames).toBe(100);
      // The frame that spanned it repeats the last one before it.
      const row = (f: number) => got.data.subarray(f * 80, (f + 1) * 80);
      expect(row(49)).toEqual(row(48));
    });

    it('word places count on from the same clock', async () => {
      const {session} = await restarted();
      session.engine.tracer = {
        tracker: {firstWord: 0, heard: [{frame: 3}, {frame: 9}]},
        lastSpans: new Map([[0, {from: 0, to: 2, run: 0}]]),
        verdicts: () => [],
      };
      session.verdicts();
      expect(session.wordFrames(1, 1, 0)).toEqual({
        from: 3 + RESTART_SAMPLES / 640,
        to: 9 + RESTART_SAMPLES / 640,
      });
    });

    it('a full reset still counts from 0', async () => {
      const {session} = await restarted();
      session.reset();
      expect(session.readMelFrames(0, 10).frames).toBe(0);
      await session.feed(wave(CHUNK));
      expect(session.readMelFrames(0, 10).first).toBe(0);
      expect(session.readMelFrames(0, 10).frames).toBe(10);
      session.engine.tracer = {
        tracker: {firstWord: 0, heard: [{frame: 3}]},
        lastSpans: new Map([[0, {from: 0, to: 1, run: 0}]]),
        verdicts: () => [],
      };
      session.verdicts();
      expect(session.wordFrames(1, 1, 0)).toEqual({from: 3, to: 3});
    });
  });

  it('forgets them at a reset, and counts from 0 again', async () => {
    const session = await make();
    await session.feed(wave(7680));
    expect(session.readMelFrames(0, 10).frames).toBe(10);
    session.reset();
    expect(session.readMelFrames(0, 10).frames).toBe(0);
    await session.feed(wave(7680));
    expect(session.readMelFrames(0, 10).first).toBe(0);
  });

  it('knows no word place before a tracker has heard it, or for no such word', async () => {
    const session = await make();
    expect(session.wordFrames(1, 1, 0)).toBeNull();
    expect(session.wordFrames(1, 9, 0)).toBeNull();
    expect(session.wordFrames(1, 1, 9)).toBeNull();
  });

  it('reads word places from the newest tracker that heard them, then older ones', async () => {
    const session = await make();
    const corpus = session.corpus;
    const older = {
      tracker: {firstWord: 0, heard: [{frame: 3}, {frame: 9}]},
      lastSpans: new Map([[0, {from: 0, to: 2, run: 0}]]),
      verdicts: () => [],
    };
    const newer = {
      tracker: {firstWord: 0, heard: [{frame: 30}]},
      lastSpans: new Map(),
      verdicts: () => [],
    };
    session.engine.tracer = older;
    session.verdicts();
    expect(session.wordFrames(1, 1, 0)).toEqual({from: 3, to: 9});
    session.engine.tracer = newer;
    session.verdicts();
    expect(session.wordFrames(1, 1, 0)).toEqual({from: 3, to: 9});
    newer.lastSpans.set(0, {from: 0, to: 1, run: 0});
    expect(session.wordFrames(1, 1, 0)).toEqual({from: 30, to: 30});
    expect(corpus.wordCount).toBeGreaterThan(0);
  });

  it('leaves the verdicts alone with no junction option', async () => {
    const session = await make();
    expect(session.junction).toBeNull();
    const verdict = {wordIndex: 0, state: 'wrong'};
    session.engine.tracer = {
      tracker: {},
      lastSpans: new Map(),
      verdicts: () => [verdict],
    };
    expect(session.verdicts()).toEqual([verdict]);
  });

  it('runs the check in correction mode only, with the option', async () => {
    const session = await make({junction: followerConstants.junction});
    const apply = jest.spyOn(session.junction, 'apply').mockReturnValue([]);
    session.engine.tracer = {
      tracker: {},
      lastSpans: new Map(),
      verdicts: () => [],
    };
    session.verdicts();
    expect(apply).not.toHaveBeenCalled();
    session.setMode('correction');
    session.engine.tracer = {
      tracker: {},
      lastSpans: new Map(),
      verdicts: () => [],
    };
    session.verdicts();
    expect(apply).toHaveBeenCalledTimes(1);
  });
});

describe('the gap report', () => {
  const corpus = makeCorpus();
  const on = {...CFG, gapReport: followerConstants.gapReport};
  const w = (g: number): string => corpus.wordPhonemes(g);
  const post = postOf(new Array(40).fill(BLANK_ID));

  it('names the run between two words, on the right word', () => {
    const heard = w(0) + w(1) + EXTRA + w(2) + w(3) + w(4) + w(5);
    const {tracer} = traced(corpus, 0, heard, post, on);
    const out = tracer.verdicts(true, true);
    const withGap = out.filter((v: {gap?: unknown}) => v.gap);
    expect(withGap).toHaveLength(1);
    expect(withGap[0].wordIndex).toBe(2);
    expect(withGap[0].gap.chars).toBe(EXTRA);
    expect(withGap[0].gap.leftWord).toBe(1);
    expect(withGap[0].gap.fitL).toBe(0);
    expect(withGap[0].gap.fitR).toBe(0);
    expect(typeof withGap[0].gap.noGap).toBe('number');
    expect(withGap[0].gap.to - withGap[0].gap.from).toBe(EXTRA.length);
  });

  it('finds nothing on the words as written', () => {
    const heard = w(0) + w(1) + w(2) + w(3) + w(4) + w(5);
    const {tracer} = traced(corpus, 0, heard, post, on);
    expect(
      tracer.verdicts(true, true).filter((v: {gap?: unknown}) => v.gap),
    ).toEqual([]);
  });

  it('is off when not asked for, and without model output', () => {
    const heard = w(0) + w(1) + EXTRA + w(2) + w(3) + w(4) + w(5);
    const off = traced(corpus, 0, heard, post, CFG).tracer;
    expect(
      off.verdicts(true, true).filter((v: {gap?: unknown}) => v.gap),
    ).toEqual([]);
    const none = traced(corpus, 0, heard, null, on).tracer;
    expect(
      none.verdicts(true, true).filter((v: {gap?: unknown}) => v.gap),
    ).toEqual([]);
  });

  it("is left out of the engine's own calls, which do not read it", () => {
    const heard = w(0) + w(1) + EXTRA + w(2) + w(3) + w(4) + w(5);
    const {tracer} = traced(corpus, 0, heard, post, on);
    expect(tracer.verdicts(true).filter((v: {gap?: unknown}) => v.gap)).toEqual(
      [],
    );
    expect(
      tracer.verdicts(true, true).filter((v: {gap?: unknown}) => v.gap),
    ).toHaveLength(1);
  });

  it("works out a run's fit once, and reports the same value after", () => {
    const heard = w(0) + w(1) + EXTRA + w(2) + w(3) + w(4) + w(5);
    const {tracer} = traced(corpus, 0, heard, post, on);
    const spy = jest.spyOn(post, 'bestLogp');
    const gapOf = (): {noGap: number} =>
      tracer.verdicts(true, true).find((v: {gap?: {noGap: number}}) => v.gap)
        .gap;
    const first = gapOf();
    spy.mockClear();
    const again = gapOf();
    const withGaps = spy.mock.calls.length;
    spy.mockClear();
    tracer.verdicts(true);
    const without = spy.mock.calls.length;
    spy.mockRestore();
    expect(again.noGap).toBe(first.noGap);
    expect(withGaps).toBe(without);
  });

  it('the session hands it on', async () => {
    const heard = w(0) + w(1) + EXTRA + w(2) + w(3) + w(4) + w(5);
    const {tracer} = traced(corpus, 0, heard, post, on);
    const session = await createZipformerSession({
      session: {run: async () => ({})},
      Tensor: class {},
      corpus: {
        v: 2,
        surahs: Array.from({length: 114}, (_, i) => ({
          n: i + 1,
          name: 's',
          nameEn: 's',
          ayahs: [{n: 1, m: '', w: [['g', 'بَتَك', 'p']]}],
        })),
      },
      structural: false,
      enableFallback: false,
    });
    session.engine.tracer = tracer;
    const gaps = session
      .verdicts()
      .filter((v: {gap?: unknown}) => v.gap)
      .map((v: {gap: {chars: string}}) => v.gap.chars);
    expect(gaps).toEqual([EXTRA]);
  });

  it('keeps the spans it judged by', () => {
    const heard = w(0) + w(1) + w(2);
    const {tracer} = traced(corpus, 0, heard, post, on);
    tracer.verdicts(false);
    expect(tracer.lastSpans.get(1)).toMatchObject({
      from: w(0).length,
      to: w(0).length + w(1).length,
    });
    expect(tracer.recentSpans.get(1)).toEqual(tracer.lastSpans.get(1));
  });
});

describe("the tracer's last stretch", () => {
  const corpus = makeCorpus();
  const w = (g: number): string => corpus.wordPhonemes(g);
  const post = postOf(new Array(40).fill(BLANK_ID));

  it('is aligned once while nothing new is heard', () => {
    const {tracer} = traced(corpus, 0, w(0) + w(1) + w(2) + w(3), post);
    const align = jest.spyOn(tracer, 'alignSegment');
    const first = tracer.verdicts(false);
    expect(align).toHaveBeenCalledTimes(1);
    const second = tracer.verdicts(false);
    expect(align).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('is aligned again once something new is heard', () => {
    const {tracer, tracker} = traced(corpus, 0, w(0) + w(1) + w(2), post);
    const align = jest.spyOn(tracer, 'alignSegment');
    tracer.verdicts(false);
    tracker.feed([...w(3)].map((ch, i) => ({ch, frame: 30 + i, margin: 1})));
    tracer.verdicts(false);
    expect(align).toHaveBeenCalledTimes(2);
  });

  it('the settled call reads its own stretch', () => {
    const {tracer} = traced(corpus, 0, w(0) + w(1), post, {
      ...CFG,
      gapReport: undefined,
    });
    tracer.anchorAyahEnd = 3;
    const align = jest.spyOn(tracer, 'alignSegment');
    tracer.verdicts(false);
    tracer.verdicts(true);
    expect(align).toHaveBeenCalledTimes(2);
    const refTo = (call: number) =>
      (align.mock.calls[call][0] as {refTo: number}).refTo;
    expect(refTo(1)).toBeGreaterThan(refTo(0));
  });

  it('is aligned afresh after the tracker goes back', () => {
    const {tracer, tracker} = traced(corpus, 0, w(0) + w(1) + w(2), post);
    const align = jest.spyOn(tracer, 'alignSegment');
    tracer.verdicts(false);
    tracker.retract(2);
    tracker.feed(
      [...w(2).slice(-2)].map((ch, i) => ({ch, frame: 20 + i, margin: 1})),
    );
    tracer.verdicts(false);
    expect(align).toHaveBeenCalledTimes(2);
  });
});

describe('a long jump forward', () => {
  // 40 ayat of 8 words each: about 1,500 places in the text.
  const ayat = Array.from({length: 40}, () => [...WORDS[0], ...WORDS[1]]);
  const corpus = makeCorpus(ayat);
  const post = postOf(new Array(40).fill(BLANK_ID));
  const heard = corpus.wordPhonemes(0) + corpus.wordPhonemes(1);
  const FAR = 1000;
  const traced = (config = {...CFG, cutAtJump: 300}) => {
    const tracker = new Tracker(corpus, table, 1, 0, config);
    tracker.feed([...heard].map((ch, i) => ({ch, frame: i, margin: 1})));
    const tracer = new VerdictTracer(tracker, table, config);
    tracer.posteriors = post;
    return {tracer};
  };

  it('starts a new stretch, so the alignment stays small', () => {
    const {tracer} = traced();
    const segs = tracer.segment([1, 2, 3, 4, 5, 6, FAR, FAR + 1, FAR + 2]);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({heardFrom: 0, heardTo: 6, refTo: 6});
    expect(segs[1]).toMatchObject({heardFrom: 6, heardTo: 9, refTo: FAR + 2});
    expect(segs[1].refFrom).toBeGreaterThan(FAR - 10);
  });

  it('takes nothing heard before the jump into the new stretch', () => {
    const {tracer} = traced();
    const segs = tracer.segment([1, 2, 3, 4, 5, 6, 7, 8, FAR, FAR + 1]);
    expect(segs[1].contextFrom).toBe(segs[1].heardFrom);
  });

  it('stays in the same run', () => {
    const {tracer} = traced();
    const segs = tracer.segment([1, 2, 3, FAR, FAR + 1]);
    expect(segs.map((seg: {run: number}) => seg.run)).toEqual([0, 0]);
  });

  it('a shorter jump stays in one stretch', () => {
    const {tracer} = traced();
    expect(tracer.segment([1, 2, 3, 200, 201])).toHaveLength(1);
  });

  it('with no such option the stretch runs on, as the package has it', () => {
    const {tracer} = traced(CFG);
    expect(tracer.segment([1, 2, 3, FAR, FAR + 1])).toHaveLength(1);
  });
});

describe('the junction check', () => {
  const corpus = makeCorpus();
  const w = (g: number): string => corpus.wordPhonemes(g);
  const LAST = 3; // The last word of ayah 1.
  const check = () => new JunctionCheck(corpus, followerConstants.junction);

  it('an ayah-last word left out reads skipped, with the next word heard', () => {
    // The reader says the words before it, then goes straight on to the next ayah.
    const said = [0, 1, 2, 4, 5];
    const post = postOf(said.flatMap(g => ids(w(g))));
    const heard = said.map(w).join('');
    const {tracer} = traced(corpus, 0, heard, post);
    const out = check().apply(
      tracer,
      post,
      post.endFrame,
      tracer.verdicts(false),
    );
    const verdict = out.find((v: {wordIndex: number}) => v.wordIndex === LAST);
    expect(verdict.junctionMissing).toBe(true);
    expect(verdict.state).toBe('skipped');
    expect(verdict.junction).toBeLessThan(
      followerConstants.junction.llrMissing,
    );
  });

  it('stays quiet while the last word is being said', () => {
    const said = [0, 1, 2];
    const halfWord = ids(w(LAST)).slice(0, 2);
    const post = postOf([...said.flatMap(g => ids(w(g))), ...halfWord]);
    const heard = said.map(w).join('') + w(LAST).slice(0, 3);
    const {tracer} = traced(corpus, 0, heard, post);
    const out = check().apply(
      tracer,
      post,
      post.endFrame,
      tracer.verdicts(false),
    );
    expect(
      out.some((v: {junctionMissing?: boolean}) => v.junctionMissing === true),
    ).toBe(false);
  });

  it('finds a word said, once the next ayah has started and the verdict is not ok', () => {
    const said = [0, 1, 2, 3, 4, 5, 6];
    const post = postOf(said.flatMap(g => ids(w(g))));
    const heard = said.map(w).join('');
    const {tracer} = traced(corpus, 0, heard, post);
    const out = tracer.verdicts(false);
    out.find((v: {wordIndex: number}) => v.wordIndex === LAST).state = 'wrong';
    const after = check().apply(tracer, post, post.endFrame, out);
    const verdict = after.find(
      (v: {wordIndex: number}) => v.wordIndex === LAST,
    );
    expect(verdict.junctionMissing).toBe(false);
    expect(verdict.state).toBe('wrong');
  });

  it('decides nothing on a word heard ok', () => {
    const said = [0, 1, 2, 3, 4, 5, 6];
    const post = postOf(said.flatMap(g => ids(w(g))));
    const heard = said.map(w).join('');
    const {tracer} = traced(corpus, 0, heard, post);
    const out = check().apply(
      tracer,
      post,
      post.endFrame,
      tracer.verdicts(false),
    );
    const verdict = out.find((v: {wordIndex: number}) => v.wordIndex === LAST);
    expect(verdict.state).toBe('ok');
    expect(verdict.junctionMissing).toBeUndefined();
  });

  it('does not fire early when the two words open alike', () => {
    const alike = makeCorpus([
      ['بَتَك', 'لَمَس', 'نَدَف', 'رَجَطَن'],
      ['رَجَطَق', 'شَهَل'],
      ['سَقَب', 'فَرَد'],
    ]);
    const said = [0, 1, 2, 4, 5];
    const words = (g: number): string => alike.wordPhonemes(g);
    const post = postOf(said.flatMap(g => ids(words(g))));
    const {tracer} = traced(alike, 0, said.map(words).join(''), post);
    const verdicts = tracer.verdicts(false);
    const out = new JunctionCheck(alike, followerConstants.junction).apply(
      tracer,
      post,
      tracer.tracker.heard[tracer.tracker.heard.length - 1].frame,
      verdicts,
    );
    // Not decided on the early path; the late path needs the wait after crossing.
    expect(
      out.find((v: {wordIndex: number}) => v.wordIndex === LAST)
        ?.junctionMissing,
    ).toBeUndefined();
  });
});

describe('the structural rules at the end of a take', () => {
  const S = jest.requireActual(`${DIST}/structural.js`);
  // Five made-up ayat of four made-up words, in the follower's phonemes.
  const LETTERS = 'بتثجحخدذرزسشصضطظعغفقكلمن';
  const AYAT = Array.from({length: 5}, (_ayah, a) =>
    Array.from({length: 4}, (_word, w) => {
      const n = a * 4 + w;
      const c = (k: number) => LETTERS[(n * 7 + k * 5) % LETTERS.length];
      return `${c(0)}َ${c(1)}َ${c(2)}`;
    }),
  );
  const corpus = makeCorpus(AYAT);
  const INDEX = {pairs: {}, ident: []};
  const PASSAGE = AYAT.map((_, a) => [1, a + 1]);
  // Lower than the shipped 10, so that leaving out one short made-up word can pass.
  const RULE = {...S.SIMILAR_VERSE_RULE, drop: 3};
  const eligible = (c: unknown) => S.similarVerseEligible(c, RULE);
  type Cand = {
    slot: number;
    word: number;
    span: number;
    family: string;
    at: number | null;
  };

  /** The model's sounds for a reading of these ayat: one a char, a pause between ayat. */
  function reading(ayat: string[][]) {
    const tokens: {sym: string; frame: number; t: number}[] = [];
    let frame = 0;
    for (const words of ayat) {
      for (const w of words) {
        for (const sym of w) {
          tokens.push({sym, frame, t: frame / 25});
          frame += 2;
        }
        frame += 4;
      }
      frame += 30;
    }
    return {tokens, seconds: frame / 25};
  }
  // Ayat 1 to 4, the third word of ayah 2 left out; ayah 5 never read.
  const dropped = reading(
    AYAT.slice(0, 4).map((w, a) => (a === 1 ? w.filter((_, i) => i !== 2) : w)),
  );
  // Ayah 3 left out.
  const skipped = reading(AYAT.filter((_, a) => a !== 2));
  const candidates = (fitRule?: object) =>
    new S.StructuralRules(corpus, INDEX).similarVerseCandidates(
      dropped.tokens,
      PASSAGE,
      true,
      dropped.seconds,
      eligible,
      fitRule,
    ) as Cand[];

  it('times each candidate as the alignment over the whole passage does', () => {
    const timed = candidates().filter(c => c.at !== null);
    expect(timed.length).toBeGreaterThanOrEqual(4);
    const q = table.encode(dropped.tokens.map(t => t.sym).join(''));
    const dur = dropped.seconds + 2;
    for (const c of timed as (Cand & {loc: number; ayahD: number})[]) {
      const slot = AYAT[c.slot];
      const vw = [...slot.slice(0, c.word), ...slot.slice(c.word + c.span)];
      const words = AYAT.flatMap((w, t) => (t === c.slot ? vw : w));
      const starts = [0];
      for (const w of words) starts.push(starts[starts.length - 1] + w.length);
      const w0 = AYAT.slice(0, c.slot).reduce((n, w) => n + w.length, 0);
      const wi = w0 + c.word;
      const {last, rc} = S.alignPath(q, table.encode(words.join('')));
      const mean = (lo: number, hi: number) => {
        let sum = 0;
        for (let j = lo; j < hi; j++) sum += rc[j];
        return S.pyRound(sum / Math.max(1, hi - lo), 3);
      };
      const qi = wi < words.length ? last[starts[wi + 1] - 1] : -1;
      expect(c.at).toBe(
        qi >= 0 ? S.pyRound(dropped.tokens[qi].t, 2) : S.pyRound(dur, 2),
      );
      expect(c.loc).toBe(
        mean(
          starts[Math.max(w0, w0 + c.word - 1)],
          starts[Math.min(w0 + vw.length, wi + 1)],
        ),
      );
      expect(c.ayahD).toBe(mean(starts[w0], starts[w0 + vw.length]));
    }
  });

  it('with the pick rule, times only what the pick can choose, and picks the same', () => {
    const all = candidates();
    const some = candidates(RULE);
    const picks = S.similarVersePick(all, RULE);
    expect(picks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({slot: 1, word: 2, span: 1, family: 'drop'}),
      ]),
    );
    expect(S.similarVersePick(some, RULE)).toEqual(picks);
    expect(some.filter(c => c.at !== null).length).toBeLessThan(
      all.filter(c => c.at !== null).length,
    );
    some.forEach((c, i) =>
      expect(c).toEqual(
        c.at !== null ? all[i] : {...all[i], at: null, loc: null, ayahD: null},
      ),
    );
  });

  it('runs in steps, at once or with pauses between them, to the same result', async () => {
    const rules = () => new S.StructuralRules(corpus, INDEX);
    let pauses = 0;
    const sliced = await S.runStepsAsync(
      rules().similarVerseSteps(
        dropped.tokens,
        PASSAGE,
        true,
        dropped.seconds,
        eligible,
        RULE,
      ),
      async () => {
        pauses += 1;
      },
      0,
    );
    expect(sliced).toEqual(candidates(RULE));
    expect(pauses).toBeGreaterThan(5);
    const win = rules().ayahOrderWindow({surah: 1, ayah: 1, ayahEnd: 5}, null);
    const order = rules().ayahOrderCandidate(skipped.tokens, win);
    expect(order.jumps).toEqual([expect.objectContaining({surah: 1, ayah: 3})]);
    expect(
      await S.runStepsAsync(
        rules().ayahOrderSteps(skipped.tokens, win),
        () => Promise.resolve(),
        0,
      ),
    ).toEqual(order);
  });

  it('the session runs them in slices at the end of audio and raises what one pass raises', async () => {
    class Tensor {
      constructor(
        readonly type: string,
        readonly data: unknown,
        readonly dims: readonly number[],
      ) {}
    }
    const word = (ph: string) => ['g', ph, 'p'];
    const twin = async () => {
      const s = await createZipformerSession({
        session: {
          async run() {
            throw new Error('no audio in this test');
          },
        },
        Tensor,
        corpus: {
          v: 2,
          surahs: Array.from({length: 114}, (_, i) => ({
            n: i + 1,
            name: 's',
            nameEn: 's',
            ayahs:
              i === 0
                ? AYAT.map((w, a) => ({n: a + 1, m: '', w: w.map(word)}))
                : [{n: 1, m: '', w: [word(EXTRA)]}],
          })),
        },
        structural: {
          ayahOrder: true,
          similarVerse: true,
          timing: 'stop',
          index: INDEX,
        },
        enableFallback: false,
      });
      s.setMode('correction');
      s.setExpected({surah: 1, ayah: 1, ayahEnd: 5});
      s.st.tokens = skipped.tokens;
      s.st.samples = Math.round(skipped.seconds * 16000);
      s.st.final = true;
      return s;
    };
    const once = await twin();
    const sliced = await twin();
    const raised = once.structuralTick(true);
    expect(once.st.skips).toEqual([{surah: 1, ayah: 3}]);
    expect(raised).toHaveLength(1);
    expect(await sliced.structuralTickFinal()).toEqual(raised);
    expect(sliced.st.skips).toEqual(once.st.skips);
    expect(sliced.st.pending).toEqual(once.st.pending);
  });
});
