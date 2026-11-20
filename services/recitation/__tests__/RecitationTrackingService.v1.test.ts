// Follow-along with the Tilawa 1.0 preview chosen: its marks reach the page only
// through the app's check, and a stop lets it decide what is still open first.

import * as mockRecitation from '@/test-utils/recitationMocks';
import {
  captureAppStateChange,
  digitalKhattModule,
  micControl,
  resetRecitationControls,
  wordProgress,
} from '@/test-utils/recitationMocks';
import type {EngineMessage} from '../recitationEngine';
import type {V1CheckAnswer} from '../v1/checkMark';
import type {V1Mark, V1MarkMessage} from '../v1/types';

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
  dismissWord: jest.fn(async () => undefined),
};
jest.mock('@/services/recitation/RecitationLogDatabase', () => ({
  recitationLogDatabase: mockLog,
}));
const mockSettings = {
  recitationHideText: false,
  recitationMistakeHaptics: true,
  recitationCheckMistakes: true,
  recitationCancelMayCancel: null,
  recitationEngine: 'v1',
};
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: {getState: () => mockSettings},
}));
const mockHaptics = {notificationAsync: jest.fn(async () => undefined)};
jest.mock('expo-haptics', () => ({
  notificationAsync: () => mockHaptics.notificationAsync(),
  NotificationFeedbackType: {Warning: 'warning'},
}));

// The 1.0 engine, stood in for: the test sends its messages.
const mockV1 = {
  send: null as ((msg: EngineMessage) => void) | null,
  atSettle: [] as V1MarkMessage[],
  settled: 0,
};
const mockV1Engine = {
  feed: jest.fn(),
  stop: jest.fn(async () => []),
  reset: jest.fn(),
  setHint: jest.fn(),
  setMode: jest.fn(),
  setExpected: jest.fn(),
  setStructural: jest.fn(),
  correct: jest.fn(async () => []),
  readMelFrames: (from: number) => ({
    first: from,
    frames: 0,
    data: new Float32Array(0),
  }),
  wordFrames: () => null,
  ayahEnteredAt: () => 0,
  wordCount: () => 4,
  getStats: () => ({
    audioSeconds: 0,
    busyMs: 0,
    ortMs: 0,
    maxFeedMs: 0,
    backlog: 0,
    loadMs: 0,
    chunks: 0,
    lastError: null,
  }),
  timeline: () => ({words: new Map(), ayahEntered: new Map(), path: []}),
  settle: jest.fn(async () => {
    mockV1.settled += 1;
    for (const msg of mockV1.atSettle) mockV1.send?.(msg);
  }),
  dispose: jest.fn(async () => undefined),
};
jest.mock('@/services/recitation/v1/assets', () => ({
  getV1Assets: async () => ({
    modelPath: 'file:///m',
    referencePath: 'file:///r',
  }),
  ensureV1Assets: jest.fn(),
  deleteV1Assets: jest.fn(async () => undefined),
  V1_DOWNLOAD_MB: 72,
}));
jest.mock('@/services/recitation/v1/engine', () => ({
  createTilawaV1Engine: async (
    _assets: unknown,
    onEvent: (msg: EngineMessage) => void,
  ) => {
    mockV1.send = onEvent;
    return mockV1Engine;
  },
}));
// The app's check, answered by the test.
const mockAnswers = new Map<string, V1CheckAnswer>();
jest.mock('@/services/recitation/v1/checkMark', () => ({
  ...jest.requireActual('@/services/recitation/v1/checkMark'),
  checkV1Mark: async (mark: V1Mark) =>
    mockAnswers.get(mark.id) ?? {
      outcome: 'kept',
      why: 'test',
      detail: {},
      ms: 1,
    },
}));
jest.mock('@/services/recitation/secondLook/checkWord', () => ({
  ...jest.requireActual('@/services/recitation/secondLook/checkWord'),
  secondLookModelNow: async () => ({run: jest.fn()}),
}));

type Service = typeof import('../RecitationTrackingService');
type Store = typeof import('@/store/recitationTrackingStore');
let service: Service;
let store: Store['useRecitationTrackingStore'];

const v1Mark = (over: Partial<V1MarkMessage>): V1MarkMessage => ({
  type: 'v1_mark',
  id: 'm1',
  state: 'confirmed',
  errorClass: 'wrong_word',
  surah: 1,
  ayah: 1,
  word: 2,
  totalWords: 4,
  audioTime: 1,
  confidence: 0.8,
  ...over,
});

const wait = (ms = 120) => new Promise(r => setTimeout(r, ms));

/** Seconds of audio from the mic, which also fills the check's ring. */
function hear(seconds: number): void {
  micControl.chunk?.(new Float32Array(Math.round(seconds * 16000)), 16000);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRecitationControls();
  mockAnswers.clear();
  mockV1.atSettle = [];
  mockV1.settled = 0;
  digitalKhattModule.digitalKhattDataService.getPageForVerse.mockImplementation(
    (() => 1) as never,
  );
  captureAppStateChange();
  jest.isolateModules(() => {
    service = require('../RecitationTrackingService');
    store =
      require('@/store/recitationTrackingStore').useRecitationTrackingStore;
  });
});

afterEach(async () => {
  await service.stopRecitationTracking();
  await service.unloadRecitationModel();
});

describe('follow-along with the Tilawa 1.0 preview', () => {
  it('runs the 1.0 engine when it is chosen', async () => {
    await service.startRecitationTracking(null);
    expect(store.getState().status).toBe('listening');
    expect(mockV1.send).not.toBeNull();
    expect(
      mockRecitation.recitationEngineModule.createRecitationEngine,
    ).not.toHaveBeenCalled();
  });

  it('a mark shows only once the check keeps it, and a cancelled one never does', async () => {
    await service.startRecitationTracking(null);
    mockV1.send?.(wordProgress(1, 1, 0, 4));
    mockAnswers.set('no', {
      outcome: 'cancelled',
      why: 'fits',
      detail: {},
      ms: 1,
    });
    mockV1.send?.(v1Mark({id: 'no', word: 1}));
    mockV1.send?.(v1Mark({id: 'yes', word: 2}));
    expect(store.getState().marks).toEqual([]);
    hear(3);
    await wait();
    expect(store.getState().marks).toEqual([
      expect.objectContaining({
        surah: 1,
        ayah: 1,
        word: 2,
        kind: 'wrong',
        status: 'mistake',
      }),
    ]);
    expect(mockHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it('a stop first lets the engine settle and checks what it decides at the end', async () => {
    await service.startRecitationTracking(null);
    mockV1.send?.(wordProgress(1, 1, 0, 4));
    hear(3);
    mockV1.atSettle = [
      v1Mark({id: 'end', word: 3, errorClass: 'omitted_word', audioTime: 2}),
    ];
    await service.stopRecitationTracking('user');
    expect(mockV1.settled).toBe(1);
    const {summary, marks} = store.getState();
    expect(marks).toEqual([expect.objectContaining({word: 3, kind: 'missed'})]);
    expect(summary?.marks).toEqual([
      expect.objectContaining({
        surah: 1,
        ayah: 1,
        kind: 'missed',
        status: 'mistake',
      }),
    ]);
    const take = mockLog.recordTake.mock.calls[0][0] as {
      words: {result: string}[];
    };
    expect(take.words.map(w => w.result)).toEqual(['correct', 'mistake']);
  });

  it('the take does not settle the engine when the reader left the mushaf', async () => {
    await service.startRecitationTracking(null);
    await service.stopRecitationTracking('mushaf_closed');
    expect(mockV1.settled).toBe(0);
  });

  it('with checking off, its marks go nowhere', async () => {
    mockSettings.recitationCheckMistakes = false;
    try {
      await service.startRecitationTracking(null);
      hear(3);
      mockV1.send?.(v1Mark({}));
      await wait();
      expect(store.getState().marks).toEqual([]);
    } finally {
      mockSettings.recitationCheckMistakes = true;
    }
  });
});
