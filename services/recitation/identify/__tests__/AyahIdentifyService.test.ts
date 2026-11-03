import * as mockRecitation from '@/test-utils/recitationMocks';
import {
  captureAppStateChange,
  engineControl,
  flush,
  micControl,
  mockAnalytics,
  mockEngine,
  mockMic,
  resetRecitationControls,
  verseCandidate,
  wordProgress,
} from '@/test-utils/recitationMocks';

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
const mockTwins: Record<string, string[]> = {};
jest.mock('@/services/recitation/identify/identicalAyat', () => ({
  identicalAyatOf: (key: string) => mockTwins[key] ?? [],
}));

type Service = typeof import('../AyahIdentifyService');
type Store = typeof import('@/store/ayahIdentifyStore');
type Runner = typeof import('@/services/recitation/sessionRunner');
type Host = typeof import('@/services/recitation/engineHost');

let service: Service;
let store: Store['useAyahIdentifyStore'];
let runner: Runner;
let host: Host;
let appState: {fire: (next: string) => void};

function state() {
  return store.getState();
}

/** Listening with the mic delivering audio, so the watchdog stays quiet. */
async function listenFor(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 500) {
    micControl.chunk?.(new Float32Array(16), 16000);
    await jest.advanceTimersByTimeAsync(500);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRecitationControls();
  for (const key of Object.keys(mockTwins)) delete mockTwins[key];
  appState = captureAppStateChange();
  jest.isolateModules(() => {
    service = require('../AyahIdentifyService');
    store = require('@/store/ayahIdentifyStore').useAyahIdentifyStore;
    runner = require('@/services/recitation/sessionRunner');
    host = require('@/services/recitation/engineHost');
  });
});

afterEach(async () => {
  await service.stopAyahIdentify();
  await host.unloadRecitationModel();
  jest.useRealTimers();
});

describe('AyahIdentifyService', () => {
  it("the first located ayah becomes the match and status 'found'", async () => {
    mockTwins['55:13'] = ['55:16', '55:18'];
    await service.startAyahIdentify();
    expect(state()).toMatchObject({status: 'listening', micOn: true});
    expect(mockAnalytics.trackRecitationIdentifyStarted).toHaveBeenCalledWith({
      model_loaded: false,
    });
    engineControl.sendEvent?.(verseCandidate(55, 13));
    expect(state()).toMatchObject({
      status: 'found',
      micOn: true,
      match: {surah: 55, ayah: 13},
      current: {surah: 55, ayah: 13},
      twins: ['55:16', '55:18'],
    });
  });

  it('a first word_progress places the ayah too', async () => {
    await service.startAyahIdentify();
    engineControl.sendEvent?.(wordProgress(18, 10, 2, 12));
    expect(state()).toMatchObject({
      status: 'found',
      match: {surah: 18, ayah: 10},
    });
  });

  it('later word_progress moves current, not match', async () => {
    await service.startAyahIdentify();
    engineControl.sendEvent?.(verseCandidate(18, 10));
    engineControl.sendEvent?.(wordProgress(18, 11, 0, 9));
    expect(state()).toMatchObject({
      match: {surah: 18, ayah: 10},
      current: {surah: 18, ayah: 11},
    });
  });

  it("no match within 20 s ends in notFound and stops with 'not_found'", async () => {
    jest.useFakeTimers();
    await service.startAyahIdentify();
    await listenFor(19_000);
    expect(state().status).toBe('listening');
    await listenFor(1_500);
    await flush();
    expect(state()).toMatchObject({status: 'notFound', micOn: false});
    expect(mockMic.stop).toHaveBeenCalledTimes(1);
    expect(runner.activeSessionPurpose()).toBeNull();
    expect(mockAnalytics.trackRecitationIdentifyEnded).toHaveBeenCalledWith(
      expect.objectContaining({outcome: 'not_found', surah_id: null}),
    );
  });

  it('the timeout does not run while paused', async () => {
    jest.useFakeTimers();
    await service.startAyahIdentify();
    await listenFor(10_000);
    micControl.interrupt?.('began');
    expect(state().status).toBe('paused');
    await jest.advanceTimersByTimeAsync(30_000);
    expect(state().status).toBe('paused');
    micControl.interrupt?.('ended');
    await flush();
    expect(state().status).toBe('listening');
    // A fresh 20 s from the resume.
    await listenFor(19_000);
    expect(state().status).toBe('listening');
    await listenFor(1_500);
    await flush();
    expect(state().status).toBe('notFound');
  });

  it('stop during loading never starts the mic', async () => {
    let release: () => void = () => undefined;
    engineControl.gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const starting = service.startAyahIdentify();
    await flush();
    expect(state().status).toBe('loading');
    await service.stopAyahIdentify();
    release();
    await starting;
    const {startMicStream} = jest.requireMock(
      '@/services/recitation/micStream',
    );
    expect(startMicStream).not.toHaveBeenCalled();
    expect(state().status).toBe('idle');
  });

  it("a denied microphone ends in error with code 'permission'", async () => {
    micControl.granted = false;
    await service.startAyahIdentify();
    expect(state()).toMatchObject({
      status: 'error',
      error: {code: 'permission'},
    });
  });

  it('stop returns to idle and reports the match', async () => {
    await service.startAyahIdentify();
    engineControl.sendEvent?.(verseCandidate(55, 13));
    await service.stopAyahIdentify();
    expect(state()).toMatchObject({status: 'idle', match: null, micOn: false});
    expect(mockAnalytics.trackRecitationIdentifyEnded).toHaveBeenCalledWith(
      expect.objectContaining({outcome: 'found', surah_id: 55}),
    );
  });

  it('a mic that dies after a match keeps the result', async () => {
    jest.useFakeTimers();
    await service.startAyahIdentify();
    engineControl.sendEvent?.(verseCandidate(55, 13));
    await jest.advanceTimersByTimeAsync(4_100);
    await flush();
    expect(state()).toMatchObject({
      status: 'found',
      micOn: false,
      match: {surah: 55, ayah: 13},
    });
  });

  it("a mic that dies before a match ends in error with code 'mic'", async () => {
    jest.useFakeTimers();
    await service.startAyahIdentify();
    await jest.advanceTimersByTimeAsync(4_100);
    await flush();
    expect(state()).toMatchObject({status: 'error', error: {code: 'mic'}});
  });

  it('going to the background before anything is placed ends in stopped', async () => {
    await service.startAyahIdentify();
    appState.fire('background');
    await flush();
    expect(state()).toMatchObject({status: 'stopped', micOn: false});
  });

  it('leaving while the model still loads ends in stopped, not loading', async () => {
    let release: () => void = () => undefined;
    engineControl.gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const starting = service.startAyahIdentify();
    await flush();
    appState.fire('background');
    await flush();
    release();
    await starting;
    expect(state()).toMatchObject({status: 'stopped', micOn: false});
  });

  it('a restart right after a stop listens afresh, and the old take is reported as found', async () => {
    await service.startAyahIdentify();
    engineControl.sendEvent?.(verseCandidate(55, 13));
    let finishFlush: (msgs: never[]) => void = () => undefined;
    mockEngine.stop.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishFlush = resolve as (msgs: never[]) => void;
        }),
    );
    const stopping = service.stopAyahIdentify();
    const starting = service.startAyahIdentify();
    await flush();
    finishFlush([]);
    await stopping;
    await starting;
    expect(state()).toMatchObject({
      status: 'listening',
      micOn: true,
      match: null,
    });
    expect(mockAnalytics.trackRecitationIdentifyEnded).toHaveBeenCalledWith(
      expect.objectContaining({outcome: 'found', surah_id: 55}),
    );
    engineControl.sendEvent?.(verseCandidate(18, 10));
    expect(state()).toMatchObject({
      status: 'found',
      match: {surah: 18, ayah: 10},
    });
  });
});
