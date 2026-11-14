// The live check as the reader meets it, through the real service, the real runner and
// the real mark rules, with a fake check and a fake model brought in through the port.
// The engine and the mic are played by hand.

import * as mockRecitation from '@/test-utils/recitationMocks';
import {
  captureAppStateChange,
  digitalKhattModule,
  engineControl,
  engineDebug,
  micControl,
  mockEngine,
  resetRecitationControls,
  wordProgress,
  wordVerdicts,
} from '@/test-utils/recitationMocks';
import type {LiveCheckPort} from '../liveCheck/runner';
import type {
  LiveCheck,
  LiveOpinion,
  LivePlan,
  LiveVerdict,
} from '../liveCheck/types';
import type {ModelOutput, SecondLookModel} from '../secondLook/model';
import type {TakeRecord} from '../take';
import type {VerdictChange} from '../wordMarks';

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
  recordTake: jest.fn(async (_take: TakeRecord) => undefined),
  dismissedKeys: jest.fn(async () => new Set<string>()),
  dismissWord: jest.fn(
    async (_take: string, _s: number, _a: number, _w: number, _kind?: string) =>
      undefined,
  ),
};
jest.mock('@/services/recitation/RecitationLogDatabase', () => ({
  recitationLogDatabase: mockLog,
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {getOrderedVerseKeysForPage: () => []},
}));
const mockSettings = {
  recitationHideText: false,
  recitationMistakeHaptics: true,
  recitationCheckMistakes: true,
};
const mockHaptics = {
  notificationAsync: jest.fn(async (_type: string) => undefined),
};
jest.mock('expo-haptics', () => ({
  notificationAsync: (type: string) => mockHaptics.notificationAsync(type),
  NotificationFeedbackType: {Warning: 'warning'},
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: {getState: () => mockSettings},
}));
const mockTrace = jest.fn((_line: string) => undefined);
jest.mock('@/services/recitation/debugTake', () => ({
  trace: (line: string) => mockTrace(line),
  debugTakeStart: jest.fn(),
  debugTakeAudio: jest.fn(),
  debugTakeSave: jest.fn(async () => undefined),
}));

type Service = typeof import('../RecitationTrackingService');
type Store = typeof import('@/store/recitationTrackingStore');

let service: Service;
let store: Store['useRecitationTrackingStore'];

const state = () => store.getState();
const shown = () =>
  state().marks.map(
    m => `${m.kind}:${m.word}${m.status === 'corrected' ? ' corrected' : ''}`,
  );
const buzzes = () => mockHaptics.notificationAsync.mock.calls.length;
const traced = () => mockTrace.mock.calls.map(([line]) => line);

// The fake check: it plans the last second heard, once a tick, and says what the
// test tells it to.
let opinions: LiveOpinion[] = [];
let lastPlanned = -1;
const check = {
  setPlace: jest.fn(),
  relocated: jest.fn(),
  lost: jest.fn(),
  plan: jest.fn((heard: number): LivePlan | null => {
    if (heard === lastPlanned) return null;
    lastPlanned = heard;
    return {from: Math.max(0, heard - 100), to: heard, id: 0};
  }),
  step: jest.fn(
    (
      _plan: LivePlan,
      _logp: Float32Array,
      _frames: number,
      _energy?: Float32Array,
    ) => opinions,
  ),
} satisfies LiveCheck;

let modelAnswer: () => Promise<ModelOutput>;
const model: SecondLookModel = {
  run: jest.fn((_data: Float32Array, _frames: number) => modelAnswer()),
  release: jest.fn(async () => undefined),
};
const port: LiveCheckPort = {
  create: jest.fn(() => check),
  model: () => model,
  modelBusy: () => false,
  holdModel: jest.fn(),
};

function load(
  config: Record<string, unknown> = {LIVE_CHECK_ENABLED: true},
): void {
  jest.isolateModules(() => {
    jest.doMock('@/services/recitation/liveCheck/config', () => ({
      ...jest.requireActual('@/services/recitation/liveCheck/config'),
      ...config,
    }));
    service = require('../RecitationTrackingService');
    store =
      require('@/store/recitationTrackingStore').useRecitationTrackingStore;
    jest.dontMock('@/services/recitation/liveCheck/config');
  });
  service.setLiveCheckPort(port);
}

function opinion(
  word: number,
  verdict: LiveVerdict,
  extra: {final?: boolean; reading?: number} = {},
): LiveOpinion {
  return {
    surah: 18,
    ayah: 3,
    word,
    totalWords: 10,
    verdict,
    final: extra.final ?? true,
    evidence: {
      letterShare: verdict === 'fine' ? 0 : 0.75,
      gap: verdict === 'fine' ? 0 : 5,
      audioFrom: 4 + word * 0.5,
      audioTo: 4.4 + word * 0.5,
      reading: extra.reading ?? 0,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  lastPlanned = -1;
  resetRecitationControls();
  captureAppStateChange();
  mockSettings.recitationHideText = false;
  mockSettings.recitationMistakeHaptics = true;
  mockSettings.recitationCheckMistakes = true;
  opinions = [];
  modelAnswer = async () => ({logp: new Float32Array(31 * 4), frames: 4});
  mockEngine.readMelFrames.mockImplementation((from: number, to: number) => ({
    first: from,
    frames: to - from,
    data: new Float32Array((to - from) * 80),
  }));
  mockEngine.getStats.mockReturnValue({
    audioSeconds: 10,
    busyMs: 2000,
    ortMs: 1000,
    maxFeedMs: 120,
    backlog: 0,
    loadMs: 900,
    chunks: 20,
    lastError: null,
  });
  digitalKhattModule.digitalKhattDataService.getVerseWords.mockReturnValue([]);
  jest.useFakeTimers();
  load();
});

afterEach(async () => {
  await service.stopRecitationTracking();
  await service.unloadRecitationModel();
  jest.useRealTimers();
});

async function lockedTake(totalWords = 9): Promise<void> {
  await service.startRecitationTracking(null);
  engineControl.sendEvent?.(wordProgress(18, 3, 0, totalWords));
}

// Audio time of the next chunk, as the engine counts it.
let audioTime = 4;
/** A chunk is heard: the engine's chunk listener fires and the tick runs. */
async function heard(say: LiveOpinion[] = opinions): Promise<void> {
  opinions = say;
  audioTime += 0.48;
  micControl.chunk?.(new Float32Array(16), 16000);
  engineControl.chunkDone?.(audioTime);
  await jest.advanceTimersByTimeAsync(10);
}

type Partly = Omit<VerdictChange, 'totalWords' | 'surah' | 'ayah'> &
  Partial<VerdictChange>;
function chunk(
  changes: Partly[],
  lock?: {surah: number; ayah: number; word: number},
): void {
  engineControl.sendEvent?.(
    wordVerdicts(
      changes.map(c => ({surah: 18, ayah: 3, ...c})),
      lock,
      audioTime,
    ),
  );
}

describe('turned off', () => {
  it('starts nothing, reads nothing and runs nothing', async () => {
    load({LIVE_CHECK_ENABLED: false});
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    chunk([
      {word: 2, state: 'wrong', detail: {gop: -9}},
      {word: 3, state: 'ok'},
    ]);
    engineControl.sendEvent?.(engineDebug('lost'));
    expect(port.create).not.toHaveBeenCalled();
    expect(mockEngine.setChunkListener).not.toHaveBeenCalled();
    expect(engineControl.chunkDone).toBeNull();
    expect(model.run).not.toHaveBeenCalled();
    expect(port.holdModel).not.toHaveBeenCalled();
    expect(check.setPlace).not.toHaveBeenCalled();
    expect(traced().some(line => line.includes('live'))).toBe(false);
  });

  it('with checking off, starts nothing either', async () => {
    mockSettings.recitationCheckMistakes = false;
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    expect(port.create).not.toHaveBeenCalled();
    expect(engineControl.chunkDone).toBeNull();
    expect(shown()).toEqual([]);
  });
});

describe('a live mark', () => {
  it('shows a final changed word at once, with one vibration', async () => {
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    expect(shown()).toEqual(['wrong:4']);
    expect(buzzes()).toBe(1);
    expect(traced()).toContain(
      'MARK live wrong 18:3 word 5 (reading 0, letters 0.75, gap 5.00)',
    );
    await heard();
    await heard();
    expect(shown()).toEqual(['wrong:4']);
    expect(buzzes()).toBe(1);
  });

  it('shows nothing for an opinion that is not final', async () => {
    await lockedTake();
    await heard([opinion(4, 'missed', {final: false})]);
    expect(shown()).toEqual([]);
    expect(buzzes()).toBe(0);
  });

  it('several in one run buzz once', async () => {
    await lockedTake();
    await heard([opinion(4, 'changed'), opinion(6, 'missed')]);
    expect(shown()).toEqual(['wrong:4', 'missed:6']);
    expect(buzzes()).toBe(1);
  });

  it('does not buzz again right after a follower mark', async () => {
    await lockedTake();
    chunk([{word: 2, state: 'skipped', detail: {junctionMissing: true}}]);
    await jest.advanceTimersByTimeAsync(0);
    expect(buzzes()).toBe(1);
    await heard([opinion(4, 'changed')]);
    expect(shown()).toEqual(['missed:2', 'wrong:4']);
    expect(buzzes()).toBe(1);
  });

  it('a follower mark right after it does not buzz again', async () => {
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    expect(buzzes()).toBe(1);
    await jest.advanceTimersByTimeAsync(100);
    chunk([{word: 2, state: 'skipped', detail: {junctionMissing: true}}]);
    await jest.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['missed:2', 'wrong:4']);
    expect(buzzes()).toBe(1);
  });

  it('is not made again from a settled reading once the follower takes the word', async () => {
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    await heard([opinion(4, 'fine', {reading: 1})]);
    expect(shown()).toEqual(['wrong:4 corrected']);
    chunk([{word: 4, state: 'wrong'}]);
    chunk([{word: 4, state: 'ok'}]);
    await heard([opinion(4, 'changed'), opinion(4, 'fine', {reading: 1})]);
    expect(shown()).not.toContain('wrong:4');
    expect(buzzes()).toBe(1);
    expect(
      traced().filter(line => line.startsWith('MARK live wrong 18:3 word 5')),
    ).toHaveLength(1);
  });

  it("is not corrected by the follower's later ok on the same reading", async () => {
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    chunk([{word: 4, state: 'ok'}]);
    await heard();
    expect(shown()).toEqual(['wrong:4']);
  });

  it('is corrected by a later fine reading', async () => {
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    await heard([opinion(4, 'fine', {reading: 1})]);
    expect(shown()).toEqual(['wrong:4 corrected']);
    expect(traced()).toContain('CORRECTED live 18:3 word 5 (reading 1)');
  });

  it('leaves a word the follower holds to the follower', async () => {
    await lockedTake();
    chunk([{word: 4, state: 'wrong', detail: {gop: -9}}]);
    await heard([opinion(4, 'missed')]);
    expect(shown()).toEqual([]);
    expect(buzzes()).toBe(0);
  });

  it('is not made before the lock', async () => {
    await service.startRecitationTracking(null);
    await heard([opinion(4, 'changed')]);
    expect(check.plan).not.toHaveBeenCalled();
    expect(shown()).toEqual([]);
  });
});

describe('dismissal', () => {
  it('takes it away for the rest of the take', async () => {
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    await service.dismissRecitationMark({surah: 18, ayah: 3, word: 4});
    expect(shown()).toEqual([]);
    await heard([opinion(4, 'changed'), opinion(4, 'missed', {reading: 1})]);
    expect(shown()).toEqual([]);
    expect(buzzes()).toBe(1);
  });
});

describe('the follower’s place', () => {
  it('reaches the check: where it is, where it locked, and when it is lost', async () => {
    await lockedTake();
    expect(check.setPlace).toHaveBeenCalledWith({
      surah: 18,
      ayah: 3,
      word: 0,
      totalWords: 9,
    });
    chunk([{word: 1, state: 'pending'}], {surah: 18, ayah: 3, word: 1});
    expect(check.relocated).toHaveBeenCalledWith(
      {surah: 18, ayah: 3, word: 1},
      audioTime,
    );
    engineControl.sendEvent?.(engineDebug('lost'));
    expect(check.lost).toHaveBeenCalledTimes(1);
    await heard([opinion(4, 'changed')]);
    expect(check.plan).not.toHaveBeenCalled();
  });
});

describe('skipped ticks', () => {
  it('while the follower has a backlog', async () => {
    await lockedTake();
    mockEngine.getStats.mockReturnValue({
      ...mockEngine.getStats(),
      backlog: 2,
    });
    await heard([opinion(4, 'changed')]);
    expect(model.run).not.toHaveBeenCalled();
    expect(shown()).toEqual([]);
  });

  it('while a run is in flight', async () => {
    let answer: (out: ModelOutput) => void = () => undefined;
    modelAnswer = () =>
      new Promise(resolve => {
        answer = resolve;
      });
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    await heard();
    await heard();
    expect(model.run).toHaveBeenCalledTimes(1);
    answer({logp: new Float32Array(31), frames: 1});
    await jest.advanceTimersByTimeAsync(10);
    expect(shown()).toEqual(['wrong:4']);
  });

  it('on a short read of the frames', async () => {
    mockEngine.readMelFrames.mockImplementation((from: number, to: number) => ({
      first: from,
      frames: to - from - 1,
      data: new Float32Array((to - from - 1) * 80),
    }));
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    expect(model.run).not.toHaveBeenCalled();
    expect(shown()).toEqual([]);
  });

  it('a model that fails shows nothing and hides nothing', async () => {
    modelAnswer = async () => {
      throw new Error('ort');
    };
    await lockedTake();
    chunk([{word: 2, state: 'skipped', detail: {junctionMissing: true}}]);
    await heard([opinion(4, 'changed')]);
    expect(shown()).toEqual(['missed:2']);
  });
});

describe('hidden text', () => {
  const words = Array.from({length: 10}, (_, i) => ({
    verseKey: '18:3',
    wordPositionInVerse: i + 1,
    text: 'w',
  }));

  beforeEach(() => {
    mockSettings.recitationHideText = true;
    digitalKhattModule.digitalKhattDataService.getVerseWords.mockReturnValue(
      words,
    );
  });

  it('holds a mark until its word is revealed', async () => {
    await lockedTake(10);
    await heard([opinion(4, 'changed')]);
    expect(shown()).toEqual([]);
    expect(buzzes()).toBe(0);
    engineControl.sendEvent?.(wordProgress(18, 3, 4, 10));
    expect(shown()).toEqual(['wrong:4']);
    expect(buzzes()).toBe(1);
  });

  it('drops it when the reveal does not come in time', async () => {
    await lockedTake(10);
    await heard([opinion(6, 'missed')]);
    for (let i = 0; i < 11; i++) {
      await heard();
      await jest.advanceTimersByTimeAsync(290);
    }
    engineControl.sendEvent?.(wordProgress(18, 3, 6, 10));
    await heard();
    expect(shown()).toEqual([]);
    expect(traced()).toContain(
      'live 18:3 word 7: not revealed in time, dropped',
    );
  });

  it('marks a revealed word at once', async () => {
    await lockedTake(10);
    engineControl.sendEvent?.(wordProgress(18, 3, 5, 10));
    await heard([opinion(4, 'changed')]);
    expect(shown()).toEqual(['wrong:4']);
  });
});

describe('the take’s record', () => {
  async function recorded(): Promise<TakeRecord> {
    await service.stopRecitationTracking();
    await jest.advanceTimersByTimeAsync(0);
    return mockLog.recordTake.mock.calls[0][0];
  }

  it('has a row for a live mark on a word the follower never judged', async () => {
    await lockedTake();
    chunk([{word: 3, state: 'ok'}]);
    await heard([opinion(4, 'changed'), opinion(6, 'missed')]);
    await heard([opinion(6, 'fine', {reading: 1})]);
    const {words} = await recorded();
    expect(words?.map(w => `${w.word}:${w.result}:${w.kind ?? '-'}`)).toEqual([
      '4:correct:-',
      '5:mistake:wrong',
      '7:corrected:missed',
    ]);
  });

  it('has a dismissed row for one the reader dismissed', async () => {
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    await service.dismissRecitationMark({surah: 18, ayah: 3, word: 4});
    const {words} = await recorded();
    expect(words?.map(w => `${w.word}:${w.result}:${w.kind}`)).toEqual([
      '5:dismissed:wrong',
    ]);
  });

  it('keeps the live mark on a word the follower judged in its own row', async () => {
    await lockedTake();
    chunk([{word: 4, state: 'ok'}]);
    await heard([opinion(4, 'changed')]);
    const {words} = await recorded();
    expect(words?.map(w => `${w.word}:${w.result}`)).toEqual(['5:mistake']);
  });

  it('lists live marks in the summary', async () => {
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    await recorded();
    expect(state().summary?.marks).toEqual([
      {surah: 18, ayah: 3, word: 5, kind: 'wrong', status: 'mistake'},
    ]);
  });
});

describe('stop', () => {
  it('flushes nothing the check had not settled', async () => {
    let answer: (out: ModelOutput) => void = () => undefined;
    modelAnswer = () =>
      new Promise(resolve => {
        answer = resolve;
      });
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    await service.stopRecitationTracking();
    expect(mockEngine.setChunkListener).toHaveBeenLastCalledWith(null);
    answer({logp: new Float32Array(31), frames: 1});
    await jest.advanceTimersByTimeAsync(10);
    expect(check.step).not.toHaveBeenCalled();
    expect(shown()).toEqual([]);
    expect(buzzes()).toBe(0);
  });

  it('keeps the live marks on the page until the next take', async () => {
    await lockedTake();
    await heard([opinion(4, 'changed')]);
    await service.stopRecitationTracking();
    expect(shown()).toEqual(['wrong:4']);
  });
});
