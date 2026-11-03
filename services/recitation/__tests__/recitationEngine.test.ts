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
};

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
});
