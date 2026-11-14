import {joinWords, sayTokens} from '@/test-utils/secondLookSignals';
import {SAMPLE_RATE} from '@/services/recitation/secondLook/fbank';
import type {CheckAnswer, CheckHost, JudgeWake} from '../checkWord';
import type {ModelOutput, SecondLookModel} from '../model';

// The model's life beside the follower, and checks that have nobody to ask: the model
// file and its session are the only things played by hand. The whole flow, through the
// service and the mark rules, is in RecitationTrackingService.secondLook.test.ts.

const mockAssets = {
  secondLookModelPath: jest.fn(
    async (): Promise<string | null> => 'file:///second.onnx',
  ),
  ensureSecondLookModel: jest.fn(async (): Promise<void> => undefined),
};
jest.mock('@/services/recitation/recitationAssets', () => mockAssets);

const mockLoad = jest.fn();
jest.mock('@/services/recitation/secondLook/model', () => ({
  loadSecondLookModel: mockLoad,
}));

type Module = typeof import('../checkWord');
type Ring = typeof import('../audioRing');
type Judge = typeof import('../judge');

let check: Module;
let ring: Ring['recentAudio'];
let judge: Judge;

// Al-Fatihah's first ayah, as the engine numbers its words.
const AYAH = ['بسم', 'الله', 'الرحمن', 'الرحيم'];
const WORD = {surah: 1, ayah: 1, word: 1, kind: 'wrong' as const};

const answers: {id: number; answer: string}[] = [];
const host: CheckHost = {
  engine: () => engine as never,
  wants: () => true,
  answer: (id, answer) => answers.push({id, answer}),
  markOf: () => undefined,
};
const engine = {
  readMelFrames: (from: number, to: number) => ({
    first: from,
    frames: to - from,
    data: new Float32Array((to - from) * 80),
  }),
  wordFrames: () => null,
  ayahEnteredAt: () => null,
  wordCount: () => 4,
  getStats: () => ({backlog: 0}),
};

function fakeModel(
  run: SecondLookModel['run'] = async () => saying(AYAH),
): jest.Mocked<SecondLookModel> {
  return {run: jest.fn(run), release: jest.fn(async () => undefined)};
}

function saying(words: string[]): ModelOutput {
  return sayTokens(joinWords(words, judge.tokensOf), 11);
}

const wake = (id = 1, audioTime = 6): JudgeWake => ({
  id,
  surah: 1,
  ayah: 1,
  word: 1,
  totalWords: 4,
  state: 'wrong',
  at: Date.now(),
  audioTime,
});

/** `seconds` of audio into the ring. */
function fed(seconds: number): void {
  ring.push(new Float32Array(seconds * SAMPLE_RATE).fill(0.1));
}

/** Lets promises settle and the hold and feature steps' timers fire. */
async function settled(ms = 600): Promise<void> {
  await jest.advanceTimersByTimeAsync(ms);
}

async function ready(model = fakeModel()): Promise<typeof model> {
  mockLoad.mockResolvedValueOnce(model);
  check.prepareSecondLook();
  await settled(0);
  return model;
}

beforeEach(() => {
  jest.clearAllMocks();
  answers.length = 0;
  mockAssets.secondLookModelPath.mockResolvedValue('file:///second.onnx');
  mockAssets.ensureSecondLookModel.mockResolvedValue(undefined);
  jest.useFakeTimers();
  jest.isolateModules(() => {
    check = require('../checkWord');
    ring = require('../audioRing').recentAudio;
    judge = require('../judge');
  });
  fed(8);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('checkWord with nobody to ask', () => {
  /** A failure known at once is an answer, not a promise. */
  function expectFailedAtOnce(answer: unknown, reason: string): void {
    expect(answer).toEqual({outcome: 'failed', reason, ms: expect.any(Number)});
  }

  it('no take under way', () => {
    expectFailedAtOnce(check.checkWord(WORD, 6), 'no check');
  });

  it('a verdict with no audio time', () => {
    check.startCheckTake(host);
    expectFailedAtOnce(check.checkWord(WORD, undefined), 'no check');
  });

  it('no wake for this verdict', () => {
    check.startCheckTake(host);
    expectFailedAtOnce(check.checkWord(WORD, 6), 'no check for this verdict');
  });

  it('a wake too old to be kept', async () => {
    await ready();
    check.startCheckTake(host);
    check.wakeCheck(wake(1, 6));
    check.wakeCheck(wake(2, 40));
    expectFailedAtOnce(check.checkWord(WORD, 6), 'no check for this verdict');
  });
});

describe('a wake with no check to run', () => {
  it.each([
    [15, 7, 'an ayah where the engine splits a word'],
    [27, 20, 'another'],
    [36, 22, 'and the third'],
  ])('%i:%i, %s, says nothing at once', async (surah, ayah) => {
    const model = await ready();
    check.startCheckTake(host);
    check.wakeCheck({...wake(), surah, ayah});
    expect(answers).toEqual([{id: 1, answer: 'neither'}]);
    await settled();
    expect(model.run).not.toHaveBeenCalled();
    expect(check.checkWord({...WORD, surah, ayah}, 6)).toMatchObject({
      outcome: 'failed',
      reason: 'no letters for this word',
    });
  });

  it('a word past the end of the ayah', async () => {
    await ready();
    check.startCheckTake(host);
    check.wakeCheck({...wake(), word: 4});
    expect(answers).toEqual([{id: 1, answer: 'neither'}]);
  });

  it('no take under way: nothing happens at all', async () => {
    const model = await ready();
    check.wakeCheck(wake());
    await settled();
    expect(answers).toEqual([]);
    expect(model.run).not.toHaveBeenCalled();
  });
});

describe('the model', () => {
  it('its file is missing: wakes fail at once, and it is fetched for later', async () => {
    mockAssets.secondLookModelPath.mockResolvedValue(null);
    check.prepareSecondLook();
    await settled(0);
    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockAssets.ensureSecondLookModel).toHaveBeenCalledTimes(1);
    check.startCheckTake(host);
    check.wakeCheck(wake());
    expect(answers).toEqual([{id: 1, answer: 'neither'}]);
    expect(check.checkWord(WORD, 6)).toMatchObject({reason: 'no model'});
  });

  it('a failed fetch of the missing file stays quiet', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockAssets.secondLookModelPath.mockResolvedValue(null);
    mockAssets.ensureSecondLookModel.mockRejectedValue(new Error('offline'));
    check.prepareSecondLook();
    await settled(0);
    check.startCheckTake(host);
    check.wakeCheck(wake());
    expect(check.checkWord(WORD, 6)).toMatchObject({reason: 'no model'});
    warn.mockRestore();
  });

  it('no take prepared it', () => {
    check.startCheckTake(host);
    check.wakeCheck(wake());
    expect(check.checkWord(WORD, 6)).toMatchObject({reason: 'no model'});
  });

  it('failed to load, and the next take tries again', async () => {
    mockLoad.mockRejectedValueOnce(new Error('bad file'));
    check.prepareSecondLook();
    await settled(0);
    check.startCheckTake(host);
    check.wakeCheck(wake());
    expect(check.checkWord(WORD, 6)).toMatchObject({reason: 'no model'});
    const model = await ready();
    check.startCheckTake(host);
    check.wakeCheck(wake(2));
    await settled();
    expect(model.run).toHaveBeenCalledTimes(1);
  });

  it('still loading: the check waits for it', async () => {
    let finishLoad: (model: SecondLookModel) => void = () => undefined;
    mockLoad.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishLoad = resolve;
        }),
    );
    check.prepareSecondLook();
    await settled(0);
    check.startCheckTake(host);
    check.wakeCheck(wake());
    await settled();
    expect(answers).toEqual([]);
    finishLoad(fakeModel());
    await settled(1);
    expect(answers).toEqual([{id: 1, answer: 'fits'}]);
  });

  it('still loading after the time limit: the check fails open', async () => {
    mockLoad.mockImplementationOnce(() => new Promise(() => undefined));
    check.prepareSecondLook();
    await settled(0);
    check.startCheckTake(host);
    check.wakeCheck(wake());
    const answer = check.checkWord(WORD, 6) as Promise<CheckAnswer>;
    await settled(480 + 2000);
    await expect(answer).resolves.toMatchObject({
      outcome: 'failed',
      reason: 'no answer within 2 s',
    });
    expect(answers).toEqual([{id: 1, answer: 'neither'}]);
  });

  it('loads once however many takes ask', async () => {
    await ready();
    check.prepareSecondLook();
    check.prepareSecondLook();
    await settled(0);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(mockLoad).toHaveBeenCalledWith('file:///second.onnx');
  });

  it('unloading lets the session go, and checks then fail open', async () => {
    const model = await ready();
    await check.unloadSecondLook();
    expect(model.release).toHaveBeenCalledTimes(1);
    check.startCheckTake(host);
    check.wakeCheck(wake());
    expect(check.checkWord(WORD, 6)).toMatchObject({reason: 'no model'});
  });

  it('a failed release does not stop an unload', async () => {
    const model = await ready();
    model.release.mockRejectedValueOnce(new Error('already gone'));
    await expect(check.unloadSecondLook()).resolves.toBeUndefined();
    check.startCheckTake(host);
    check.wakeCheck(wake());
    expect(check.checkWord(WORD, 6)).toMatchObject({reason: 'no model'});
  });

  it('finishes loading after an unload: it is let go', async () => {
    let finishLoad: (model: SecondLookModel) => void = () => undefined;
    mockLoad.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishLoad = resolve;
        }),
    );
    check.prepareSecondLook();
    await settled(0);
    await check.unloadSecondLook();
    const late = fakeModel();
    finishLoad(late);
    await settled(0);
    expect(late.release).toHaveBeenCalledTimes(1);
    check.startCheckTake(host);
    check.wakeCheck(wake());
    expect(check.checkWord(WORD, 6)).toMatchObject({reason: 'no model'});
  });

  it('prepares again after an unload', async () => {
    await ready();
    await check.unloadSecondLook();
    const again = await ready();
    check.startCheckTake(host);
    check.wakeCheck(wake());
    await settled();
    expect(again.run).toHaveBeenCalledTimes(1);
  });

  it('one wake, one run, and the judge answers', async () => {
    const model = await ready();
    check.startCheckTake(host);
    check.wakeCheck(wake());
    await settled();
    expect(model.run).toHaveBeenCalledTimes(1);
    expect(answers).toEqual([{id: 1, answer: 'fits'}]);
  });
});
