// The second judge and the cancel step as the reader meets them, in the order the
// frozen rule gives them (scripts/second-look/RULE.md). The service, the mark rules,
// the queue, the scoring, the table of alternatives and the audio ring are all real.
// Only the native edges are played by hand: the follower, the mic, and the second
// model's session, whose output is made from the letters it is meant to have heard.

import * as mockRecitation from '@/test-utils/recitationMocks';
import {
  captureAppStateChange,
  engineControl,
  engineDebug,
  finalSequence,
  flush,
  micControl,
  mockEngine,
  recitationAssetsModule,
  resetRecitationControls,
  wordProgress,
  wordVerdicts,
} from '@/test-utils/recitationMocks';
import {joinWords, sayTokens} from '@/test-utils/secondLookSignals';
import {tokensOf} from '../secondLook/judge';
import type {ModelOutput} from '../secondLook/model';
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
  recordTake: jest.fn(async (_take: unknown) => undefined),
  dismissedKeys: jest.fn(async () => new Set<string>()),
  dismissWord: jest.fn(async () => undefined),
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
  recitationCancelMayCancel: null as 'all' | 'skipped' | null,
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

// The second model's session, played by hand.
interface ModelCall {
  data: Float32Array;
  frames: number;
  reply: (output: ModelOutput) => void;
  fail: (error: Error) => void;
}
let calls: ModelCall[] = [];
const mockModel = {
  run: jest.fn(
    (data: Float32Array, frames: number) =>
      new Promise<ModelOutput>((reply, fail) => {
        calls.push({data, frames, reply, fail});
      }),
  ),
  release: jest.fn(async () => undefined),
};
const mockLoad = jest.fn(async (_path: string) => mockModel);
jest.mock('@/services/recitation/secondLook/model', () => ({
  loadSecondLookModel: (path: string) => mockLoad(path),
}));

type Service = typeof import('../RecitationTrackingService');
type Store = typeof import('@/store/recitationTrackingStore');
let service: Service;
let store: Store['useRecitationTrackingStore'];

// Sura 112, ayah 1: four words, and word 2 has alternatives.
const AYAH = ['قل', 'هو', 'الله', 'احد'];
const OTHER = 'الذي';
const SLIP = 'الزله';

const say = (words: string[], seed = 5) =>
  sayTokens(joinWords(words, tokensOf), seed);
/** The expected word fits. */
const fits = () => say(AYAH);
/** An alternative was said. */
const wrong = () => say(['قل', 'هو', OTHER, 'احد']);
/** No word was said here. */
const absent = () => say(['قل', 'هو', 'احد']);
/** Near, but no alternative fits and it does not quite fit: the answer is neither. */
const neither = () => say(['قل', 'هو', SLIP, 'احد']);
/** Nothing like it, heard surely: at or below -6 per letter, and neither. */
const nothingLike = () => {
  const {logp, frames} = neither();
  return {logp: logp.map(v => v * 4), frames};
};
/** The padded look: the word as written. */
const asWritten = () => sayTokens(tokensOf('الله'), 9, 25);
/** The padded look: one inner letter changed. */
const changedLetter = () => sayTokens(tokensOf('ازله'), 9, 25);

let melEnd = 0;
function feed(seconds: number): void {
  micControl.chunk?.(new Float32Array(Math.round(seconds * 16000)), 16000);
  melEnd += Math.round(seconds * 100);
}

const CHUNK_MS = 480;
/** One chunk heard, and its time gone by. */
async function nextChunk(): Promise<void> {
  feed(CHUNK_MS / 1000);
  await jest.advanceTimersByTimeAsync(CHUNK_MS);
}
async function chunks(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await nextChunk();
}

function load(config: Record<string, unknown> = {}): void {
  jest.isolateModules(() => {
    jest.doMock('@/services/recitation/secondLook/config', () => ({
      ...jest.requireActual('@/services/recitation/secondLook/config'),
      ...config,
    }));
    service = require('../RecitationTrackingService');
    store =
      require('@/store/recitationTrackingStore').useRecitationTrackingStore;
    jest.dontMock('@/services/recitation/secondLook/config');
  });
}

const state = () => store.getState();
const shown = () => state().marks.map(m => `${m.kind}:${m.word}`);
const buzzes = () => mockHaptics.notificationAsync.mock.calls.length;
const traced = () => mockTrace.mock.calls.map(([line]) => line);

beforeEach(() => {
  jest.clearAllMocks();
  resetRecitationControls();
  calls = [];
  melEnd = 0;
  mockSettings.recitationMistakeHaptics = true;
  mockSettings.recitationCheckMistakes = true;
  mockSettings.recitationCancelMayCancel = null;
  recitationAssetsModule.secondLookModelPath.mockResolvedValue(
    'file:///second.onnx',
  );
  mockLoad.mockResolvedValue(mockModel);
  mockEngine.readMelFrames.mockImplementation((from: number, to: number) => {
    const last = Math.min(to, melEnd);
    const frames = Math.max(0, last - from);
    return {first: from, frames, data: new Float32Array(frames * 80)};
  });
  mockEngine.wordFrames.mockReturnValue(null);
  mockEngine.ayahEnteredAt.mockReturnValue(null);
  mockEngine.wordCount.mockReturnValue(4);
  captureAppStateChange();
  jest.useFakeTimers();
  load();
});

afterEach(async () => {
  await service.stopRecitationTracking();
  await service.unloadRecitationModel();
  jest.useRealTimers();
});

const NOW = 12.48;

async function lockedTake(): Promise<void> {
  await service.startRecitationTracking(null);
  await jest.advanceTimersByTimeAsync(0);
  engineControl.sendEvent?.(wordProgress(112, 1, 0, 4));
  feed(NOW);
}

type Partly = Pick<VerdictChange, 'word' | 'state'> & Partial<VerdictChange>;
function verdicts(changes: Partly[], audioTime = NOW): void {
  engineControl.sendEvent?.(
    wordVerdicts(
      changes.map(c => ({surah: 112, ayah: 1, totalWords: 4, ...c})),
      undefined,
      audioTime,
    ),
  );
}

/** Word 2 is wrong and word 3 heard correctly, in one chunk. */
function slip(word = 2, audioTime = NOW): void {
  verdicts(
    [
      {word, state: 'wrong'},
      {word: word + 1, state: 'ok'},
    ],
    audioTime,
  );
}

// The padded look's features pause between steps, a fake millisecond each.
const FEATURES_MS = 20;

async function reply(call: ModelCall, output: ModelOutput): Promise<void> {
  call.reply(output);
  await jest.advanceTimersByTimeAsync(FEATURES_MS);
}

describe('the second judge runs one chunk after the verdict', () => {
  it('not before', async () => {
    await lockedTake();
    slip();
    await jest.advanceTimersByTimeAsync(CHUNK_MS - 1);
    expect(mockModel.run).not.toHaveBeenCalled();
  });

  it('on the engine’s own log-mel frames, with no second FFT', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    expect(mockModel.run).toHaveBeenCalledTimes(1);
    // No places known: the 8 s before the end of the hold, in frames.
    const first = Math.round(((NOW + 0.48 - 8) * 16000) / 160);
    const last = Math.floor(((NOW + 0.48) * 16000 - 280) / 160) + 1;
    expect(mockEngine.readMelFrames).toHaveBeenCalledWith(first, last);
    expect(calls[0].frames).toBe(last - first);
    const span = mockEngine.readMelFrames.mock.results.find(
      r => r.value.first === first && r.value.frames === last - first,
    )?.value;
    expect(calls[0].data).toBe(span.data);
  });

  it('inside the ayah, from where the follower put its words', async () => {
    mockEngine.wordFrames.mockImplementation(
      (word: {surah: number; ayah: number; word: number}) =>
        word.surah === 112 && word.ayah === 1 && word.word === 0
          ? {from: 300, to: 310}
          : null,
    );
    await lockedTake();
    slip();
    await nextChunk();
    // First word at frame 300, 12 s, less the lag; no ayah before: 1 s more.
    const start = Math.round((300 * 0.04 - 0.23 - 1) * 16000);
    expect(mockEngine.readMelFrames).toHaveBeenCalledWith(
      Math.round(start / 160),
      Math.floor(((NOW + 0.48) * 16000 - 280) / 160) + 1,
    );
  });

  it('not before the end of the ayah before, plus a little', async () => {
    mockEngine.wordFrames.mockImplementation(
      (word: {surah: number; ayah: number; word: number}) => {
        if (word.ayah === 2 && word.word === 0) return {from: 300, to: 310};
        if (word.ayah === 1 && word.word === 3) return {from: 200, to: 260};
        return null;
      },
    );
    await lockedTake();
    verdicts([
      {ayah: 2, word: 1, totalWords: 2, state: 'wrong'},
      {ayah: 3, word: 0, totalWords: 4, state: 'ok'},
    ]);
    await nextChunk();
    expect(mockEngine.wordCount).toHaveBeenCalledWith(112, 1);
    // The earlier of the end of the ayah before + 0.3 s and the first word's place.
    const start = Math.round((260 * 0.04 + 0.3) * 16000);
    const firstAt = Math.round((300 * 0.04 - 0.23 - 0.2) * 16000);
    expect(mockEngine.readMelFrames).toHaveBeenCalledWith(
      Math.round(Math.min(start, firstAt) / 160),
      Math.floor(((NOW + 0.48) * 16000 - 280) / 160) + 1,
    );
  });

  it('waits a moment for a chunk the engine has not heard yet', async () => {
    await lockedTake();
    slip();
    await jest.advanceTimersByTimeAsync(CHUNK_MS + 200);
    expect(mockModel.run).not.toHaveBeenCalled();
    feed(CHUNK_MS / 1000);
    await jest.advanceTimersByTimeAsync(100);
    expect(mockModel.run).toHaveBeenCalledTimes(1);
  });

  it('and with no chunk at all goes on with what has been heard', async () => {
    await lockedTake();
    slip();
    await jest.advanceTimersByTimeAsync(2 * CHUNK_MS + 40);
    expect(mockModel.run).toHaveBeenCalledTimes(1);
  });

  it('the follower never waits: chunks and other marks go on while the model runs', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    expect(calls).toHaveLength(1);
    mockEngine.feed.mockClear();
    await chunks(2);
    expect(mockEngine.feed).toHaveBeenCalledTimes(2);
    // The model has not answered, and a left-out last word still shows at once.
    verdicts(
      [
        {
          ayah: 2,
          word: 1,
          totalWords: 2,
          state: 'skipped',
          detail: {junctionMissing: true},
        },
      ],
      NOW + 1.44,
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['missed:1']);
    expect(calls).toHaveLength(1);
  });
});

describe('what the judge says', () => {
  it('fits on an interior wrong: no mark, no padded look', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], fits());
    await chunks(4);
    expect(calls).toHaveLength(1);
    expect(shown()).toEqual([]);
    expect(buzzes()).toBe(0);
  });

  it('wrong on an ayah’s last word makes a mark the edge rule let go, crediting the ok seen since', async () => {
    await lockedTake();
    verdicts([{word: 3, state: 'wrong'}]);
    await nextChunk();
    verdicts(
      [{surah: 112, ayah: 2, word: 0, totalWords: 2, state: 'ok'}],
      NOW + 0.48,
    );
    expect(calls).toHaveLength(1);
    await reply(calls[0], say(['قل', 'هو', 'الله', 'الذي']));
    // Past the edge rule, it now goes to the cancel step like any other mark.
    expect(calls).toHaveLength(2);
    await reply(calls[1], sayTokens(tokensOf('اسد'), 9, 25));
    await chunks(1);
    expect(state().marks).toEqual([
      expect.objectContaining({word: 3, kind: 'wrong', status: 'mistake'}),
    ]);
  });

  it('absent on a skipped verdict makes a missed mark', async () => {
    await lockedTake();
    verdicts([
      {word: 2, state: 'skipped', detail: {gop: -1}},
      {word: 3, state: 'ok'},
    ]);
    await nextChunk();
    await reply(calls[0], absent());
    expect(calls).toHaveLength(2);
    await reply(calls[1], changedLetter());
    await chunks(1);
    expect(state().marks).toEqual([
      expect.objectContaining({word: 2, kind: 'missed', status: 'mistake'}),
    ]);
  });

  it('neither leaves the verdict as it stands', async () => {
    await lockedTake();
    verdicts([{word: 3, state: 'wrong'}]);
    await nextChunk();
    await reply(calls[0], neither());
    await chunks(8);
    // On an ayah's edge a wrong verdict alone is no mark.
    expect(shown()).toEqual([]);
  });
});

describe('the cancel step', () => {
  async function dueAfterNeither(): Promise<void> {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
  }

  it('asks for the padded look as soon as the judge has answered', async () => {
    await dueAfterNeither();
    expect(calls).toHaveLength(2);
  });

  it('runs it on the raw audio, heard up to the hold, with a second of silence each side', async () => {
    await dueAfterNeither();
    // Features are worked out here, from the ring, not read from the engine.
    expect(calls[1].frames).toBeGreaterThan(200);
    expect(calls[1].frames).toBe(calls[1].data.length / 80);
    const silenceFrames = 100;
    const lead = calls[1].data.slice(0, 80 * (silenceFrames - 3));
    expect(new Set(lead).size).toBe(1);
  });

  it('keeps the mark when a spelling with one inner letter changed beats the word', async () => {
    await dueAfterNeither();
    await reply(calls[1], changedLetter());
    await chunks(1);
    expect(state().marks).toEqual([
      expect.objectContaining({word: 2, kind: 'wrong', status: 'mistake'}),
    ]);
    expect(buzzes()).toBe(1);
  });

  it('cancels the mark when none does', async () => {
    await dueAfterNeither();
    await reply(calls[1], asWritten());
    await chunks(4);
    expect(shown()).toEqual([]);
    expect(buzzes()).toBe(0);
  });

  it('a mark scoring at or below -6 a letter shows with no padded look', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], nothingLike());
    await chunks(1);
    expect(calls).toHaveLength(1);
    expect(shown()).toEqual(['wrong:2']);
  });

  it('a word under three letters that scores above that is cancelled, with no padded look', async () => {
    await lockedTake();
    slip(1);
    await nextChunk();
    await reply(calls[0], say(['قل', 'هر', 'الله', 'احد']));
    await chunks(4);
    expect(calls).toHaveLength(1);
    expect(shown()).toEqual([]);
  });

  it('a cancelled word that goes bad again is checked again, at the new verdict', async () => {
    await dueAfterNeither();
    await reply(calls[1], asWritten());
    await chunks(4);
    expect(shown()).toEqual([]);
    feed(0.48);
    const later = NOW + 5 * 0.48;
    slip(2, later);
    const before = calls.length;
    await nextChunk();
    expect(calls.length).toBe(before + 1);
    await reply(calls[before], nothingLike());
    await chunks(1);
    expect(shown()).toEqual(['wrong:2']);
  });

  it('still counts a cancelled word towards the confusion rule', async () => {
    await dueAfterNeither();
    await reply(calls[1], asWritten());
    await chunks(1);
    expect(shown()).toEqual([]);
    // Two more bad words around a new one: with the cancelled word that makes three,
    // so the new one is confusion and is dropped, whatever the checks say.
    const inLong = (word: number, state: VerdictChange['state']) => ({
      word,
      state,
      totalWords: 9,
    });
    verdicts(
      [
        inLong(0, 'skipped'),
        inLong(1, 'skipped'),
        inLong(3, 'wrong'),
        inLong(4, 'ok'),
      ],
      NOW + 0.96,
    );
    await nextChunk();
    // None of them fits, or the judge would let it off and it would not count.
    const {logp, frames} = say(['قر', 'هب', SLIP, 'اسد']);
    await reply(calls[2], {logp: logp.map(v => v * 4), frames});
    await chunks(7);
    expect(calls).toHaveLength(3);
    expect(shown()).toEqual([]);
  });

  describe('a junction mark', () => {
    it('shows at once, and no model runs for it', async () => {
      await lockedTake();
      verdicts([{word: 3, state: 'skipped', detail: {junctionMissing: true}}]);
      await jest.advanceTimersByTimeAsync(0);
      expect(shown()).toEqual(['missed:3']);
      await chunks(2);
      expect(mockModel.run).not.toHaveBeenCalled();
    });
  });

  describe('switched to skipped marks only', () => {
    beforeEach(() => load({CANCEL_MAY_CANCEL: 'skipped'}));

    it('a wrong mark shows with no padded look', async () => {
      await lockedTake();
      slip();
      await nextChunk();
      await reply(calls[0], neither());
      await chunks(1);
      expect(calls).toHaveLength(1);
      expect(shown()).toEqual(['wrong:2']);
    });

    it('a missed mark still goes through it', async () => {
      await lockedTake();
      verdicts([
        {word: 2, state: 'skipped', detail: {gop: -9}},
        {word: 3, state: 'ok'},
      ]);
      await nextChunk();
      await reply(calls[0], neither());
      expect(calls).toHaveLength(2);
      await reply(calls[1], asWritten());
      await chunks(4);
      expect(shown()).toEqual([]);
    });
  });

  describe('the switch set on the phone', () => {
    it('skipped marks only: a wrong mark shows with no padded look', async () => {
      mockSettings.recitationCancelMayCancel = 'skipped';
      await lockedTake();
      slip();
      await nextChunk();
      await reply(calls[0], neither());
      await chunks(1);
      expect(calls).toHaveLength(1);
      expect(shown()).toEqual(['wrong:2']);
    });

    it('all marks: it wins over a build set to skipped marks only', async () => {
      load({CANCEL_MAY_CANCEL: 'skipped'});
      mockSettings.recitationCancelMayCancel = 'all';
      await lockedTake();
      slip();
      await nextChunk();
      await reply(calls[0], neither());
      expect(calls).toHaveLength(2);
      await reply(calls[1], asWritten());
      await chunks(4);
      expect(shown()).toEqual([]);
    });

    it('is read at the start of a take', async () => {
      await lockedTake();
      mockSettings.recitationCancelMayCancel = 'skipped';
      slip();
      await nextChunk();
      await reply(calls[0], neither());
      expect(calls).toHaveLength(2);
    });
  });

  describe('at Step 2', () => {
    beforeEach(() => load({JUDGE_STEP: 2}));

    it('an unsure word wakes the judge', async () => {
      await lockedTake();
      verdicts([{word: 2, state: 'unsure'}]);
      await nextChunk();
      expect(calls).toHaveLength(1);
    });

    it('a word the judge identified shows with no padded look', async () => {
      await lockedTake();
      verdicts([
        {word: 2, state: 'unsure'},
        {word: 3, state: 'ok'},
      ]);
      await nextChunk();
      await reply(calls[0], wrong());
      await chunks(1);
      expect(calls).toHaveLength(1);
      expect(shown()).toEqual(['wrong:2']);
    });

    it('a mark it did not identify still goes through the cancel step', async () => {
      await lockedTake();
      slip();
      await nextChunk();
      await reply(calls[0], neither());
      expect(calls).toHaveLength(2);
      await reply(calls[1], asWritten());
      await chunks(4);
      expect(shown()).toEqual([]);
    });
  });

  describe('at Step 1', () => {
    it('an unsure word does not wake the judge', async () => {
      await lockedTake();
      verdicts([{word: 2, state: 'unsure'}]);
      await chunks(2);
      expect(calls).toHaveLength(0);
    });

    it('a word the judge identified still goes through the cancel step', async () => {
      await lockedTake();
      slip();
      await nextChunk();
      await reply(calls[0], wrong());
      expect(calls).toHaveLength(2);
      await reply(calls[1], asWritten());
      await chunks(4);
      expect(shown()).toEqual([]);
    });
  });
});

describe('the wait', () => {
  it('a mark falling due after the checks are done shows at its due time', async () => {
    await lockedTake();
    // The next word is not heard for a while.
    verdicts([{word: 2, state: 'wrong'}]);
    await nextChunk();
    await reply(calls[0], neither());
    await reply(calls[1], changedLetter());
    expect(shown()).toEqual([]);
    verdicts([{word: 3, state: 'ok'}], NOW + 0.96);
    await jest.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['wrong:2']);
  });

  it('a mark falling due during the padded look waits only for what is left', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    expect(calls).toHaveLength(2);
    await chunks(1);
    expect(shown()).toEqual([]);
    expect(calls).toHaveLength(2);
    await reply(calls[1], changedLetter());
    expect(shown()).toEqual(['wrong:2']);
  });

  it('a suspect waits for the judge, past its own due time', async () => {
    await lockedTake();
    slip();
    await chunks(2);
    expect(shown()).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('a word heard ok while the judge runs is no mark, whatever it says', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    verdicts([{word: 2, state: 'ok'}], NOW + 0.48);
    await reply(calls[0], nothingLike());
    await chunks(4);
    expect(shown()).toEqual([]);
  });

  it('a word heard ok during the padded look is no mark, whatever it says', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    verdicts([{word: 2, state: 'ok'}], NOW + 0.96);
    await reply(calls[1], changedLetter());
    await chunks(4);
    expect(shown()).toEqual([]);
  });

  it('a suspect never followed is dropped, and shows nothing', async () => {
    await lockedTake();
    verdicts([{word: 2, state: 'wrong'}]);
    await nextChunk();
    await reply(calls[0], neither());
    await reply(calls[1], changedLetter());
    await chunks(8);
    expect(shown()).toEqual([]);
    expect(buzzes()).toBe(0);
  });
});

describe('while a padded look runs', () => {
  async function checking(): Promise<void> {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    await chunks(1);
    expect(calls).toHaveLength(2);
  }

  it('an unsure verdict leaves it to the answer', async () => {
    await checking();
    verdicts([{word: 2, state: 'unsure'}], NOW + 0.96);
    await reply(calls[1], changedLetter());
    expect(shown()).toEqual(['wrong:2']);
  });

  it('losing the reader leaves it to the answer: only suspects drop', async () => {
    await checking();
    engineControl.sendEvent?.(engineDebug('lost'));
    await reply(calls[1], changedLetter());
    expect(shown()).toEqual(['wrong:2']);
  });

  it('marks already shown stay, and other words go on as normal', async () => {
    await checking();
    await reply(calls[1], changedLetter());
    expect(shown()).toEqual(['wrong:2']);
    verdicts(
      [
        {ayah: 3, word: 2, totalWords: 4, state: 'wrong'},
        {ayah: 3, word: 3, totalWords: 4, state: 'ok'},
      ],
      NOW + 0.96,
    );
    await nextChunk();
    await reply(calls[2], say(['لم', 'يلد', 'وزم', 'يولد']));
    await reply(calls[3], sayTokens(tokensOf('ولم'), 9, 25));
    await chunks(1);
    expect(shown()).toEqual(['wrong:2']);
    expect(buzzes()).toBe(1);
  });

  it('an older answer does not settle a newer check of the same word', async () => {
    await checking();
    // It flips back, then goes bad again and comes up for a second check.
    verdicts([{word: 2, state: 'ok'}], NOW + 0.96);
    await nextChunk();
    slip(2, NOW + 1.44);
    await nextChunk();
    await reply(calls[1], asWritten());
    expect(calls).toHaveLength(3);
    await reply(calls[2], neither());
    await reply(calls[3], changedLetter());
    await chunks(1);
    expect(shown()).toEqual(['wrong:2']);
    expect(buzzes()).toBe(1);
  });

  it('a junction mark on the word takes over, and shows at once', async () => {
    await lockedTake();
    verdicts([
      {word: 3, state: 'wrong'},
      {ayah: 2, word: 0, totalWords: 2, state: 'ok'},
    ]);
    await nextChunk();
    await reply(calls[0], say(['قل', 'هو', 'الله', 'الذي']));
    await jest.advanceTimersByTimeAsync(0);
    verdicts(
      [{word: 3, state: 'skipped', detail: {junctionMissing: true}}],
      NOW + 0.48,
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['missed:3']);
  });
});

describe('several marks at once', () => {
  // Sura 112 ayah 3: two words of it near but not on the text, sharing one first pass.
  const SAID = ['لم', 'يزد', 'وزم', 'يولد'];
  const bothBad = () =>
    verdicts([
      {ayah: 3, word: 1, totalWords: 4, state: 'wrong'},
      {ayah: 3, word: 2, totalWords: 4, state: 'wrong'},
      {ayah: 3, word: 3, totalWords: 4, state: 'ok'},
    ]);
  const paddedKeeps = () => sayTokens(tokensOf('وزم'), 9, 25);
  const paddedCancels = () => sayTokens(tokensOf('ولم'), 9, 25);

  // The model takes real time: the words are past their 500 ms when it answers.
  const MODEL_MS = 100;

  async function bothChecking(): Promise<void> {
    await lockedTake();
    bothBad();
    await nextChunk();
    await jest.advanceTimersByTimeAsync(MODEL_MS);
    await reply(calls[0], say(SAID));
    await jest.advanceTimersByTimeAsync(40);
    expect(calls).toHaveLength(2);
  }

  it('each gets its padded look, one at a time', async () => {
    await bothChecking();
    await reply(calls[1], paddedKeeps());
    expect(calls).toHaveLength(3);
  });

  it('show together, with one vibration, once all have answered', async () => {
    await bothChecking();
    await reply(calls[1], paddedKeeps());
    expect(shown()).toEqual([]);
    await reply(calls[2], paddedKeeps());
    expect(state().marks.map(m => m.word)).toEqual([1, 2]);
    expect(buzzes()).toBe(1);
  });

  it('only the ones that stay show', async () => {
    await bothChecking();
    await reply(calls[1], paddedCancels());
    await reply(calls[2], paddedKeeps());
    expect(state().marks).toHaveLength(1);
    expect(buzzes()).toBe(1);
  });

  it('none show if none stay', async () => {
    await bothChecking();
    await reply(calls[1], paddedCancels());
    await reply(calls[2], paddedCancels());
    await chunks(1);
    expect(shown()).toEqual([]);
    expect(buzzes()).toBe(0);
  });

  it.each([0, 100, 300])(
    'one vibration with a first pass of %d ms past the hold',
    async ms => {
      await lockedTake();
      bothBad();
      await nextChunk();
      await jest.advanceTimersByTimeAsync(ms);
      await reply(calls[0], say(SAID));
      await jest.advanceTimersByTimeAsync(40);
      await reply(calls[1], paddedKeeps());
      await jest.advanceTimersByTimeAsync(40);
      await reply(calls[2], paddedKeeps());
      await jest.advanceTimersByTimeAsync(40);
      expect(state().marks.map(m => m.word)).toEqual([1, 2]);
      expect(buzzes()).toBe(1);
    },
  );

  it('one vibration when both score too low for a padded look', async () => {
    await lockedTake();
    bothBad();
    await nextChunk();
    await jest.advanceTimersByTimeAsync(200);
    const {logp, frames} = say(SAID);
    await reply(calls[0], {logp: logp.map(v => v * 4), frames});
    await jest.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(1);
    expect(state().marks.map(m => m.word)).toEqual([1, 2]);
    expect(buzzes()).toBe(1);
  });

  it('one gone during the check: the other still shows', async () => {
    await bothChecking();
    verdicts([{ayah: 3, word: 1, totalWords: 4, state: 'ok'}], NOW + 0.96);
    await reply(calls[1], paddedKeeps());
    expect(state().marks.map(m => m.word)).toEqual([2]);
    expect(buzzes()).toBe(1);
    // The one gone needs no padded look of its own.
    expect(calls).toHaveLength(2);
  });
});

describe('a mark still in its second look', () => {
  async function checkingWord2(): Promise<void> {
    await lockedTake();
    verdicts([{word: 2, state: 'wrong'}]);
    await nextChunk();
    await reply(calls[0], neither());
    expect(calls).toHaveLength(2);
    // The next word comes with another word's junction mark: both fall due at once.
    verdicts(
      [
        {word: 3, state: 'ok'},
        {
          ayah: 2,
          word: 1,
          totalWords: 2,
          state: 'skipped',
          detail: {junctionMissing: true},
        },
      ],
      NOW + 0.48,
    );
    await jest.advanceTimersByTimeAsync(0);
  }

  it('stays off the page when a junction mark shows beside it', async () => {
    await checkingWord2();
    expect(shown()).toEqual(['missed:1']);
    expect(buzzes()).toBe(1);
    expect(traced()).not.toContain('MARK wrong 112:1 word 3');
  });

  it('cancelled, it never reaches the page, the summary or the saved take', async () => {
    await checkingWord2();
    await reply(calls[1], asWritten());
    expect(shown()).toEqual(['missed:1']);
    await chunks(4);
    expect(shown()).toEqual(['missed:1']);
    await service.stopRecitationTracking();
    await flush();
    expect(shown()).toEqual(['missed:1']);
    expect(state().summary?.marks.map(m => m.kind)).toEqual(['missed']);
    const saved = mockLog.recordTake.mock.calls[0]?.[0] as {
      words: {word: number; result: string}[];
    };
    expect(saved.words).not.toContainEqual(
      expect.objectContaining({word: 3, result: 'mistake'}),
    );
    expect(buzzes()).toBe(1);
  });

  it('kept, it shows with a vibration of its own', async () => {
    await checkingWord2();
    await reply(calls[1], changedLetter());
    expect(shown()).toEqual(['wrong:2', 'missed:1']);
    expect(buzzes()).toBe(2);
  });
});

describe('stopping during the first pass', () => {
  it('a word past its own time shows, with no vibration', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await jest.advanceTimersByTimeAsync(220);
    expect(calls).toHaveLength(1);
    expect(shown()).toEqual([]);
    await service.stopRecitationTracking();
    await flush();
    expect(shown()).toEqual(['wrong:2']);
    expect(buzzes()).toBe(0);
    expect(state().summary?.marks.map(m => m.kind)).toEqual(['wrong']);
  });
});

describe("the judge's answer at the end of its time", () => {
  it('a late chunk and a slow model: its fits still drops the word', async () => {
    await lockedTake();
    slip();
    // The chunk the slice ends on never comes, so the first pass starts two chunks on.
    await jest.advanceTimersByTimeAsync(2 * CHUNK_MS + 40);
    expect(calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1900);
    expect(shown()).toEqual([]);
    await reply(calls[0], fits());
    await jest.advanceTimersByTimeAsync(100);
    expect(shown()).toEqual([]);
    // No padded look: the word has gone.
    expect(calls).toHaveLength(1);
  });

  it('nothing lasts past the time a suspect waits', () => {
    const {holdSeconds} = jest.requireActual<
      typeof import('../followerConstants.npl.json')
    >('../followerConstants.npl.json').secondJudge;
    const {CHECK_TIMEOUT_MS} = jest.requireActual<
      typeof import('../secondLook/config')
    >('../secondLook/config');
    const {JUDGE_WAIT_MS} =
      jest.requireActual<typeof import('../wordMarks')>('../wordMarks');
    expect(JUDGE_WAIT_MS).toBeGreaterThan(
      2 * holdSeconds * 1000 + CHECK_TIMEOUT_MS,
    );
  });
});

describe('a junction mark and the first pass', () => {
  const lastWord = {ayah: 2, word: 1, totalWords: 2} as const;

  it('shows at once with the first pass running', async () => {
    await lockedTake();
    verdicts([{...lastWord, state: 'skipped', detail: {gop: -9}}]);
    await nextChunk();
    expect(calls).toHaveLength(1);
    verdicts(
      [
        {
          ...lastWord,
          state: 'skipped',
          repeat: true,
          detail: {junctionMissing: true},
        },
      ],
      NOW + 0.48,
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['missed:1']);
    expect(buzzes()).toBe(1);
  });

  it('shows at once with the wake still in its hold', async () => {
    await lockedTake();
    verdicts([{...lastWord, state: 'skipped', detail: {gop: -9}}]);
    await jest.advanceTimersByTimeAsync(100);
    verdicts(
      [
        {
          ...lastWord,
          state: 'skipped',
          repeat: true,
          detail: {junctionMissing: true},
        },
      ],
      NOW + 0.1,
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(shown()).toEqual(['missed:1']);
  });
});

describe('a slice about an older verdict says fits', () => {
  it('the newer verdict stands, and shows', async () => {
    await lockedTake();
    verdicts([{word: 2, state: 'wrong', detail: {gop: -3}}]);
    await nextChunk();
    expect(calls).toHaveLength(1);
    verdicts(
      [
        {word: 2, state: 'skipped', detail: {gop: -9}},
        {word: 3, state: 'ok'},
      ],
      NOW + 0.48,
    );
    await reply(calls[0], fits());
    await nextChunk();
    expect(calls).toHaveLength(2);
    await reply(calls[1], nothingLike());
    await chunks(2);
    expect(shown()).toEqual(['missed:2']);
  });
});

describe('a take with marks in it', () => {
  it('saves a word the cancel step let off like any other dropped suspect', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    await reply(calls[1], asWritten());
    await chunks(1);
    mockEngine.stop.mockResolvedValueOnce([
      finalSequence([{surah: 112, ayah: 1, confidence: 0.9}]),
    ]);
    await service.stopRecitationTracking();
    await flush();
    const take = mockLog.recordTake.mock.calls[0][0] as {words: unknown[]};
    expect(take.words).toEqual([
      expect.objectContaining({word: 3, result: 'unclear', kind: null}),
      expect.objectContaining({word: 4, result: 'correct'}),
    ]);
    expect(state().summary?.marks).toEqual([]);
  });

  it('counts a mark still checking at the stop in the summary and the saved take', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    await chunks(1);
    mockEngine.stop.mockResolvedValueOnce([
      finalSequence([{surah: 112, ayah: 1, confidence: 0.9}]),
    ]);
    await service.stopRecitationTracking();
    await flush();
    expect(state().summary?.marks).toEqual([
      {surah: 112, ayah: 1, word: 3, kind: 'wrong', status: 'mistake'},
    ]);
    const take = mockLog.recordTake.mock.calls[0][0] as {words: unknown[]};
    expect(take.words).toContainEqual(
      expect.objectContaining({word: 3, result: 'mistake', kind: 'wrong'}),
    );
  });

  it('a mark already cancelled stays cancelled at the stop', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    await reply(calls[1], asWritten());
    await service.stopRecitationTracking();
    await flush();
    expect(shown()).toEqual([]);
  });

  it('with checking off, nothing is prepared', async () => {
    mockSettings.recitationCheckMistakes = false;
    await service.startRecitationTracking(null);
    await jest.advanceTimersByTimeAsync(0);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('with checking on, the model is prepared when the take starts', async () => {
    await service.startRecitationTracking(null);
    await jest.advanceTimersByTimeAsync(0);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });
});

describe('re-checks', () => {
  it('a later bad verdict at another time gets its own slice', async () => {
    await lockedTake();
    verdicts([{word: 2, state: 'wrong'}]);
    await nextChunk();
    verdicts([{word: 2, state: 'skipped', detail: {gop: -9}}], NOW + 0.48);
    await reply(calls[0], neither());
    await nextChunk();
    // The padded look of the first verdict is not needed: a newer one stands.
    expect(calls.map(c => c.frames)).toHaveLength(2);
    expect(calls[1].frames).toBe(calls[0].frames);
    expect(mockEngine.readMelFrames).toHaveBeenCalledWith(
      Math.round(((NOW + 0.96 - 8) * 16000) / 160),
      Math.floor(((NOW + 0.96) * 16000 - 280) / 160) + 1,
    );
  });

  it('the mark is judged on the slice of its latest bad verdict', async () => {
    await lockedTake();
    verdicts([{word: 2, state: 'wrong'}]);
    await nextChunk();
    verdicts(
      [
        {word: 2, state: 'skipped', detail: {gop: -9}},
        {word: 3, state: 'ok'},
      ],
      NOW + 0.48,
    );
    // The first slice fits badly, at or below -6 a letter; the second is nearer.
    await reply(calls[0], nothingLike());
    await nextChunk();
    await reply(calls[1], neither());
    expect(calls).toHaveLength(3);
    await reply(calls[2], asWritten());
    await chunks(4);
    expect(shown()).toEqual([]);
  });

  it('a verdict on a word already shown runs nothing', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], nothingLike());
    await chunks(1);
    expect(shown()).toEqual(['wrong:2']);
    verdicts([{word: 2, state: 'skipped', detail: {gop: -9}}], NOW + 1.44);
    await chunks(2);
    expect(calls).toHaveLength(1);
  });

  it('a wake whose word was heard ok in the meantime runs nothing', async () => {
    await lockedTake();
    verdicts([{word: 2, state: 'wrong'}]);
    await jest.advanceTimersByTimeAsync(CHUNK_MS - 1);
    feed(0.48);
    verdicts([{word: 2, state: 'ok'}], NOW + 0.48);
    await jest.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(0);
  });
});

describe('the queue under pressure', () => {
  it('a slice still waiting when a newer verdict on its word comes does not run', async () => {
    await lockedTake();
    verdicts([{surah: 2, ayah: 2, word: 2, totalWords: 7, state: 'wrong'}]);
    verdicts([{word: 2, state: 'wrong'}]);
    await nextChunk();
    expect(calls).toHaveLength(1);
    // Both are out of their hold; 112:1 waits behind 2:2. Its word goes bad again.
    verdicts([{word: 2, state: 'skipped', detail: {gop: -9}}], NOW + 0.48);
    await nextChunk();
    await reply(calls[0], fits());
    // The older slice of 112:1 made way: this is the newer one.
    expect(calls).toHaveLength(2);
    expect(mockEngine.readMelFrames).toHaveBeenLastCalledWith(
      Math.round(((NOW + 0.96 - 8) * 16000) / 160),
      Math.floor(((NOW + 0.96) * 16000 - 280) / 160) + 1,
    );
    expect(traced().join('\n')).toMatch(
      /judge 112:1 word 3 wrong at 12\.48 s: neither, no answer \(a newer verdict stands\)/,
    );
  });

  it('a slice already running is not stopped by a newer verdict', async () => {
    await lockedTake();
    verdicts([{word: 2, state: 'wrong'}]);
    await nextChunk();
    verdicts([{word: 2, state: 'skipped', detail: {gop: -9}}], NOW + 0.48);
    await reply(calls[0], neither());
    await nextChunk();
    expect(calls).toHaveLength(2);
    expect(traced().join('\n')).toMatch(
      /judge 112:1 word 3 wrong at 12\.48 s: neither, expected/,
    );
  });
});

describe('the queue', () => {
  /** Bad verdicts on several ayat in one chunk: one slice each. Sura 2 has words. */
  const inAyah = (ayah: number, state: VerdictChange['state'] = 'wrong') => ({
    surah: 2,
    ayah,
    word: 2,
    totalWords: 10,
    state,
  });

  it('runs one model at a time', async () => {
    await lockedTake();
    verdicts([inAyah(2), inAyah(3)]);
    await nextChunk();
    expect(calls).toHaveLength(1);
    await reply(calls[0], fits());
    expect(calls).toHaveLength(2);
  });

  it('words of one ayah in one chunk share one model run', async () => {
    await lockedTake();
    verdicts([
      {word: 1, state: 'wrong'},
      {word: 2, state: 'wrong'},
    ]);
    await nextChunk();
    expect(calls).toHaveLength(1);
    await reply(calls[0], fits());
    await chunks(1);
    expect(calls).toHaveLength(1);
  });

  it('with no room, a wake fails open: the judge says nothing and the mark shows', async () => {
    await lockedTake();
    verdicts([
      inAyah(2),
      inAyah(3),
      inAyah(4),
      inAyah(5),
      inAyah(6),
      inAyah(7),
      {...inAyah(7), word: 3, state: 'ok'},
    ]);
    await nextChunk();
    expect(calls).toHaveLength(1);
    // One running, four waiting. The sixth got no slot.
    expect(traced().join('\n')).toMatch(/2:7 word 3.*no room/);
    await chunks(1);
    expect(shown()).toEqual(['wrong:2']);
    expect(state().marks[0]).toMatchObject({surah: 2, ayah: 7});
  });

  describe('at Step 2', () => {
    beforeEach(() => load({JUDGE_STEP: 2}));

    it('a Step 2 wake goes first to make room for a Step 1 wake', async () => {
      await lockedTake();
      verdicts([
        inAyah(2),
        inAyah(3, 'unsure'),
        inAyah(4),
        inAyah(5),
        inAyah(6),
        inAyah(7),
      ]);
      await nextChunk();
      const lines = traced().join('\n');
      expect(lines).toMatch(/2:3 word 3.*no room/);
      expect(lines).not.toMatch(/2:7 word 3.*no room/);
    });

    it('a Step 2 wake with no room goes itself', async () => {
      await lockedTake();
      verdicts([
        inAyah(2),
        inAyah(3),
        inAyah(4),
        inAyah(5),
        inAyah(6),
        inAyah(7, 'unsure'),
      ]);
      await nextChunk();
      expect(traced().join('\n')).toMatch(/2:7 word 3.*no room/);
    });
  });
});

describe('failing open', () => {
  it('no path through the word: the mark shows', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    // Too few frames for its letters to fit.
    await reply(calls[0], {logp: new Float32Array(3 * 31).fill(-1), frames: 3});
    await chunks(1);
    expect(calls).toHaveLength(1);
    expect(shown()).toEqual(['wrong:2']);
    expect(traced().join('\n')).toMatch(/failed open \(no path\)/);
  });

  it('no letters for the word: the judge says nothing, no model runs, the mark shows', async () => {
    await service.startRecitationTracking(null);
    await jest.advanceTimersByTimeAsync(0);
    engineControl.sendEvent?.(wordProgress(15, 7, 0, 4));
    feed(NOW);
    engineControl.sendEvent?.(
      wordVerdicts(
        [
          {surah: 15, ayah: 7, word: 2, totalWords: 8, state: 'wrong'},
          {surah: 15, ayah: 7, word: 3, totalWords: 8, state: 'ok'},
        ],
        undefined,
        NOW,
      ),
    );
    await chunks(2);
    expect(mockModel.run).not.toHaveBeenCalled();
    expect(shown()).toEqual(['wrong:2']);
  });

  it('no model file: the mark shows as if none of this were here', async () => {
    recitationAssetsModule.secondLookModelPath.mockResolvedValue(null);
    await lockedTake();
    slip();
    await chunks(2);
    expect(mockModel.run).not.toHaveBeenCalled();
    expect(shown()).toEqual(['wrong:2']);
    expect(buzzes()).toBe(1);
  });

  it('too few frames for a slice: the mark shows', async () => {
    mockEngine.readMelFrames.mockImplementation((from: number) => ({
      first: from,
      frames: 10,
      data: new Float32Array(800),
    }));
    await lockedTake();
    slip();
    await chunks(2);
    expect(mockModel.run).not.toHaveBeenCalled();
    expect(shown()).toEqual(['wrong:2']);
  });

  it('frames the ring no longer holds: the mark shows', async () => {
    mockEngine.readMelFrames.mockImplementation((from: number) => ({
      first: from + 50,
      frames: 100,
      data: new Float32Array(8000),
    }));
    await lockedTake();
    slip();
    await chunks(2);
    expect(mockModel.run).not.toHaveBeenCalled();
    expect(shown()).toEqual(['wrong:2']);
  });

  it('the first pass throws: the mark shows', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    calls[0].fail(new Error('out of memory'));
    await flush();
    await chunks(1);
    expect(shown()).toEqual(['wrong:2']);
  });

  it('the padded look throws: the mark shows', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    calls[1].fail(new Error('out of memory'));
    await flush();
    await chunks(1);
    expect(shown()).toEqual(['wrong:2']);
  });

  it('too little audio to cut around the word: no padded look, and the mark shows', async () => {
    await service.startRecitationTracking(null);
    await jest.advanceTimersByTimeAsync(0);
    engineControl.sendEvent?.(wordProgress(112, 1, 0, 4));
    // Hardly anything heard, and the word sits at the end of it.
    feed(0.48);
    verdicts(
      [
        {word: 2, state: 'wrong'},
        {word: 3, state: 'ok'},
      ],
      0.48,
    );
    await nextChunk();
    // The model places the word well past what had been heard at the hold.
    await reply(
      calls[0],
      sayTokens(joinWords(['قل', 'هو', SLIP, 'احد'], tokensOf), 5, 60),
    );
    await chunks(1);
    expect(calls).toHaveLength(1);
    expect(shown()).toEqual(['wrong:2']);
    expect(traced().join('\n')).toMatch(/too little to cut/);
  });

  it('no answer from the first pass in time: the mark shows, and the late one changes nothing', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    expect(calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1999);
    expect(shown()).toEqual([]);
    await jest.advanceTimersByTimeAsync(2);
    expect(shown()).toEqual(['wrong:2']);
    const marks = state().marks;
    await reply(calls[0], fits());
    await jest.advanceTimersByTimeAsync(100);
    expect(state().marks).toBe(marks);
    expect(calls).toHaveLength(1);
    expect(traced().join('\n')).toMatch(/no answer within 2 s/);
  });

  it('no answer from the padded look in time: the mark shows', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    await jest.advanceTimersByTimeAsync(1980 - FEATURES_MS);
    expect(shown()).toEqual([]);
    await jest.advanceTimersByTimeAsync(2 * FEATURES_MS);
    expect(shown()).toEqual(['wrong:2']);
    await reply(calls[1], asWritten());
    expect(shown()).toEqual(['wrong:2']);
  });

  it('checks that ran out of time while waiting their turn do not run', async () => {
    await lockedTake();
    verdicts([
      {surah: 2, ayah: 2, word: 2, totalWords: 7, state: 'wrong'},
      {surah: 2, ayah: 3, word: 2, totalWords: 7, state: 'wrong'},
    ]);
    await nextChunk();
    expect(calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(2000);
    await reply(calls[0], fits());
    await jest.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(1);
  });
});

describe('an answer can only settle its own marks', () => {
  it('a stop during the first pass: nothing moves when the answer comes', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await service.stopRecitationTracking();
    await flush();
    const marks = state().marks;
    await reply(calls[0], nothingLike());
    expect(state().marks).toBe(marks);
    expect(buzzes()).toBe(0);
  });

  it('a stop during the padded look shows the mark, without a vibration', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    await chunks(1);
    await service.stopRecitationTracking();
    await flush();
    expect(shown()).toEqual(['wrong:2']);
    expect(buzzes()).toBe(0);
    await reply(calls[1], asWritten());
    expect(shown()).toEqual(['wrong:2']);
  });

  it('an answer from the take before, of a word that would show, shows nothing', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    await chunks(1);
    await service.stopRecitationTracking();
    await flush();
    melEnd = 0;
    await lockedTake();
    expect(state().marks).toEqual([]);
    await reply(calls[1], changedLetter());
    expect(state().marks).toEqual([]);
    expect(buzzes()).toBe(0);
  });

  it('an answer from the take before does nothing to the same word in this one', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await service.stopRecitationTracking();
    await flush();
    melEnd = 0;
    await lockedTake();
    slip();
    await nextChunk();
    expect(calls).toHaveLength(2);
    await reply(calls[0], fits());
    await chunks(1);
    expect(calls).toHaveLength(2);
    expect(shown()).toEqual([]);
    await reply(calls[1], nothingLike());
    await chunks(1);
    expect(shown()).toEqual(['wrong:2']);
  });

  it('losing the reader with a mark past its own time, waiting only for the judge: it goes on', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    expect(calls).toHaveLength(1);
    await chunks(1);
    engineControl.sendEvent?.(engineDebug('lost'));
    await reply(calls[0], nothingLike());
    await chunks(1);
    expect(shown()).toEqual(['wrong:2']);
  });

  it('losing the reader with a word the judge then raises, which would have shown by then: it shows', async () => {
    await lockedTake();
    verdicts([
      {word: 3, state: 'wrong'},
      {ayah: 2, word: 0, totalWords: 2, state: 'ok'},
    ]);
    await nextChunk();
    await chunks(1);
    engineControl.sendEvent?.(engineDebug('lost'));
    await reply(calls[0], say(['قل', 'هو', 'الله', 'الذي']));
    await reply(calls[1], sayTokens(tokensOf('اسد'), 9, 25));
    await chunks(1);
    expect(shown()).toEqual(['wrong:3']);
  });

  it('losing the reader before the word was due: the answer counts for nothing', async () => {
    await lockedTake();
    slip();
    await jest.advanceTimersByTimeAsync(400);
    engineControl.sendEvent?.(engineDebug('lost'));
    await chunks(2);
    expect(calls).toHaveLength(0);
    expect(shown()).toEqual([]);
  });

  it('losing the reader: a queued wake does not run, and no suspect comes of it', async () => {
    await lockedTake();
    verdicts([
      {word: 2, state: 'wrong'},
      {surah: 2, ayah: 3, word: 2, totalWords: 7, state: 'wrong'},
    ]);
    await nextChunk();
    expect(calls).toHaveLength(1);
    engineControl.sendEvent?.(engineDebug('lost'));
    await reply(calls[0], fits());
    await chunks(6);
    expect(calls).toHaveLength(1);
    expect(shown()).toEqual([]);
  });

  it('“I read it correctly” during the padded look: gone, whatever it says', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    await chunks(1);
    await service.dismissRecitationMark({surah: 112, ayah: 1, word: 2});
    await reply(calls[1], changedLetter());
    await chunks(1);
    expect(shown()).toEqual([]);
    expect(buzzes()).toBe(0);
  });

  it('two marks due together with one gone during the check: the other still shows', async () => {
    await lockedTake();
    verdicts([
      {word: 1, state: 'wrong'},
      {word: 2, state: 'wrong'},
      {word: 3, state: 'ok'},
    ]);
    await nextChunk();
    // One shared first pass; word 1 has two letters, so only word 2 has a padded look.
    await reply(calls[0], say(['قل', 'هر', SLIP, 'احد']));
    expect(calls).toHaveLength(2);
    await chunks(1);
    verdicts([{word: 2, state: 'ok'}], NOW + 0.96);
    await reply(calls[1], changedLetter());
    await chunks(1);
    expect(shown()).toEqual([]);
    expect(state().status).toBe('listening');
  });
});

describe('the trace', () => {
  async function aTake(): Promise<void> {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    await reply(calls[1], changedLetter());
    await chunks(1);
    feed(0.48);
    verdicts(
      [
        {ayah: 2, word: 1, totalWords: 2, state: 'wrong'},
        {ayah: 3, word: 0, totalWords: 2, state: 'ok'},
      ],
      NOW + 1.44,
    );
    await nextChunk();
    await reply(calls[2], neither());
    await chunks(8);
    await service.stopRecitationTracking();
    await flush();
  }

  it('says what the judge said, with its times, its score and the queue', async () => {
    await aTake();
    expect(traced().join('\n')).toMatch(
      /judge 112:1 word 3 wrong at 12\.48 s: neither, expected -[\d.]+ \(-[\d.]+ a letter\), no word -[\d.]+, best other -?[\d.]+, \d+ ms \(model \d+, waited \d+\), queue \d+, mark suspect to suspect/,
    );
  });

  it('says what the padded look found, with its times', async () => {
    await aTake();
    expect(traced().join('\n')).toMatch(
      /padded 112:1 word 3 at 12\.48 s: gap -[\d.]+, \d+ ms \(features \d+, model \d+\), queue \d+/,
    );
  });

  it('says what happened to the mark', async () => {
    await aTake();
    expect(traced().join('\n')).toMatch(
      /check 112:1 word 3 wrong: shows \(a spelling beats it\), -[\d.]+ a letter, gap -[\d.]+, waited \d+ ms/,
    );
    expect(traced()).toContain('MARK wrong 112:1 word 3');
  });

  it('sums up the take: counts, times, timeouts, drops and the follower', async () => {
    await aTake();
    const line = traced().find(l => l.startsWith('checks this take:'));
    expect(line).toMatch(/\d+ wakes \(0 step 2 only\)/);
    expect(line).toMatch(/\d+ model runs/);
    expect(line).toMatch(/first pass median \d+ max \d+ ms/);
    expect(line).toMatch(/padded median \d+ max \d+ ms/);
    expect(line).toMatch(/\d+ shown, \d+ cancelled, \d+ failed open/);
    expect(line).toMatch(/\d+ timeouts/);
    expect(line).toMatch(/\d+ dropped \(\d+ step 2\)/);
    expect(line).toMatch(/queue max \d+/);
    expect(line).toMatch(
      /follower backlog now \d+ max \d+, slowest chunk \d+ ms/,
    );
  });

  it('never holds a letter of the text', async () => {
    await aTake();
    expect(traced().join('\n')).not.toMatch(/[؀-ۿ]/);
  });

  it('says why a check failed open', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    calls[1].fail(new Error('out of memory'));
    await flush();
    await chunks(1);
    expect(traced().join('\n')).toMatch(
      /check 112:1 word 3 wrong: failed open \(out of memory\), waited \d+ ms/,
    );
    expect(traced()).toContain('MARK wrong 112:1 word 3');
  });

  it('says when an answer came too late to count', async () => {
    await lockedTake();
    slip();
    await nextChunk();
    await reply(calls[0], neither());
    await chunks(1);
    await service.stopRecitationTracking();
    await flush();
    expect(traced()).toContain('MARK wrong 112:1 word 3');
    expect(traced().join('\n')).toMatch(
      /check 112:1 word 3 wrong: failed open \(the take ended\)/,
    );
  });
});

describe('turned off', () => {
  beforeEach(() => load({SECOND_LOOK_ENABLED: false}));

  it('nothing is loaded, read or asked, and marks show at once when due', async () => {
    await lockedTake();
    slip();
    await chunks(2);
    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockModel.run).not.toHaveBeenCalled();
    expect(mockEngine.readMelFrames).not.toHaveBeenCalled();
    expect(mockEngine.wordFrames).not.toHaveBeenCalled();
    expect(shown()).toEqual(['wrong:2']);
    expect(buzzes()).toBe(1);
  });

  it('due at the same moment as with no judge at all', async () => {
    await lockedTake();
    slip();
    await jest.advanceTimersByTimeAsync(499);
    expect(shown()).toEqual([]);
    await jest.advanceTimersByTimeAsync(1);
    expect(shown()).toEqual(['wrong:2']);
  });

  it('keeps no audio', async () => {
    const ring = require('../secondLook/audioRing');
    await lockedTake();
    expect(ring.recentAudio.heard()).toBe(0);
  });
});
