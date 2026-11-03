// Follow-along as the reader sees it: the store the mushaf reads, the mic,
// the engine and the analytics. Mocks sit at the edges (engine, mic, model
// files, players), so the service's own wiring is what is under test.

import * as mockRecitation from '@/test-utils/recitationMocks';
import {
  captureAppStateChange,
  correctionError,
  digitalKhattModule,
  engineControl,
  finalSequence,
  flush,
  micControl,
  mockAnalytics,
  mockEngine,
  mockMic,
  resetRecitationControls,
  verseMatch,
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
jest.mock(
  '@/services/mushaf/DigitalKhattDataService',
  () => mockRecitation.digitalKhattModule,
);

const mockLog = {
  recordTake: jest.fn(async (_take: unknown) => undefined),
  dismissedKeys: jest.fn(async () => new Set<string>()),
};
jest.mock('@/services/recitation/RecitationLogDatabase', () => ({
  recitationLogDatabase: mockLog,
}));
// Pages of Al-Kahf as the verse map would give them.
const mockPages: Record<number, string[]> = {
  293: ['18:1', '18:2', '18:3', '18:4', '18:5'],
  294: ['18:6', '18:7'],
};
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {
    getOrderedVerseKeysForPage: (page: number) => mockPages[page] ?? [],
  },
}));
const mockSettings = {recitationHideText: false};
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: {getState: () => mockSettings},
}));

type Service = typeof import('../RecitationTrackingService');
type Store = typeof import('@/store/recitationTrackingStore');

let service: Service;
let store: Store['useRecitationTrackingStore'];
let appState: {fire: (next: string) => void};

function state() {
  return store.getState();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRecitationControls();
  mockSettings.recitationHideText = false;
  mockLog.dismissedKeys.mockResolvedValue(new Set());
  digitalKhattModule.digitalKhattDataService.getPageForVerse.mockImplementation(
    ((key: string) => (key === '18:6' || key === '18:7' ? 294 : 293)) as never,
  );
  appState = captureAppStateChange();
  // A fresh module per test: the service keeps the loaded engine in module
  // state.
  jest.isolateModules(() => {
    service = require('../RecitationTrackingService');
    store =
      require('@/store/recitationTrackingStore').useRecitationTrackingStore;
  });
});

afterEach(async () => {
  await service.stopRecitationTracking();
  // Stopping schedules the model unload in 5 minutes; unload now so no timer
  // outlives the test.
  await service.unloadRecitationModel();
  jest.useRealTimers();
});

describe('RecitationTrackingService', () => {
  it("permission denied ends in error with errorKind 'permission'", async () => {
    micControl.granted = false;
    await service.startRecitationTracking(null);
    expect(state().status).toBe('error');
    expect(state().errorKind).toBe('permission');
    const {startMicStream} = jest.requireMock(
      '@/services/recitation/micStream',
    );
    expect(startMicStream).not.toHaveBeenCalled();
    expect(mockAnalytics.trackRecitationTrackingError).toHaveBeenCalledWith({
      stage: 'permission',
      error_message: 'denied',
    });
  });

  it('start loads the model, starts the mic and ends in listening with the hint set', async () => {
    await service.startRecitationTracking({surah: 36, ayah: 1});
    expect(state().status).toBe('listening');
    expect(mockEngine.reset).toHaveBeenCalledTimes(1);
    expect(mockEngine.setHint).toHaveBeenCalledWith({surah: 36, ayah: 1});
    const {startMicStream} = jest.requireMock(
      '@/services/recitation/micStream',
    );
    expect(startMicStream).toHaveBeenCalledTimes(1);
    expect(mockAnalytics.trackRecitationTrackingStarted).toHaveBeenCalledWith({
      hint_surah_id: 36,
      model_loaded: false,
    });
  });

  it('mic audio goes to the engine', async () => {
    await service.startRecitationTracking(null);
    const pcm = new Float32Array(16);
    micControl.chunk?.(pcm, 16000);
    expect(mockEngine.feed).toHaveBeenCalledWith(pcm);
  });

  it('word_progress sets verseKey, wordIndex, totalWords and locked', async () => {
    await service.startRecitationTracking({surah: 36, ayah: 1});
    engineControl.sendEvent?.(wordProgress(36, 4, 2, 9));
    expect(state()).toMatchObject({
      locked: true,
      verseKey: '36:4',
      wordIndex: 2,
      totalWords: 9,
    });
    expect(mockAnalytics.trackRecitationTrackingLocked).toHaveBeenCalledWith(
      expect.objectContaining({surah_id: 36, ayah: 4, page_hint_matched: true}),
    );
  });

  it('verse_match adds the key to recitedVerseKeys once', async () => {
    await service.startRecitationTracking(null);
    engineControl.sendEvent?.(verseMatch(36, 4));
    engineControl.sendEvent?.(verseMatch(36, 4));
    engineControl.sendEvent?.(verseMatch(36, 5));
    expect(state().recitedVerseKeys).toEqual(['36:4', '36:5']);
  });

  it('stop returns to off and stops the mic and the engine', async () => {
    await service.startRecitationTracking(null);
    engineControl.sendEvent?.(wordProgress(36, 4, 2, 9));
    engineControl.sendEvent?.(verseMatch(36, 4));
    await service.stopRecitationTracking();
    expect(state().status).toBe('off');
    expect(state().verseKey).toBeNull();
    expect(mockMic.stop).toHaveBeenCalledTimes(1);
    expect(mockEngine.stop).toHaveBeenCalledTimes(1);
    expect(mockAnalytics.trackRecitationTrackingStopped).toHaveBeenCalledWith(
      expect.objectContaining({
        stop_reason: 'user',
        locked: true,
        ayat_recited: 1,
        rtf: 0.2,
        max_feed_ms: 120,
        load_ms: 900,
      }),
    );
  });

  it('events after stop do not touch the store', async () => {
    await service.startRecitationTracking(null);
    await service.stopRecitationTracking();
    engineControl.sendEvent?.(wordProgress(36, 4, 2, 9));
    expect(state().verseKey).toBeNull();
    expect(state().locked).toBe(false);
  });

  it('no audio chunk for 3 s ends in an error', async () => {
    jest.useFakeTimers();
    await service.startRecitationTracking(null);
    await jest.advanceTimersByTimeAsync(4100);
    await flush();
    expect(state().status).toBe('error');
    expect(state().error).toBe(
      'The microphone stopped. Tap the mic to start again.',
    );
    expect(mockAnalytics.trackRecitationTrackingStopped).toHaveBeenCalledWith(
      expect.objectContaining({stop_reason: 'mic_silent'}),
    );
  });

  it('a mic interruption pauses the take, and it resumes after', async () => {
    await service.startRecitationTracking(null);
    engineControl.sendEvent?.(wordProgress(36, 4, 2, 9));
    micControl.interrupt?.('began');
    expect(state().status).toBe('paused');
    expect(state().verseKey).toBe('36:4');
    micControl.interrupt?.('ended');
    await flush();
    expect(state().status).toBe('listening');
    expect(state().verseKey).toBe('36:4');
    expect(mockAnalytics.trackRecitationTrackingStarted).toHaveBeenCalledTimes(
      1,
    );
  });

  it('an interruption that never ends stops the take with an error', async () => {
    jest.useFakeTimers();
    await service.startRecitationTracking(null);
    micControl.interrupt?.('began');
    await jest.advanceTimersByTimeAsync(60_100);
    await flush();
    expect(state().status).toBe('error');
    expect(state().error).toBe(
      'Recitation stopped because another app used audio.',
    );
  });

  it('going to the background stops the take', async () => {
    await service.startRecitationTracking(null);
    appState.fire('background');
    await flush();
    expect(state().status).toBe('off');
    expect(mockMic.stop).toHaveBeenCalledTimes(1);
    expect(mockAnalytics.trackRecitationTrackingStopped).toHaveBeenCalledWith(
      expect.objectContaining({stop_reason: 'background'}),
    );
  });

  it('stop during loading cancels the start', async () => {
    let release: () => void = () => undefined;
    engineControl.gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const starting = service.startRecitationTracking(null);
    await flush();
    expect(state().status).toBe('loading');
    await service.stopRecitationTracking();
    release();
    await starting;
    const {startMicStream} = jest.requireMock(
      '@/services/recitation/micStream',
    );
    expect(startMicStream).not.toHaveBeenCalled();
    expect(state().status).toBe('off');
  });
});

describe('RecitationTrackingService take log', () => {
  it('a finished take is saved with its ayat and the hide setting', async () => {
    mockSettings.recitationHideText = true;
    await service.startRecitationTracking(null);
    engineControl.sendEvent?.(wordProgress(36, 4, 0, 9));
    engineControl.sendEvent?.(verseMatch(36, 4));
    mockEngine.stop.mockResolvedValueOnce([
      finalSequence([
        {surah: 36, ayah: 4, confidence: 0.9},
        {surah: 36, ayah: 5, confidence: 0.8},
      ]),
    ]);
    await service.stopRecitationTracking();
    await flush();
    expect(mockLog.recordTake).toHaveBeenCalledTimes(1);
    expect(mockLog.recordTake.mock.calls[0][0]).toMatchObject({
      purpose: 'follow',
      hidden: true,
      stopReason: 'user',
      ayat: [
        {surah: 36, ayah: 4, confidence: 0.9},
        {surah: 36, ayah: 5, confidence: 0.8},
      ],
    });
  });

  it('peeks during the take are saved', async () => {
    await service.startRecitationTracking(null);
    service.peekRecitation('word', {surah: 67, ayah: 1});
    await service.stopRecitationTracking();
    await flush();
    expect(mockLog.recordTake.mock.calls[0][0]).toMatchObject({
      peeks: [{surah: 67, ayah: 1, kind: 'word'}],
    });
  });

  it('a save failure does not break stopping', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockLog.recordTake.mockRejectedValueOnce(new Error('disk full'));
    await service.startRecitationTracking(null);
    engineControl.sendEvent?.(verseMatch(36, 4));
    await service.stopRecitationTracking();
    await flush();
    expect(state().status).toBe('off');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a take that never started listening is not saved', async () => {
    micControl.granted = false;
    await service.startRecitationTracking(null);
    await service.stopRecitationTracking();
    await flush();
    expect(mockLog.recordTake).not.toHaveBeenCalled();
  });
});

describe('RecitationTrackingService memorisation mode', () => {
  it('hide mode switches to correction after the first lock, from the locked ayah', async () => {
    mockSettings.recitationHideText = true;
    await service.startRecitationTracking(null);
    expect(mockEngine.setMode).toHaveBeenLastCalledWith('tracking');
    engineControl.sendEvent?.(wordProgress(18, 3, 0, 9));
    expect(mockEngine.setMode).toHaveBeenLastCalledWith('correction');
    expect(mockEngine.setExpected).toHaveBeenLastCalledWith({
      surah: 18,
      ayah: 3,
      ayahEnd: 5,
    });
    expect(mockEngine.setStructural).toHaveBeenLastCalledWith(true);
  });

  it('plain follow-along stays in tracking mode', async () => {
    await service.startRecitationTracking(null);
    engineControl.sendEvent?.(wordProgress(18, 3, 0, 9));
    expect(mockEngine.setMode).not.toHaveBeenCalledWith('correction');
  });

  it('reaching the end of the passage moves it to the next page', async () => {
    mockSettings.recitationHideText = true;
    await service.startRecitationTracking(null);
    engineControl.sendEvent?.(wordProgress(18, 3, 0, 9));
    engineControl.sendEvent?.(verseMatch(18, 5));
    expect(mockEngine.setExpected).toHaveBeenLastCalledWith({
      surah: 18,
      ayah: 6,
      ayahEnd: 7,
    });
  });

  it('live flags reach the store, and dismissed and hidden kinds do not', async () => {
    mockSettings.recitationHideText = true;
    mockLog.dismissedKeys.mockResolvedValue(new Set(['skippedWord:18:4:2']));
    await service.startRecitationTracking(null);
    await flush();
    engineControl.sendEvent?.(wordProgress(18, 3, 0, 9));
    engineControl.sendEvent?.(correctionError(18, 4, 2, 'possible_omission'));
    engineControl.sendEvent?.(correctionError(18, 4, 5, 'possible_omission'));
    engineControl.sendEvent?.(correctionError(18, 4, 6, 'possible_vowel'));
    expect(state().flags.map(f => f.key)).toEqual(['skippedWord:18:4:5']);
  });

  it('a hide-mode take ends with a summary of what to check', async () => {
    mockSettings.recitationHideText = true;
    await service.startRecitationTracking(null);
    engineControl.sendEvent?.(wordProgress(18, 3, 0, 9));
    mockEngine.stop.mockResolvedValueOnce([
      finalSequence([
        {surah: 18, ayah: 3, confidence: 0.9},
        {surah: 18, ayah: 4, confidence: 0.9},
        {surah: 18, ayah: 6, confidence: 0.8},
      ]),
      correctionError(18, 5, 0, 'possible_skipped_ayah', 'ayah_order'),
    ]);
    await service.stopRecitationTracking();
    await flush();
    expect(state().summary).toMatchObject({
      ayat: [
        {surah: 18, ayah: 3},
        {surah: 18, ayah: 4},
        {surah: 18, ayah: 6},
      ],
      flags: [{kind: 'skippedAyah', surah: 18, ayah: 5}],
    });
  });

  it('a plain follow-along take has no summary', async () => {
    await service.startRecitationTracking(null);
    engineControl.sendEvent?.(wordProgress(18, 3, 0, 9));
    await service.stopRecitationTracking();
    await flush();
    expect(state().summary).toBeNull();
  });

  it('showing the text mid-take goes back to tracking', async () => {
    mockSettings.recitationHideText = true;
    await service.startRecitationTracking(null);
    engineControl.sendEvent?.(wordProgress(18, 3, 0, 9));
    service.setRecitationHidden(false);
    expect(mockEngine.setMode).toHaveBeenLastCalledWith('tracking');
    expect(mockEngine.setExpected).toHaveBeenLastCalledWith(null);
  });
});
