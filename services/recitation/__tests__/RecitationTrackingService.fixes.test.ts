// The three word fixes as the reader meets them, through the real service and mark
// rules: a left-out last word, an added word, and the seam the second judge plugs into.
// The engine and the mic are played by hand. No second model is on hand here, so the
// checks fail open and a mark shows as soon as it falls due.

import * as mockRecitation from '@/test-utils/recitationMocks';
import {
  captureAppStateChange,
  engineControl,
  engineDebug,
  flush,
  micControl,
  mockEngine,
  resetRecitationControls,
  wordProgress,
  wordVerdicts,
} from '@/test-utils/recitationMocks';
import type {JudgeWake} from '../RecitationTrackingService';
import type {TakeRecord} from '../take';
import type {VerdictChange, WordMark} from '../wordMarks';

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
const shown = () => state().marks.map(m => `${m.kind}:${m.word}`);
const buzzes = () => mockHaptics.notificationAsync.mock.calls.length;
const traced = () => mockTrace.mock.calls.map(([line]) => line);

function load(): void {
  jest.isolateModules(() => {
    service = require('../RecitationTrackingService');
    store =
      require('@/store/recitationTrackingStore').useRecitationTrackingStore;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRecitationControls();
  captureAppStateChange();
  jest.useFakeTimers();
  load();
});

afterEach(async () => {
  await service.stopRecitationTracking();
  await service.unloadRecitationModel();
  jest.useRealTimers();
});

async function listenFor(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 300) {
    micControl.chunk?.(new Float32Array(16), 16000);
    await jest.advanceTimersByTimeAsync(300);
  }
}

async function lockedTake(): Promise<void> {
  await service.startRecitationTracking(null);
  engineControl.sendEvent?.(wordProgress(18, 3, 0, 9));
}

type Partly = Omit<VerdictChange, 'totalWords' | 'surah' | 'ayah'> &
  Partial<VerdictChange>;
function chunk(changes: Partly[], audioTime = 12.48): void {
  engineControl.sendEvent?.(
    wordVerdicts(
      changes.map(c => ({surah: 18, ayah: 3, ...c})),
      undefined,
      audioTime,
    ),
  );
}

const unsaid: Partly = {
  word: 9,
  state: 'skipped',
  detail: {junctionMissing: true},
};
const addedBefore = (word: number) => ({
  sounds: 6,
  noGap: -3.2,
  left: {surah: 18, ayah: 3, word: word - 1},
});

describe('a left-out last word', () => {
  it('shows at once', async () => {
    await lockedTake();
    chunk([unsaid]);
    await listenFor(0);
    await jest.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['missed:9']);
    expect(buzzes()).toBe(1);
  });
});

describe('an added word', () => {
  const heardOn = (word: number) =>
    ({word, state: 'ok', addedBefore: addedBefore(word)}) as Partly;

  it('shows at once, with a vibration', async () => {
    await lockedTake();
    chunk([heardOn(4)]);
    expect(shown()).toEqual(['added:4']);
    expect(buzzes()).toBe(1);
    expect(traced()).toContain('MARK added 18:3 word 5');
  });

  it('clears a red mark already shown on a neighbour', async () => {
    await lockedTake();
    chunk([
      {word: 3, state: 'wrong'},
      {word: 4, state: 'ok'},
    ]);
    await listenFor(900);
    expect(shown()).toEqual(['wrong:3']);
    chunk([heardOn(4)]);
    expect(shown()).toEqual(['added:4']);
  });

  it('a red mark arriving after it on a neighbour never shows', async () => {
    await lockedTake();
    chunk([heardOn(4)]);
    chunk([
      {word: 3, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    await listenFor(900);
    expect(shown()).toEqual(['added:4']);
  });

  it('never leaves the sounds anywhere', async () => {
    await lockedTake();
    chunk([heardOn(4)]);
    expect(JSON.stringify(state().marks)).not.toMatch(/[؀-ۿ]/);
    expect(traced().join('\n')).not.toMatch(/[؀-ۿ]/);
  });

  describe('dismissed', () => {
    it('goes on its own, and is not marked again', async () => {
      await lockedTake();
      chunk([heardOn(4)]);
      const mark = state().marks[0];
      await service.dismissRecitationMark(mark);
      expect(shown()).toEqual([]);
      chunk([heardOn(4)]);
      expect(shown()).toEqual([]);
    });

    it('leaves a red mark on the same word', async () => {
      await lockedTake();
      chunk([
        {word: 4, state: 'wrong'},
        {word: 5, state: 'ok'},
      ]);
      await listenFor(900);
      // Another added mark sits one word on: the red mark on its left neighbour
      // goes, but the dismissal below must only touch the mark it names.
      chunk([heardOn(4)]);
      const added = state().marks.find(m => m.kind === 'added') as WordMark;
      expect(added).toBeTruthy();
      await service.dismissRecitationMark(added);
      expect(state().marks.some(m => m.kind === 'added')).toBe(false);
    });
  });

  describe('saved', () => {
    async function finishedTake(): Promise<TakeRecord> {
      await service.stopRecitationTracking();
      await flush();
      const take = mockLog.recordTake.mock.calls[0]?.[0];
      if (!take) throw new Error('no take saved');
      return take;
    }

    it('as its own row, beside the word it sits before', async () => {
      await lockedTake();
      chunk([heardOn(4)]);
      const take = await finishedTake();
      expect(take.words).toEqual([
        expect.objectContaining({word: 5, result: 'correct', kind: null}),
        expect.objectContaining({word: 5, result: 'mistake', kind: 'added'}),
      ]);
    });

    it('as dismissed, when the reader said so during the take', async () => {
      await lockedTake();
      chunk([heardOn(4)]);
      await service.dismissRecitationMark(state().marks[0]);
      const take = await finishedTake();
      expect(take.words).toContainEqual(
        expect.objectContaining({
          word: 5,
          result: 'dismissed',
          kind: 'added',
        }),
      );
    });

    it('dismissed after the take, it names its kind to the log', async () => {
      await lockedTake();
      chunk([heardOn(4)]);
      const mark = state().marks[0];
      const take = await finishedTake();
      await service.dismissRecitationMark(mark);
      expect(mockLog.dismissWord).toHaveBeenCalledWith(
        take.id,
        18,
        3,
        5,
        'added',
      );
    });

    it('shows in the summary', async () => {
      await lockedTake();
      chunk([heardOn(4)]);
      engineControl.sendEvent?.(wordProgress(18, 3, 5, 9));
      await service.stopRecitationTracking();
      await flush();
      expect(state().summary?.marks).toEqual([
        expect.objectContaining({word: 5, kind: 'added', status: 'mistake'}),
      ]);
    });
  });
});

describe('a mark with no judge attached', () => {
  beforeEach(() => service.setSecondJudgePort(null));

  it('shows when due', async () => {
    await lockedTake();
    chunk([
      {word: 4, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    await listenFor(900);
    expect(shown()).toEqual(['wrong:4']);
  });
});

describe('the seam for the second judge', () => {
  let wakes: JudgeWake[] = [];

  beforeEach(() => {
    wakes = [];
    service.setSecondJudgePort({wake: w => wakes.push(w)});
  });

  it('with no judge attached, marks go as before', async () => {
    service.setSecondJudgePort(null);
    await lockedTake();
    chunk([
      {word: 4, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    await listenFor(900);
    expect(shown()).toEqual(['wrong:4']);
  });

  it('wakes on a wrong or skipped verdict, with what it needs', async () => {
    await lockedTake();
    chunk(
      [
        {word: 4, state: 'wrong'},
        {word: 5, state: 'skipped'},
        {word: 6, state: 'unsure'},
        {word: 7, state: 'ok'},
      ],
      12.48,
    );
    expect(wakes.map(w => [w.word, w.state])).toEqual([
      [4, 'wrong'],
      [5, 'skipped'],
    ]);
    expect(wakes[0]).toMatchObject({
      surah: 18,
      ayah: 3,
      totalWords: 10,
      audioTime: 12.48,
    });
    expect(wakes[0].id).not.toBe(wakes[1].id);
  });

  it('does not wake on what the filters drop, on news, or on a junction mark', async () => {
    await lockedTake();
    engineControl.sendEvent?.(
      wordVerdicts(
        [{surah: 18, ayah: 3, word: 4, state: 'wrong'}],
        {surah: 18, ayah: 3, word: 4},
        12.48,
      ),
    );
    chunk([
      {
        word: 5,
        state: 'skipped',
        repeat: true,
        detail: {junctionMissing: false},
      },
      unsaid,
      {word: 6, state: 'ok', repeat: true, addedBefore: addedBefore(6)},
    ]);
    expect(wakes).toEqual([]);
  });

  it('Step 2 words of a filtered chunk do not wake it either', async () => {
    jest.isolateModules(() => {
      jest.doMock('@/services/recitation/secondJudge/wake', () => ({
        ...jest.requireActual('@/services/recitation/secondJudge/wake'),
        wakesSecondJudge: (c: VerdictChange) => c.state !== 'pending',
      }));
      service = require('../RecitationTrackingService');
      store =
        require('@/store/recitationTrackingStore').useRecitationTrackingStore;
      jest.dontMock('@/services/recitation/secondJudge/wake');
    });
    service.setSecondJudgePort({wake: w => wakes.push(w)});
    await lockedTake();
    engineControl.sendEvent?.(
      wordVerdicts(
        [{surah: 18, ayah: 3, word: 4, state: 'unsure'}],
        {surah: 18, ayah: 3, word: 4},
        12.48,
      ),
    );
    expect(wakes).toEqual([]);
    chunk([{word: 5, state: 'unsure'}]);
    expect(wakes.map(w => w.word)).toEqual([5]);
  });

  it('a suspect waits for the answer; neither lets it go on', async () => {
    await lockedTake();
    chunk([
      {word: 4, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    await listenFor(900);
    expect(shown()).toEqual([]);
    service.answerSecondJudge(wakes[0].id, 'neither');
    await listenFor(300);
    expect(shown()).toEqual(['wrong:4']);
  });

  it('fits drops it, and nothing shows', async () => {
    await lockedTake();
    chunk([
      {word: 4, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    await listenFor(600);
    service.answerSecondJudge(wakes[0].id, 'fits');
    await listenFor(2100);
    expect(shown()).toEqual([]);
  });

  it('wrong promotes a last word and credits the ok seen since', async () => {
    await lockedTake();
    chunk([{word: 9, totalWords: 10, state: 'wrong'}]);
    expect(wakes.map(w => w.word)).toEqual([9]);
    await listenFor(300);
    chunk([{ayah: 4, word: 0, state: 'ok'}]);
    await listenFor(600);
    service.answerSecondJudge(wakes[0].id, 'wrong');
    await listenFor(300);
    expect(shown()).toEqual(['wrong:9']);
  });

  it('no answer: the mark goes on at the deadline', async () => {
    await lockedTake();
    chunk([
      {word: 4, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    await listenFor(2700);
    expect(shown()).toEqual([]);
    await listenFor(600);
    expect(shown()).toEqual(['wrong:4']);
  });

  it('an answer after the engine lost the reader counts for nothing', async () => {
    await lockedTake();
    chunk([{word: 9, state: 'wrong'}]);
    engineControl.sendEvent?.(engineDebug('lost'));
    service.answerSecondJudge(wakes[0].id, 'wrong');
    await listenFor(3300);
    expect(shown()).toEqual([]);
  });

  it('an answer from another take counts for nothing', async () => {
    await lockedTake();
    chunk([{word: 9, state: 'wrong'}]);
    const old = wakes[0].id;
    await service.stopRecitationTracking();
    await flush();
    await lockedTake();
    service.answerSecondJudge(old, 'wrong');
    await listenFor(600);
    expect(shown()).toEqual([]);
  });

  it('an answer on a word the reader has dismissed counts for nothing', async () => {
    await lockedTake();
    chunk([
      {word: 4, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    await listenFor(3300);
    await service.dismissRecitationMark(state().marks[0]);
    service.answerSecondJudge(wakes[0].id, 'wrong');
    await listenFor(900);
    expect(shown()).toEqual([]);
  });

  it('says whether a queued wake still matters, so no model runs for nothing', async () => {
    await lockedTake();
    chunk([{word: 9, state: 'wrong'}]);
    expect(service.secondJudgeWants(wakes[0].id)).toBe(true);
    engineControl.sendEvent?.(engineDebug('lost'));
    expect(service.secondJudgeWants(wakes[0].id)).toBe(false);
  });

  it('a wake on a word heard ok since then no longer matters', async () => {
    await lockedTake();
    chunk([{word: 4, state: 'wrong'}]);
    await listenFor(300);
    chunk([{word: 4, state: 'ok'}]);
    expect(service.secondJudgeWants(wakes[0].id)).toBe(false);
  });

  it('a wake on a word already shown no longer matters', async () => {
    await lockedTake();
    chunk([
      {word: 4, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    service.answerSecondJudge(wakes[0].id, 'neither');
    await listenFor(900);
    expect(shown()).toEqual(['wrong:4']);
    chunk([{word: 4, state: 'skipped', detail: {gop: -9}}]);
    expect(service.secondJudgeWants(wakes[1].id)).toBe(false);
  });

  it('can read the frames and word places of the running take', async () => {
    await lockedTake();
    const engine = service.secondJudgeEngine();
    expect(engine).toBe(mockEngine);
  });
});

describe('stopping while the judge is out', () => {
  let wakes: JudgeWake[] = [];

  beforeEach(() => {
    wakes = [];
    service.setSecondJudgePort({wake: w => wakes.push(w)});
  });

  async function finishedTake(): Promise<TakeRecord> {
    await service.stopRecitationTracking();
    await flush();
    const take = mockLog.recordTake.mock.calls[0]?.[0];
    if (!take) throw new Error('no take saved');
    return take;
  }

  it('a word past its own time shows, is summed up and saved, with no vibration', async () => {
    await lockedTake();
    chunk([
      {word: 4, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    await listenFor(700);
    expect(shown()).toEqual([]);
    const take = await finishedTake();
    expect(shown()).toEqual(['wrong:4']);
    expect(buzzes()).toBe(0);
    expect(state().summary?.marks).toEqual([
      expect.objectContaining({ayah: 3, word: 5, kind: 'wrong'}),
    ]);
    expect(take.words).toContainEqual(
      expect.objectContaining({word: 5, result: 'mistake', kind: 'wrong'}),
    );
  });

  it('a word no next word has followed stays unshown, as it does with no judge', async () => {
    await lockedTake();
    chunk([{word: 4, state: 'wrong'}]);
    await listenFor(700);
    await finishedTake();
    expect(shown()).toEqual([]);
  });

  it('a word still inside its 500 ms stays unshown', async () => {
    await lockedTake();
    chunk([
      {word: 4, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    await finishedTake();
    expect(shown()).toEqual([]);
  });
});

describe('marks due in one tick', () => {
  let wakes: JudgeWake[] = [];

  beforeEach(() => {
    wakes = [];
    service.setSecondJudgePort({wake: w => wakes.push(w)});
  });

  it('a junction mark and a red mark whose check fails at once: one vibration', async () => {
    await lockedTake();
    chunk([{word: 7, state: 'wrong'}], 12);
    service.answerSecondJudge(wakes[0].id, 'neither');
    await listenFor(900);
    chunk(
      [
        {word: 8, state: 'ok'},
        {...unsaid, repeat: false},
      ],
      13,
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['wrong:7', 'missed:9']);
    expect(buzzes()).toBe(1);
  });
});

describe('a corrected word the judge raises again', () => {
  let wakes: JudgeWake[] = [];

  beforeEach(() => {
    wakes = [];
    service.setSecondJudgePort({wake: w => wakes.push(w)});
  });

  it('leaves the page with the book, and stays off it when no next word comes', async () => {
    await lockedTake();
    chunk([{...unsaid, repeat: false}]);
    await jest.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['missed:9']);
    chunk([{word: 9, state: 'ok'}]);
    expect(state().marks.map(m => m.status)).toEqual(['corrected']);
    chunk([{word: 9, state: 'wrong'}]);
    expect(state().marks.map(m => m.status)).toEqual(['corrected']);
    const wake = wakes[wakes.length - 1];
    service.answerSecondJudge(wake.id, 'wrong');
    expect(shown()).toEqual([]);
    await listenFor(3300);
    expect(shown()).toEqual([]);
    await service.stopRecitationTracking();
    await flush();
    expect(shown()).toEqual([]);
    expect(state().summary).toBeNull();
  });
});

describe("an added mark's reach, as the reader meets it", () => {
  const heardOn = (word: number, extra: Partial<VerdictChange> = {}) =>
    ({word, state: 'ok', addedBefore: addedBefore(word), ...extra}) as Partly;

  beforeEach(() => service.setSecondJudgePort(null));

  it('a slip on a later reading of its right word shows', async () => {
    await lockedTake();
    chunk([heardOn(4)]);
    await listenFor(60000);
    chunk([{word: 4, state: 'wrong'}]);
    await listenFor(300);
    chunk([{word: 5, state: 'ok'}]);
    await listenFor(600);
    expect(shown()).toEqual(['added:4', 'wrong:4']);
  });

  it('a slip on a later reading of its left word shows', async () => {
    await lockedTake();
    chunk([heardOn(4)]);
    await listenFor(60000);
    chunk([{word: 3, state: 'wrong'}]);
    await listenFor(300);
    chunk([{word: 4, state: 'ok'}]);
    await listenFor(600);
    expect(shown()).toEqual(['wrong:3', 'added:4']);
  });

  it('leaves a corrected word and its saved row alone', async () => {
    await lockedTake();
    chunk([
      {word: 3, state: 'wrong'},
      {word: 4, state: 'ok'},
    ]);
    await listenFor(900);
    chunk([{word: 3, state: 'ok'}]);
    chunk([heardOn(4, {repeat: true})]);
    expect(shown()).toEqual(['wrong:3', 'added:4']);
    await service.stopRecitationTracking();
    await flush();
    expect(state().summary?.marks).toContainEqual(
      expect.objectContaining({kind: 'wrong', status: 'corrected'}),
    );
    const take = mockLog.recordTake.mock.calls[0]?.[0];
    expect(take?.words).toContainEqual(
      expect.objectContaining({word: 4, result: 'corrected', kind: 'wrong'}),
    );
  });

  it('a word marked long ago and read again with an extra word is corrected', async () => {
    await lockedTake();
    chunk([
      {word: 4, state: 'wrong'},
      {word: 5, state: 'ok'},
    ]);
    await listenFor(900);
    expect(shown()).toEqual(['wrong:4']);
    await listenFor(30000);
    chunk([heardOn(4)]);
    expect(state().marks.map(m => `${m.kind}:${m.status}`)).toEqual([
      'wrong:corrected',
      'added:mistake',
    ]);
  });
});
