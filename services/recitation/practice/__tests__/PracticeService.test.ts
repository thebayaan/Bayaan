import * as mockRecitation from '@/test-utils/recitationMocks';
import {
  captureAppStateChange,
  engineControl,
  finalSequence,
  flush,
  micControl,
  mockEngine,
  resetRecitationControls,
  verseMatch,
  wordProgress,
} from '@/test-utils/recitationMocks';
import type {PracticeTarget} from '../types';

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
const mockLog = {
  recordTake: jest.fn(async (_take: unknown) => undefined),
  dismissedKeys: jest.fn(async () => new Set<string>()),
};
jest.mock('@/services/recitation/RecitationLogDatabase', () => ({
  recitationLogDatabase: {
    recordTake: (take: unknown) => mockLog.recordTake(take),
    dismissedKeys: () => mockLog.dismissedKeys(),
  },
}));

type Service = typeof import('../PracticeService');
type Store = typeof import('@/store/practiceStore');
type Runner = typeof import('@/services/recitation/sessionRunner');
type Host = typeof import('@/services/recitation/engineHost');

let service: Service;
let store: Store['usePracticeStore'];
let runner: Runner;
let host: Host;

const AYAH_18_5: PracticeTarget = {
  expected: {surah: 18, ayah: 5, ayahEnd: 5},
  mode: 'correction',
};

function state() {
  return store.getState();
}

async function listenFor(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 500) {
    micControl.chunk?.(new Float32Array(16), 16000);
    await jest.advanceTimersByTimeAsync(500);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRecitationControls();
  captureAppStateChange();
  jest.isolateModules(() => {
    service = require('../PracticeService');
    store = require('@/store/practiceStore').usePracticeStore;
    runner = require('@/services/recitation/sessionRunner');
    host = require('@/services/recitation/engineHost');
  });
});

afterEach(async () => {
  await service.stopPractice();
  await host.unloadRecitationModel();
  jest.useRealTimers();
});

describe('PracticeService', () => {
  it('a practice take checks the expected passage in correction mode', async () => {
    await service.startPractice(AYAH_18_5);
    expect(state()).toMatchObject({status: 'listening', target: AYAH_18_5});
    expect(mockEngine.setMode).toHaveBeenLastCalledWith('correction');
    expect(mockEngine.setExpected).toHaveBeenLastCalledWith({
      surah: 18,
      ayah: 5,
      ayahEnd: 5,
    });
    expect(mockEngine.setStructural).toHaveBeenLastCalledWith(true);
  });

  it('reciting the last expected ayah ends the take and judges it', async () => {
    jest.useFakeTimers();
    mockEngine.stop.mockResolvedValueOnce([
      finalSequence([{surah: 18, ayah: 5, confidence: 0.9}]),
    ]);
    await service.startPractice(AYAH_18_5);
    engineControl.sendEvent?.(wordProgress(18, 5, 0, 9));
    engineControl.sendEvent?.(verseMatch(18, 5));
    await listenFor(1_500);
    await flush();
    expect(state()).toMatchObject({
      status: 'done',
      verdict: {outcome: 'clean'},
    });
    expect(runner.activeSessionPurpose()).toBeNull();
  });

  it('a practice take ends after 25 s with nothing', async () => {
    jest.useFakeTimers();
    await service.startPractice(AYAH_18_5);
    await listenFor(24_000);
    expect(state().status).toBe('listening');
    await listenFor(1_500);
    await flush();
    expect(state()).toMatchObject({
      status: 'done',
      verdict: {outcome: 'nothing'},
    });
  });

  it('a practice take is logged with its purpose', async () => {
    await service.startPractice(AYAH_18_5);
    engineControl.sendEvent?.(verseMatch(18, 5));
    await service.stopPractice();
    await flush();
    expect(mockLog.recordTake).toHaveBeenCalledWith(
      expect.objectContaining({purpose: 'practice'}),
    );
  });

  it('stop returns to idle', async () => {
    await service.startPractice(AYAH_18_5);
    await service.stopPractice();
    expect(state()).toMatchObject({status: 'idle', verdict: null});
  });
});
