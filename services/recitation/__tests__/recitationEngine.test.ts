import type {WorkerOutbound} from '@tilawa/core';

// A fake Tilawa session that records the order of calls and how many async
// calls were in flight at once, so the wrapper's queue can be checked.
const calls: string[] = [];
let inFlight = 0;
let maxInFlight = 0;

function asyncCall<T>(name: string, result: () => T, delayMs = 5) {
  return jest.fn(async (..._args: unknown[]): Promise<T> => {
    calls.push(name);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    inFlight -= 1;
    return result();
  });
}

function syncCall<T>(name: string, result: () => T) {
  return jest.fn((..._args: unknown[]): T => {
    calls.push(name);
    return result();
  });
}

const FINAL: WorkerOutbound[] = [
  {
    type: 'final_sequence',
    verses: [{surah: 1, ayah: 1, confidence: 0.9}],
    confidence: 0.9,
  },
];
const DEFERRED: WorkerOutbound[] = [
  {
    type: 'correction',
    state: {
      phase: 'idle',
      issue: null,
      resume: null,
      attempt: 0,
      outcome: 'deferred',
    },
    totalWords: 7,
  },
];

function flagMessage(ayah: number): WorkerOutbound {
  return {
    type: 'correction',
    state: {
      phase: 'error',
      issue: {
        surah: 18,
        ayah,
        word: 0,
        wordIndex: 0,
        kind: 'possible_skipped_ayah',
        source: 'ayah_order',
      },
      resume: null,
      attempt: 0,
      outcome: null,
    },
    totalWords: 9,
  };
}

const mockSession = {
  correction: {state: {phase: 'idle' as string}},
  feed: asyncCall('feed', () => [] as WorkerOutbound[], 20),
  stop: asyncCall('stop', () => FINAL),
  reset: syncCall('reset', () => [] as WorkerOutbound[]),
  setHint: syncCall('setHint', () => undefined),
  setMode: syncCall('setMode', () => [] as WorkerOutbound[]),
  setExpected: syncCall('setExpected', () => undefined),
  setStructural: asyncCall('setStructural', () => undefined),
  correct: syncCall('correct', () => DEFERRED),
  verdicts: jest.fn((): unknown[] => []),
  wordCount: jest.fn((_surah: number, _ayah: number) => 10),
};

function verdict(word: number, state: string) {
  return {surah: 67, ayah: 12, word, wordIndex: word, state};
}

// @tilawa/core ships ESM-only exports that Jest cannot resolve, so the mock
// is virtual.
jest.mock(
  '@tilawa/core',
  () => ({
    createZipformerSession: jest.fn(async () => mockSession),
    DEFAULT_STRUCTURAL: {ayahOrder: true, similarVerse: true},
  }),
  {virtual: true},
);

jest.mock('onnxruntime-react-native', () => {
  // The fake ONNX session returns no tensors, so Tensor is never built.
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

const {DEFAULT_STRUCTURAL: MOCK_DEFAULT_STRUCTURAL} = jest.requireMock<{
  DEFAULT_STRUCTURAL: object;
}>('@tilawa/core');

const ASSETS = {modelPath: 'file:///model.onnx', corpusPath: 'file:///c.json'};
const pcm = () => new Float32Array(7680);

beforeEach(() => {
  calls.length = 0;
  inFlight = 0;
  maxInFlight = 0;
  mockSession.correction.state.phase = 'idle';
  jest.clearAllMocks();
  mockSession.verdicts.mockReturnValue([]);
});

describe('createRecitationEngine', () => {
  it("stop resolves with the session's final messages", async () => {
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    await expect(engine.stop()).resolves.toEqual(FINAL);
  });

  it('queued calls run in order and never overlap', async () => {
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    engine.feed(pcm());
    engine.setMode('correction');
    engine.setExpected({surah: 2, ayah: 1, ayahEnd: 5});
    await engine.stop();
    expect(calls).toEqual(['feed', 'setMode', 'setExpected', 'stop']);
    expect(maxInFlight).toBe(1);
    expect(mockSession.setExpected).toHaveBeenCalledWith({
      surah: 2,
      ayah: 1,
      ayahEnd: 5,
    });
  });

  it('correct runs after queued audio and resolves with its messages', async () => {
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    engine.feed(pcm());
    await expect(engine.correct('review_later')).resolves.toEqual(DEFERRED);
    expect(calls).toEqual(['feed', 'correct']);
    expect(mockSession.correct).toHaveBeenCalledWith('review_later');
  });

  it('setStructural maps on and off to the session options', async () => {
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    engine.setStructural(true);
    engine.setStructural(false);
    await engine.stop();
    expect(mockSession.setStructural).toHaveBeenNthCalledWith(
      1,
      MOCK_DEFAULT_STRUCTURAL,
    );
    expect(mockSession.setStructural).toHaveBeenNthCalledWith(2, {
      ayahOrder: false,
      similarVerse: false,
    });
  });

  it('a failing feed sets stats.lastError and later calls still run', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockSession.feed.mockRejectedValueOnce(new Error('boom'));
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    engine.feed(pcm());
    await expect(engine.stop()).resolves.toEqual(FINAL);
    expect(engine.getStats().lastError).toBe('boom');
    warn.mockRestore();
  });

  it('stop after dispose resolves to []', async () => {
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    await engine.dispose();
    await expect(engine.stop()).resolves.toEqual([]);
    expect(mockSession.stop).not.toHaveBeenCalled();
  });

  it('stop defers an open issue so the take still flushes', async () => {
    mockSession.correction.state.phase = 'error';
    mockSession.correct.mockImplementationOnce(() => {
      mockSession.correction.state.phase = 'idle';
      return DEFERRED;
    });
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    await expect(engine.stop()).resolves.toEqual([...DEFERRED, ...FINAL]);
    expect(mockSession.correct).toHaveBeenCalledWith('review_later');
    expect(mockSession.correct.mock.invocationCallOrder[0]).toBeLessThan(
      mockSession.stop.mock.invocationCallOrder[0],
    );
  });

  it('stop drains every structural flag', async () => {
    mockSession.stop.mockImplementationOnce(async () => {
      mockSession.correction.state.phase = 'error';
      return [...FINAL, flagMessage(23)];
    });
    mockSession.correct
      .mockImplementationOnce(() => [...DEFERRED, flagMessage(24)])
      .mockImplementationOnce(() => {
        mockSession.correction.state.phase = 'idle';
        return DEFERRED;
      });
    const engine = await createRecitationEngine(ASSETS, () => undefined);
    await expect(engine.stop()).resolves.toEqual([
      ...FINAL,
      flagMessage(23),
      ...DEFERRED,
      flagMessage(24),
      ...DEFERRED,
    ]);
  });

  it('after each chunk it reports the words whose verdict changed', async () => {
    const events: unknown[] = [];
    const engine = await createRecitationEngine(ASSETS, msg => {
      events.push(msg);
    });
    // Feeds run later, in order: one verdict list per chunk.
    mockSession.verdicts
      .mockReturnValueOnce([verdict(0, 'ok'), verdict(1, 'pending')])
      .mockReturnValueOnce([
        verdict(0, 'ok'),
        verdict(1, 'wrong'),
        verdict(2, 'pending'),
      ]);
    engine.feed(pcm());
    engine.feed(pcm());
    await engine.stop();
    expect(events).toEqual([
      {
        type: 'word_verdicts',
        changes: [
          {surah: 67, ayah: 12, word: 0, totalWords: 10, state: 'ok'},
          {surah: 67, ayah: 12, word: 1, totalWords: 10, state: 'pending'},
        ],
      },
      {
        type: 'word_verdicts',
        changes: [
          {
            surah: 67,
            ayah: 12,
            word: 1,
            totalWords: 10,
            state: 'wrong',
            detail: {gop: null, heardRatio: null, distance: null},
          },
          {surah: 67, ayah: 12, word: 2, totalWords: 10, state: 'pending'},
        ],
      },
    ]);
    expect(mockSession.wordCount).toHaveBeenCalledWith(67, 12);
  });

  it('a chunk that changes no verdict reports nothing', async () => {
    const events: unknown[] = [];
    const engine = await createRecitationEngine(ASSETS, msg => {
      events.push(msg);
    });
    mockSession.verdicts.mockReturnValue([verdict(0, 'ok')]);
    engine.feed(pcm());
    engine.feed(pcm());
    await engine.stop();
    expect(events).toHaveLength(1);
  });

  it('reset forgets the verdicts, so a new take reports them again', async () => {
    const events: unknown[] = [];
    const engine = await createRecitationEngine(ASSETS, msg => {
      events.push(msg);
    });
    mockSession.verdicts.mockReturnValue([verdict(0, 'ok')]);
    engine.feed(pcm());
    engine.reset();
    engine.feed(pcm());
    await engine.stop();
    expect(events).toHaveLength(2);
  });

  it('judges each word after two more sounds, not six, so marks land sooner', async () => {
    await createRecitationEngine(ASSETS, () => undefined);
    const {createZipformerSession} = jest.requireMock<{
      createZipformerSession: jest.Mock;
    }>('@tilawa/core');
    expect(createZipformerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({commitDwell: 2}),
      }),
    );
  });

  it('judges a word cut by a 300-sound segment boundary from all of it', async () => {
    await createRecitationEngine(ASSETS, () => undefined);
    const {createZipformerSession} = jest.requireMock<{
      createZipformerSession: jest.Mock;
    }>('@tilawa/core');
    expect(createZipformerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({wholeWordAtCut: true}),
      }),
    );
  });

  it('a deferred flag keeps the tracker and the audio it heard', async () => {
    await createRecitationEngine(ASSETS, () => undefined);
    const {createZipformerSession} = jest.requireMock<{
      createZipformerSession: jest.Mock;
    }>('@tilawa/core');
    expect(createZipformerSession).toHaveBeenCalledWith(
      expect.objectContaining({keepContextOnDefer: true}),
    );
  });

  it("a wrong or skipped verdict carries the engine's scores behind it", async () => {
    const events: unknown[] = [];
    const engine = await createRecitationEngine(ASSETS, msg => {
      events.push(msg);
    });
    mockSession.verdicts.mockReturnValueOnce([
      {...verdict(0, 'ok'), gop: -0.2, heardRatio: 1, distance: 0},
      {...verdict(1, 'skipped'), gop: -13.4, heardRatio: 0, distance: 1},
      {...verdict(2, 'wrong'), heardRatio: 0.6, distance: 0.5},
    ]);
    engine.feed(pcm());
    await engine.stop();
    expect(events).toEqual([
      {
        type: 'word_verdicts',
        changes: [
          {surah: 67, ayah: 12, word: 0, totalWords: 10, state: 'ok'},
          {
            surah: 67,
            ayah: 12,
            word: 1,
            totalWords: 10,
            state: 'skipped',
            detail: {gop: -13.4, heardRatio: 0, distance: 1},
          },
          {
            surah: 67,
            ayah: 12,
            word: 2,
            totalWords: 10,
            state: 'wrong',
            detail: {gop: null, heardRatio: 0.6, distance: 0.5},
          },
        ],
      },
    ]);
  });

  it('verdicts from the chunk where the engine found the reader carry that word', async () => {
    const {createZipformerSession} = jest.requireMock<{
      createZipformerSession: jest.Mock;
    }>('@tilawa/core');
    let sessionEvent: (msg: WorkerOutbound) => void = () => undefined;
    createZipformerSession.mockImplementationOnce(
      async (opts: {onEvent: (msg: WorkerOutbound) => void}) => {
        sessionEvent = opts.onEvent;
        return mockSession;
      },
    );
    const events: {type: string; lock?: unknown}[] = [];
    const engine = await createRecitationEngine(ASSETS, msg => {
      events.push(msg);
    });
    mockSession.feed.mockImplementationOnce(async () => {
      sessionEvent({
        type: 'debug',
        event: 'located',
        at: 0,
        data: {type: 'located', surah: 67, ayah: 12, word: 3, replayed: 40},
      });
      return [];
    });
    mockSession.verdicts
      .mockReturnValueOnce([verdict(3, 'wrong')])
      .mockReturnValueOnce([verdict(3, 'wrong'), verdict(4, 'ok')]);
    engine.feed(pcm());
    engine.feed(pcm());
    await engine.stop();
    const batches = events.filter(e => e.type === 'word_verdicts');
    expect(batches[0].lock).toEqual({surah: 67, ayah: 12, word: 3});
    // The next chunk is judged from live audio.
    expect(batches[1].lock).toBeUndefined();
  });

  describe('a flag raised while listening', () => {
    // Tilawa's session hands everything it emits, correct()'s answers
    // included, to the onEvent it was created with.
    let sessionEvent: (msg: WorkerOutbound) => void = () => undefined;
    const flag = flagMessage(5);

    beforeEach(() => {
      const {createZipformerSession} = jest.requireMock<{
        createZipformerSession: jest.Mock;
      }>('@tilawa/core');
      createZipformerSession.mockImplementationOnce(
        async (opts: {onEvent: (msg: WorkerOutbound) => void}) => {
          sessionEvent = opts.onEvent;
          return mockSession;
        },
      );
      mockSession.feed.mockImplementationOnce(async () => {
        mockSession.correction.state.phase = 'error';
        sessionEvent(flag);
        return [flag];
      });
    });

    function deferClosesIt(): void {
      mockSession.correct.mockImplementationOnce(() => {
        mockSession.correction.state.phase = 'idle';
        for (const msg of DEFERRED) sessionEvent(msg);
        return DEFERRED;
      });
    }

    it('is answered with review_later before the next chunk is fed', async () => {
      deferClosesIt();
      const engine = await createRecitationEngine(ASSETS, () => undefined);
      engine.feed(pcm());
      engine.feed(pcm());
      await engine.stop();
      expect(mockSession.correct).toHaveBeenCalledTimes(1);
      expect(mockSession.correct).toHaveBeenCalledWith('review_later');
      const [firstFeed, nextFeed] = mockSession.feed.mock.invocationCallOrder;
      const [answer] = mockSession.correct.mock.invocationCallOrder;
      expect(answer).toBeGreaterThan(firstFeed);
      expect(answer).toBeLessThan(nextFeed);
    });

    it("is answered before that chunk's verdicts are read", async () => {
      deferClosesIt();
      const engine = await createRecitationEngine(ASSETS, () => undefined);
      engine.feed(pcm());
      await engine.stop();
      expect(mockSession.correct.mock.invocationCallOrder[0]).toBeLessThan(
        mockSession.verdicts.mock.invocationCallOrder[0],
      );
    });

    it('reaches the listener, and so does its answer, once each', async () => {
      deferClosesIt();
      const events: unknown[] = [];
      const engine = await createRecitationEngine(ASSETS, msg => {
        events.push(msg);
      });
      engine.feed(pcm());
      // Answered with its chunk, so the stop finds nothing left to defer.
      await expect(engine.stop()).resolves.toEqual(FINAL);
      expect(events).toEqual([flag, ...DEFERRED]);
    });

    it('a flag raised by deferring the first is deferred too', async () => {
      const second = flagMessage(6);
      mockSession.correct.mockImplementationOnce(() => {
        // Deferring runs the structural rules, which raise the next flag.
        for (const msg of [...DEFERRED, second]) sessionEvent(msg);
        return [...DEFERRED, second];
      });
      deferClosesIt();
      const events: unknown[] = [];
      const engine = await createRecitationEngine(ASSETS, msg => {
        events.push(msg);
      });
      engine.feed(pcm());
      await expect(engine.stop()).resolves.toEqual(FINAL);
      expect(mockSession.correct).toHaveBeenCalledTimes(2);
      expect(events).toEqual([flag, ...DEFERRED, second, ...DEFERRED]);
    });

    it('gives up on a flag that never closes after 64 answers, and the next chunk is still fed', async () => {
      let answersBeforeNextChunk = -1;
      mockSession.feed.mockImplementationOnce(async () => {
        answersBeforeNextChunk = mockSession.correct.mock.calls.length;
        mockSession.correction.state.phase = 'idle';
        return [];
      });
      const engine = await createRecitationEngine(ASSETS, () => undefined);
      engine.feed(pcm());
      engine.feed(pcm());
      await engine.stop();
      expect(answersBeforeNextChunk).toBe(64);
      expect(mockSession.correct).toHaveBeenCalledTimes(64);
    });
  });

  it('a relocation tags its chunk with the word it moved to', async () => {
    const {createZipformerSession} = jest.requireMock<{
      createZipformerSession: jest.Mock;
    }>('@tilawa/core');
    let sessionEvent: (msg: WorkerOutbound) => void = () => undefined;
    createZipformerSession.mockImplementationOnce(
      async (opts: {onEvent: (msg: WorkerOutbound) => void}) => {
        sessionEvent = opts.onEvent;
        return mockSession;
      },
    );
    const events: {type: string; lock?: unknown}[] = [];
    const engine = await createRecitationEngine(ASSETS, msg => {
      events.push(msg);
    });
    mockSession.feed.mockImplementationOnce(async () => {
      sessionEvent({
        type: 'debug',
        event: 'relocated',
        at: 0,
        data: {
          type: 'relocated',
          from: {surah: 67, ayah: 10, word: 2},
          to: {surah: 67, ayah: 12, word: 1},
        },
      });
      return [];
    });
    mockSession.verdicts.mockReturnValueOnce([verdict(1, 'skipped')]);
    engine.feed(pcm());
    await engine.stop();
    expect(events.find(e => e.type === 'word_verdicts')?.lock).toEqual({
      surah: 67,
      ayah: 12,
      word: 1,
    });
  });
});
