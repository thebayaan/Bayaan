// What the engine wrapper reports for the three word fixes, on a fake session with
// the real corpus class and cost table over a made-up corpus. Nothing here is Quran
// text.
import followerConstants from '../followerConstants.npl.json';
import type {EngineMessage, WordVerdictsMessage} from '../recitationEngine';

const W = {a: 'بَتَك', b: 'لَمَس', c: 'نَدَف', d: 'رَجَط', extra: 'سَقَب'};

function makeCorpus() {
  const {QuranCorpus} = jest.requireActual(
    '../../../node_modules/@tilawa/core/dist/recitation/corpus.js',
  );
  const word = (ph: string) => ['g', ph, 'p'];
  return new QuranCorpus({
    v: 2,
    surahs: Array.from({length: 114}, (_, i) => ({
      n: i + 1,
      name: 's',
      nameEn: 's',
      ayahs:
        i === 0
          ? [{n: 1, m: '', w: [W.a, W.b, W.c, W.d].map(word)}]
          : [{n: 1, m: '', w: [word(W.extra)]}],
    })),
  });
}

const mockSession = {
  correction: {state: {phase: 'idle'}},
  corpus: makeCorpus(),
  feed: jest.fn(async () => []),
  stop: jest.fn(async () => []),
  reset: jest.fn(() => []),
  setHint: jest.fn(),
  setMode: jest.fn(() => []),
  setExpected: jest.fn(),
  setStructural: jest.fn(async () => undefined),
  correct: jest.fn(() => []),
  verdicts: jest.fn((): unknown[] => []),
  wordCount: jest.fn(() => 4),
  readMelFrames: jest.fn((from: number, to: number) => ({
    first: from,
    frames: to - from,
    data: new Float32Array((to - from) * 80),
  })),
  wordFrames: jest.fn(
    (_s: number, _a: number, _w: number) =>
      ({from: 12, to: 30}) as {from: number; to: number} | null,
  ),
};
const mockCreate = jest.fn(
  async (_opts: {onEvent: (msg: unknown) => void}) => mockSession,
);

jest.mock(
  '@tilawa/core',
  () => ({
    createZipformerSession: (opts: {onEvent: (msg: unknown) => void}) =>
      mockCreate(opts),
    DEFAULT_STRUCTURAL: {},
    costTable: jest.requireActual(
      '../../../node_modules/@tilawa/core/dist/recitation/phonemeCost.js',
    ).costTable,
  }),
  {virtual: true},
);
jest.mock('onnxruntime-react-native', () => {
  class Tensor {}
  return {
    Tensor,
    InferenceSession: {
      create: jest.fn(async () => ({
        run: jest.fn(async () => ({})),
        release: jest.fn(async () => undefined),
      })),
    },
  };
});
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(async () => '{}'),
}));

import {createRecitationEngine} from '../recitationEngine';

const ASSETS = {modelPath: 'file:///m.onnx', corpusPath: 'file:///c.json'};
const pcm = () => new Float32Array(7680);

function verdict(word: number, state: string, extra: object = {}) {
  return {surah: 1, ayah: 1, word, wordIndex: word, state, ...extra};
}

/** Each list is one chunk's verdicts. Returns what the listener heard. */
async function play(chunks: unknown[][]): Promise<WordVerdictsMessage[]> {
  const events: EngineMessage[] = [];
  const engine = await createRecitationEngine(ASSETS, msg => {
    events.push(msg);
  });
  // Lets the vocabulary finish building.
  await new Promise(resolve => setTimeout(resolve, 20));
  for (const list of chunks) {
    mockSession.verdicts.mockReturnValueOnce(list);
    engine.feed(pcm());
  }
  await engine.stop();
  return events.filter(
    (e): e is WordVerdictsMessage => e.type === 'word_verdicts',
  );
}
const changes = (events: WordVerdictsMessage[]) =>
  events.flatMap(e => e.changes);

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.verdicts.mockReturnValue([]);
});

describe('the session it starts', () => {
  it('has the junction check and the gap report on, from the NPL file', async () => {
    await createRecitationEngine(ASSETS, () => undefined);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        junction: followerConstants.junction,
        config: expect.objectContaining({
          gapReport: followerConstants.gapReport,
        }),
      }),
    );
  });

  it('cuts its alignment at a long jump forward, as far as the NPL file says', async () => {
    await createRecitationEngine(ASSETS, () => undefined);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({cutAtJump: 10000}),
      }),
    );
    expect(followerConstants.engine.cutAtJump).toBe(10000);
  });
});

describe('scores on verdicts', () => {
  it('every judged verdict carries them, for what wakes the second judge', async () => {
    const [event] = await play([
      [
        verdict(0, 'ok', {gop: -1.7, heardRatio: 1, distance: 0}),
        verdict(1, 'unsure', {distance: 0.3}),
        verdict(2, 'pending'),
      ],
    ]);
    expect(event.changes[0].detail).toEqual({
      gop: -1.7,
      heardRatio: 1,
      distance: 0,
    });
    expect(event.changes[1].detail?.distance).toBe(0.3);
    expect(event.changes[2].detail).toBeUndefined();
  });
});

describe('the junction check', () => {
  it('unsaid on a verdict already reported is news, once', async () => {
    const events = await play([
      [verdict(3, 'skipped')],
      [verdict(3, 'skipped', {junctionMissing: true, junction: -9})],
      [verdict(3, 'skipped', {junctionMissing: true, junction: -9})],
    ]);
    expect(changes(events)).toHaveLength(2);
    expect(changes(events)[1]).toMatchObject({
      word: 3,
      state: 'skipped',
      repeat: true,
      detail: {junctionMissing: true},
    });
  });

  it('unsaid with a new state is a new verdict', async () => {
    const events = await play([
      [verdict(3, 'wrong')],
      [verdict(3, 'skipped', {junctionMissing: true})],
    ]);
    const second = changes(events)[1];
    expect(second.state).toBe('skipped');
    expect(second.repeat).toBeUndefined();
    expect(second.detail?.junctionMissing).toBe(true);
  });

  it('said on a skipped verdict is passed on, once, and no new verdict', async () => {
    const events = await play([
      [verdict(3, 'skipped')],
      [verdict(3, 'skipped', {junctionMissing: false})],
      [verdict(3, 'skipped', {junctionMissing: false})],
    ]);
    expect(changes(events)).toHaveLength(2);
    expect(changes(events)[1]).toMatchObject({
      repeat: true,
      detail: {junctionMissing: false},
    });
  });

  it('said on any other verdict is not reported at all', async () => {
    const events = await play([
      [verdict(3, 'wrong')],
      [verdict(3, 'wrong', {junctionMissing: false})],
      [verdict(3, 'unsure', {junctionMissing: false})],
    ]);
    expect(changes(events)).toHaveLength(2);
    for (const change of changes(events)) {
      expect(change.repeat).toBeUndefined();
      expect(change.detail).not.toHaveProperty('junctionMissing');
    }
  });

  it('a skipped verdict that arrives after said carries it', async () => {
    const events = await play([
      [verdict(3, 'wrong', {junctionMissing: false})],
      [verdict(3, 'skipped', {junctionMissing: false})],
    ]);
    expect(changes(events)[1].detail?.junctionMissing).toBe(false);
    expect(changes(events)[1].repeat).toBeUndefined();
  });

  it('a new tracker can find the same word unsaid again', async () => {
    const events = await play([
      [verdict(3, 'skipped', {junctionMissing: true})],
      [verdict(3, 'skipped')],
      [verdict(3, 'skipped', {junctionMissing: true})],
    ]);
    expect(changes(events).map(c => c.detail?.junctionMissing)).toEqual([
      true,
      true,
    ]);
  });
});

describe('added words', () => {
  const gap = (extra: object = {}) => ({
    from: 10,
    to: 15,
    chars: W.extra,
    prev: 'ك',
    fitL: 0,
    fitR: 0,
    leftWord: 0,
    noGap: -3,
    ...extra,
  });

  it('a run the rule passes is reported on the right word, as counts', async () => {
    const events = await play([[verdict(1, 'ok', {gap: gap()})]]);
    const [change] = changes(events);
    expect(change.addedBefore).toEqual({
      sounds: 5,
      noGap: -3,
      left: {surah: 1, ayah: 1, word: 0},
    });
    expect(JSON.stringify(events)).not.toContain(W.extra);
  });

  it('it can come on a verdict already reported, and only once', async () => {
    const events = await play([
      [verdict(1, 'ok')],
      [verdict(1, 'ok', {gap: gap()})],
      [verdict(1, 'ok', {gap: gap()})],
      [verdict(1, 'ok', {gap: gap({fitL: 0.1})})],
    ]);
    expect(changes(events)).toHaveLength(2);
    expect(changes(events)[1]).toMatchObject({
      repeat: true,
      addedBefore: {sounds: 5},
    });
  });

  it('a run the rule refuses is not reported', async () => {
    const events = await play([
      [verdict(1, 'ok', {gap: gap({noGap: -1})})],
      [verdict(1, 'ok', {gap: gap({noGap: -1})})],
    ]);
    expect(changes(events).every(c => !c.addedBefore)).toBe(true);
  });

  it('a run first seen in the chunk where the tracker locked is never marked', async () => {
    const events: EngineMessage[] = [];
    const engine = await createRecitationEngine(ASSETS, msg => {
      events.push(msg);
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    const {onEvent} = mockCreate.mock.calls[0][0];
    mockSession.feed.mockImplementationOnce(async () => {
      onEvent({
        type: 'debug',
        event: 'located',
        data: {surah: 1, ayah: 1, word: 0},
      });
      return [];
    });
    mockSession.verdicts
      .mockReturnValueOnce([verdict(1, 'ok', {gap: gap()})])
      .mockReturnValueOnce([verdict(1, 'ok', {gap: gap()})])
      .mockReturnValueOnce([verdict(2, 'ok', {gap: gap({from: 20})})]);
    engine.feed(pcm());
    engine.feed(pcm());
    engine.feed(pcm());
    await engine.stop();
    const found = events
      .filter((e): e is WordVerdictsMessage => e.type === 'word_verdicts')
      .flatMap(e => e.changes)
      .filter(c => c.addedBefore);
    // The next one, first seen later, is marked.
    expect(found.map(c => c.word)).toEqual([2]);
  });

  it('a lock in tracking mode holds back the next chunk too', async () => {
    // Correction mode starts after the lock's own chunk, so that chunk's runs are
    // first reported in the next one.
    const events: EngineMessage[] = [];
    const engine = await createRecitationEngine(ASSETS, msg => {
      events.push(msg);
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    const {onEvent} = mockCreate.mock.calls[0][0];
    mockSession.feed.mockImplementationOnce(async () => {
      onEvent({
        type: 'debug',
        event: 'located',
        data: {surah: 1, ayah: 1, word: 0},
      });
      engine.setMode('correction');
      return [];
    });
    mockSession.verdicts
      .mockReturnValueOnce([])
      .mockReturnValueOnce([verdict(1, 'ok', {gap: gap()})])
      .mockReturnValueOnce([verdict(1, 'ok', {gap: gap()})])
      .mockReturnValueOnce([verdict(2, 'ok', {gap: gap({from: 20})})]);
    engine.feed(pcm());
    engine.feed(pcm());
    engine.feed(pcm());
    engine.feed(pcm());
    await engine.stop();
    const found = events
      .filter((e): e is WordVerdictsMessage => e.type === 'word_verdicts')
      .flatMap(e => e.changes)
      .filter(c => c.addedBefore);
    expect(found.map(c => c.word)).toEqual([2]);
  });

  it('a run seen before the vocabulary is ready is judged when it is', async () => {
    const events: EngineMessage[] = [];
    const engine = await createRecitationEngine(ASSETS, msg => {
      events.push(msg);
    });
    mockSession.verdicts.mockReturnValueOnce([verdict(1, 'ok', {gap: gap()})]);
    engine.feed(pcm());
    await new Promise(resolve => setTimeout(resolve, 20));
    mockSession.verdicts.mockReturnValueOnce([verdict(1, 'ok', {gap: gap()})]);
    engine.feed(pcm());
    await engine.stop();
    const found = events
      .filter((e): e is WordVerdictsMessage => e.type === 'word_verdicts')
      .flatMap(e => e.changes)
      .filter(c => c.addedBefore);
    expect(found).toHaveLength(1);
  });

  it('a reset forgets what was reported', async () => {
    const events: EngineMessage[] = [];
    const engine = await createRecitationEngine(ASSETS, msg => {
      events.push(msg);
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    mockSession.verdicts.mockReturnValueOnce([verdict(1, 'ok', {gap: gap()})]);
    engine.feed(pcm());
    engine.reset();
    mockSession.verdicts.mockReturnValueOnce([verdict(1, 'ok', {gap: gap()})]);
    engine.feed(pcm());
    await engine.stop();
    const found = events
      .filter((e): e is WordVerdictsMessage => e.type === 'word_verdicts')
      .flatMap(e => e.changes)
      .filter(c => c.addedBefore);
    expect(found).toHaveLength(2);
  });
});

describe('what the second judge reads', () => {
  it('log-mel frames, at once, off the queue', async () => {
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    const span = engine.readMelFrames(100, 150);
    expect(span.first).toBe(100);
    expect(span.frames).toBe(50);
    expect(mockSession.readMelFrames).toHaveBeenCalledWith(100, 150);
    expect(mockSession.feed).not.toHaveBeenCalled();
  });

  it("a word's frames as the trackers know them now", async () => {
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    expect(engine.wordFrames({surah: 1, ayah: 1, word: 2})).toEqual({
      from: 12,
      to: 30,
    });
    expect(mockSession.wordFrames).toHaveBeenCalledWith(1, 1, 2);
  });

  it('says how many words an ayah has, for the slice', async () => {
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    mockSession.wordCount.mockClear();
    expect(engine.wordCount(2, 4)).toBe(4);
    expect(mockSession.wordCount).toHaveBeenCalledWith(2, 4);
  });

  it('when the cursor first entered an ayah, in seconds of audio', async () => {
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    const {onEvent} = mockCreate.mock.calls[0][0];
    expect(engine.ayahEnteredAt(1, 1)).toBeNull();
    mockSession.feed.mockImplementationOnce(async () => {
      onEvent({type: 'word_progress', surah: 1, ayah: 1, word_index: 0});
      return [];
    });
    mockSession.feed.mockImplementationOnce(async () => {
      onEvent({type: 'word_progress', surah: 1, ayah: 1, word_index: 1});
      return [];
    });
    engine.feed(pcm());
    engine.feed(pcm());
    await engine.stop();
    expect(engine.ayahEnteredAt(1, 1)).toBe(0.48);
    engine.reset();
    await engine.stop();
    expect(engine.ayahEnteredAt(1, 1)).toBeNull();
  });
});
