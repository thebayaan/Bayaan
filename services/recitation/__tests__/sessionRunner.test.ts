import * as mockRecitation from '@/test-utils/recitationMocks';
import {
  captureAppStateChange,
  correctionError,
  engineControl,
  finalSequence,
  flush,
  micControl,
  mockAnalytics,
  mockEngine,
  mockMic,
  mockPlayerPause,
  playerControl,
  recitationAssetsModule,
  recitationEngineModule,
  resetRecitationControls,
  verseMatch,
  wordProgress,
} from '@/test-utils/recitationMocks';
import type {SessionHandlers} from '../sessionRunner';

jest.mock(
  '@/services/recitation/recitationEngine',
  () => mockRecitation.recitationEngineModule,
);
jest.mock(
  '@/services/recitation/micStream',
  () => mockRecitation.micStreamModule,
);
jest.mock(
  '@/services/recitation/recitationAssets',
  () => mockRecitation.recitationAssetsModule,
);
jest.mock(
  '@/services/analytics/AnalyticsService',
  () => mockRecitation.analyticsModule,
);
jest.mock(
  '@/services/player/store/playerStore',
  () => mockRecitation.playerStoreModule,
);
jest.mock(
  '@/store/mushafPlayerStore',
  () => mockRecitation.mushafPlayerStoreModule,
);

type Runner = typeof import('../sessionRunner');
type Host = typeof import('../engineHost');

let runner: Runner;
let host: Host;
let appState: {fire: (next: string) => void};

function handlers(): jest.Mocked<SessionHandlers> {
  return {onUpdate: jest.fn(), onEvent: jest.fn(), onFinish: jest.fn()};
}

/** The statuses reported, with repeats in a row collapsed. */
function statuses(h: jest.Mocked<SessionHandlers>): string[] {
  const all = h.onUpdate.mock.calls.map(([update]) => update.status);
  return all.filter((status, i) => status !== all[i - 1]);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRecitationControls();
  appState = captureAppStateChange();
  jest.isolateModules(() => {
    runner = require('../sessionRunner');
    host = require('../engineHost');
  });
});

afterEach(async () => {
  await runner.stopSession('user');
  await host.unloadRecitationModel();
  jest.useRealTimers();
});

describe('sessionRunner', () => {
  it('a session loads the model, opens the mic and reports listening', async () => {
    const h = handlers();
    await expect(
      runner.startSession({purpose: 'follow', hint: {surah: 36, ayah: 1}}, h),
    ).resolves.toBe(true);
    expect(statuses(h)).toEqual(['loading', 'listening']);
    expect(h.onUpdate).toHaveBeenLastCalledWith({
      status: 'listening',
      modelWasLoaded: false,
    });
    expect(mockEngine.reset).toHaveBeenCalledTimes(1);
    expect(mockEngine.setHint).toHaveBeenCalledWith({surah: 36, ayah: 1});
    expect(runner.activeSessionPurpose()).toBe('follow');
  });

  it('starting identify while follow is active stops follow with superseded', async () => {
    const follow = handlers();
    const identify = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, follow);
    await runner.startSession({purpose: 'identify', hint: null}, identify);

    expect(follow.onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({status: 'off', reason: 'superseded'}),
    );
    expect(follow.onFinish).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'superseded', listened: true}),
    );
    expect(runner.activeSessionPurpose()).toBe('identify');
    expect(identify.onUpdate).toHaveBeenLastCalledWith({
      status: 'listening',
      modelWasLoaded: true,
    });

    engineControl.sendEvent?.(wordProgress(55, 13, 0, 3));
    expect(identify.onEvent).toHaveBeenCalledWith(wordProgress(55, 13, 0, 3));
    expect(follow.onEvent).not.toHaveBeenCalled();
  });

  it('stopSession flushes the engine and hands its messages to onFinish', async () => {
    const final = finalSequence([{surah: 1, ayah: 1, confidence: 0.9}]);
    mockEngine.stop.mockResolvedValueOnce([final]);
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    await runner.stopSession('user');

    expect(mockMic.stop).toHaveBeenCalledTimes(1);
    expect(h.onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({status: 'off', reason: 'user', listened: true}),
    );
    expect(h.onFinish).toHaveBeenCalledWith({
      messages: [final],
      reason: 'user',
      listened: true,
    });
    expect(runner.activeSessionPurpose()).toBeNull();
  });

  it('events the flush emits go to onFinish, not onEvent', async () => {
    mockEngine.stop.mockImplementationOnce(async () => {
      engineControl.sendEvent?.(verseMatch(1, 2));
      return [verseMatch(1, 2)];
    });
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    await runner.stopSession('user');
    expect(h.onEvent).not.toHaveBeenCalled();
    expect(h.onFinish).toHaveBeenCalledWith(
      expect.objectContaining({messages: [verseMatch(1, 2)]}),
    );
  });

  it('mic audio goes to the engine', async () => {
    await runner.startSession({purpose: 'follow', hint: null}, handlers());
    const pcm = new Float32Array(8);
    micControl.chunk?.(pcm, 16000);
    expect(mockEngine.feed).toHaveBeenCalledWith(pcm);
  });

  it('going to the background stops the session', async () => {
    const h = handlers();
    await runner.startSession({purpose: 'identify', hint: null}, h);
    appState.fire('background');
    await flush();
    expect(h.onFinish).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'background'}),
    );
    expect(runner.activeSessionPurpose()).toBeNull();
  });

  it('no audio for 3 s stops the session with mic_silent', async () => {
    jest.useFakeTimers();
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    await jest.advanceTimersByTimeAsync(4100);
    await flush();
    expect(h.onFinish).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'mic_silent', listened: true}),
    );
  });

  it('a denied microphone ends in a permission error without opening the mic', async () => {
    micControl.granted = false;
    const h = handlers();
    await expect(
      runner.startSession({purpose: 'identify', hint: null}, h),
    ).resolves.toBe(false);
    expect(h.onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'error',
        stage: 'permission',
        kind: 'permission',
        detail: 'denied',
      }),
    );
    const {startMicStream} = jest.requireMock(
      '@/services/recitation/micStream',
    );
    expect(startMicStream).not.toHaveBeenCalled();
    expect(runner.activeSessionPurpose()).toBeNull();
  });

  it('a first run downloads the model, then loads it', async () => {
    recitationAssetsModule.getRecitationAssets.mockResolvedValueOnce(
      null as never,
    );
    recitationAssetsModule.ensureRecitationAssets.mockImplementationOnce(
      async (onProgress: (progress: number) => void) => {
        onProgress(0.5);
        return {modelPath: 'file:///m.onnx', corpusPath: 'file:///c.json'};
      },
    );
    const h = handlers();
    await runner.startSession({purpose: 'identify', hint: null}, h);
    expect(statuses(h)).toEqual([
      'loading',
      'downloading',
      'loading',
      'listening',
    ]);
    expect(h.onUpdate).toHaveBeenCalledWith({
      status: 'downloading',
      progress: 0.5,
    });
    expect(mockAnalytics.trackRecitationModelDownloaded).toHaveBeenCalledWith(
      expect.objectContaining({outcome: 'completed', error_message: null}),
    );
  });

  it('a model that fails to load ends in a model_load error', async () => {
    recitationEngineModule.createRecitationEngine.mockRejectedValueOnce(
      new Error('bad model'),
    );
    const h = handlers();
    await expect(
      runner.startSession({purpose: 'follow', hint: null}, h),
    ).resolves.toBe(false);
    expect(h.onUpdate).toHaveBeenLastCalledWith({
      status: 'error',
      stage: 'model_load',
      message: 'bad model',
      detail: 'bad model',
      kind: 'other',
    });
    expect(runner.activeSessionPurpose()).toBeNull();
  });

  it('stop while the model loads never opens the mic', async () => {
    let release: () => void = () => undefined;
    engineControl.gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const h = handlers();
    const starting = runner.startSession({purpose: 'identify', hint: null}, h);
    await flush();
    await runner.stopSession('user');
    release();
    await expect(starting).resolves.toBe(false);
    const {startMicStream} = jest.requireMock(
      '@/services/recitation/micStream',
    );
    expect(startMicStream).not.toHaveBeenCalled();
    expect(h.onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({status: 'off', listened: false}),
    );
  });

  it("pauses Bayaan's own audio before opening the mic", async () => {
    playerControl.playing = true;
    await runner.startSession({purpose: 'identify', hint: null}, handlers());
    expect(mockPlayerPause).toHaveBeenCalledTimes(1);
  });

  it('the model stays loaded while a session runs', async () => {
    await runner.startSession({purpose: 'follow', hint: null}, handlers());
    await host.unloadRecitationModel();
    expect(mockEngine.dispose).not.toHaveBeenCalled();
    await runner.stopSession('user');
    await host.unloadRecitationModel();
    expect(mockEngine.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('sessionRunner holds', () => {
  it('a held session keeps the mic open but does not hear it', async () => {
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    expect(runner.holdSession()).toBe(true);
    expect(h.onUpdate).toHaveBeenLastCalledWith({status: 'paused'});
    micControl.chunk?.(new Float32Array(8), 16000);
    expect(mockEngine.feed).not.toHaveBeenCalled();
    expect(mockMic.stop).not.toHaveBeenCalled();
  });

  it('releasing the hold hears the mic again', async () => {
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    runner.holdSession();
    runner.releaseSession();
    expect(h.onUpdate).toHaveBeenLastCalledWith({status: 'resumed'});
    const pcm = new Float32Array(8);
    micControl.chunk?.(pcm, 16000);
    expect(mockEngine.feed).toHaveBeenCalledWith(pcm);
  });

  it('a hold does not end the take, however long it lasts', async () => {
    jest.useFakeTimers();
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    runner.holdSession();
    for (let i = 0; i < 100; i++) {
      micControl.chunk?.(new Float32Array(8), 16000);
      await jest.advanceTimersByTimeAsync(1000);
    }
    expect(h.onFinish).not.toHaveBeenCalled();
  });

  it('with no session there is nothing to hold', () => {
    expect(runner.holdSession()).toBe(false);
  });
});

describe('sessionRunner interruptions', () => {
  it('an interruption pauses the session and the watchdog does not fire while paused', async () => {
    jest.useFakeTimers();
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    micControl.interrupt?.('began');
    expect(h.onUpdate).toHaveBeenLastCalledWith({status: 'paused'});
    await jest.advanceTimersByTimeAsync(10_000);
    expect(h.onFinish).not.toHaveBeenCalled();
    expect(runner.activeSessionPurpose()).toBe('follow');
  });

  it('when the interruption ends the mic resumes and the session listens again', async () => {
    jest.useFakeTimers();
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    micControl.interrupt?.('began');
    micControl.interrupt?.('ended');
    await flush();
    expect(mockMic.resume).toHaveBeenCalledTimes(1);
    expect(h.onUpdate).toHaveBeenLastCalledWith({status: 'resumed'});
    // The watchdog is back: silence after the resume still stops the take.
    await jest.advanceTimersByTimeAsync(4100);
    expect(h.onFinish).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'mic_silent'}),
    );
  });

  it('no end within 60 s stops the session with interruption', async () => {
    jest.useFakeTimers();
    const h = handlers();
    await runner.startSession({purpose: 'identify', hint: null}, h);
    micControl.interrupt?.('began');
    await jest.advanceTimersByTimeAsync(59_000);
    expect(h.onFinish).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1100);
    expect(h.onFinish).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'interruption', listened: true}),
    );
  });

  it('a failed resume stops the session with interruption', async () => {
    mockMic.resume.mockRejectedValueOnce(new Error('input busy'));
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    micControl.interrupt?.('began');
    micControl.interrupt?.('ended');
    await flush();
    expect(h.onFinish).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'interruption'}),
    );
    expect(runner.activeSessionPurpose()).toBeNull();
  });

  it('an inactive app keeps listening; the background stops it', async () => {
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    appState.fire('inactive');
    await flush();
    expect(runner.activeSessionPurpose()).toBe('follow');
    appState.fire('background');
    await flush();
    expect(h.onFinish).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'background'}),
    );
  });
});

describe('sessionRunner overlapping starts and stops', () => {
  it('a start right after a stop waits for the flush, and the tail stays with the old session', async () => {
    let finishFlush: (msgs: never[]) => void = () => undefined;
    mockEngine.stop.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishFlush = resolve as (msgs: never[]) => void;
        }),
    );
    const first = handlers();
    const second = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, first);
    const stopping = runner.stopSession('user');
    const starting = runner.startSession(
      {purpose: 'follow', hint: null},
      second,
    );
    await flush();
    // The old flush is still running: the new session has not started.
    expect(second.onUpdate).not.toHaveBeenCalled();
    engineControl.sendEvent?.(wordProgress(2, 255, 3, 50));
    finishFlush([]);
    await stopping;
    await expect(starting).resolves.toBe(true);
    expect(first.onFinish).toHaveBeenCalledTimes(1);
    expect(second.onEvent).not.toHaveBeenCalled();
    expect(mockEngine.reset).toHaveBeenCalledTimes(2);
  });

  it('two starts during a superseding stop leave exactly one session and no open mic', async () => {
    await runner.startSession({purpose: 'follow', hint: null}, handlers());
    // A slow flush of the session being superseded opens the race window.
    let finishFlush: (msgs: never[]) => void = () => undefined;
    mockEngine.stop.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishFlush = resolve as (msgs: never[]) => void;
        }),
    );
    const b = handlers();
    const c = handlers();
    const startB = runner.startSession({purpose: 'identify', hint: null}, b);
    const startC = runner.startSession({purpose: 'identify', hint: null}, c);
    await flush();
    finishFlush([]);
    const [okB, okC] = await Promise.all([startB, startC]);
    expect([okB, okC].filter(Boolean)).toHaveLength(1);
    const {startMicStream} = jest.requireMock(
      '@/services/recitation/micStream',
    );
    // follow's mic, plus the one session that won; every other mic stopped.
    expect(
      startMicStream.mock.calls.length - mockMic.stop.mock.calls.length,
    ).toBe(1);
    expect(runner.activeSessionPurpose()).toBe('identify');
  });

  it('a session that goes to the background while the model loads never opens the mic', async () => {
    let release: () => void = () => undefined;
    engineControl.gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const h = handlers();
    const starting = runner.startSession({purpose: 'identify', hint: null}, h);
    await flush();
    appState.fire('background');
    await flush();
    release();
    await expect(starting).resolves.toBe(false);
    const {startMicStream} = jest.requireMock(
      '@/services/recitation/micStream',
    );
    expect(startMicStream).not.toHaveBeenCalled();
    expect(h.onFinish).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'background', listened: false}),
    );
  });

  it('a start while the model is still downloading shares that download', async () => {
    let finishDownload: () => void = () => undefined;
    recitationAssetsModule.getRecitationAssets.mockResolvedValue(null as never);
    recitationAssetsModule.ensureRecitationAssets.mockImplementation(
      () =>
        new Promise(resolve => {
          finishDownload = () =>
            resolve({
              modelPath: 'file:///m.onnx',
              corpusPath: 'file:///c.json',
            });
        }),
    );
    try {
      const first = runner.startSession(
        {purpose: 'identify', hint: null},
        handlers(),
      );
      await flush();
      await runner.stopSession('user');
      const second = runner.startSession(
        {purpose: 'identify', hint: null},
        handlers(),
      );
      await flush();
      finishDownload();
      await expect(first).resolves.toBe(false);
      await expect(second).resolves.toBe(true);
      expect(
        recitationAssetsModule.ensureRecitationAssets,
      ).toHaveBeenCalledTimes(1);
      expect(
        recitationEngineModule.createRecitationEngine,
      ).toHaveBeenCalledTimes(1);
    } finally {
      recitationAssetsModule.getRecitationAssets.mockReset();
      recitationAssetsModule.getRecitationAssets.mockResolvedValue({
        modelPath: 'file:///model.onnx',
        corpusPath: 'file:///corpus.json',
      } as never);
      recitationAssetsModule.ensureRecitationAssets.mockReset();
    }
  });

  it('a model that finishes loading after its session was stopped is unloaded later', async () => {
    jest.useFakeTimers();
    let release: () => void = () => undefined;
    engineControl.gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const starting = runner.startSession(
      {purpose: 'identify', hint: null},
      handlers(),
    );
    await flush();
    await runner.stopSession('user');
    release();
    await expect(starting).resolves.toBe(false);
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);
    expect(mockEngine.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('sessionRunner correction sessions', () => {
  it('a correction session applies mode, expected passage and structural rules at start', async () => {
    await runner.startSession(
      {
        purpose: 'practice',
        hint: null,
        mode: 'correction',
        expected: {surah: 2, ayah: 1, ayahEnd: 5},
        structural: true,
      },
      handlers(),
    );
    expect(mockEngine.setMode).toHaveBeenLastCalledWith('correction');
    expect(mockEngine.setExpected).toHaveBeenLastCalledWith({
      surah: 2,
      ayah: 1,
      ayahEnd: 5,
    });
    expect(mockEngine.setStructural).toHaveBeenLastCalledWith(true);
  });

  it('a tracking session clears what a previous correction session set', async () => {
    await runner.startSession({purpose: 'follow', hint: null}, handlers());
    expect(mockEngine.setMode).toHaveBeenLastCalledWith('tracking');
    expect(mockEngine.setExpected).toHaveBeenLastCalledWith(null);
    expect(mockEngine.setStructural).toHaveBeenLastCalledWith(false);
  });

  it('a live flag is deferred so listening goes on', async () => {
    const h = handlers();
    await runner.startSession(
      {purpose: 'follow', hint: null, mode: 'correction', structural: true},
      h,
    );
    const flag = correctionError(18, 22, 4, 'possible_omission');
    engineControl.sendEvent?.(flag);
    expect(h.onEvent).toHaveBeenCalledWith(flag);
    expect(mockEngine.correct).toHaveBeenCalledWith('review_later');
  });

  it('a flag in a tracking session is not deferred', async () => {
    await runner.startSession({purpose: 'follow', hint: null}, handlers());
    engineControl.sendEvent?.(correctionError(18, 22, 4, 'possible_omission'));
    expect(mockEngine.correct).not.toHaveBeenCalled();
  });

  it('configureSession switches the active session to correction', async () => {
    const h = handlers();
    await runner.startSession({purpose: 'follow', hint: null}, h);
    runner.configureSession({
      mode: 'correction',
      expected: {surah: 18, ayah: 5, ayahEnd: 12},
      structural: true,
    });
    expect(mockEngine.setMode).toHaveBeenLastCalledWith('correction');
    expect(mockEngine.setExpected).toHaveBeenLastCalledWith({
      surah: 18,
      ayah: 5,
      ayahEnd: 12,
    });
    expect(mockEngine.setStructural).toHaveBeenLastCalledWith(true);
    engineControl.sendEvent?.(correctionError(18, 6, 2, 'possible_omission'));
    expect(mockEngine.correct).toHaveBeenCalledWith('review_later');
  });
});
