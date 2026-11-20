import type {V1CheckAnswer} from '../checkMark';
import type {V1Shown} from '../marks';
import type {V1Mark} from '../types';

// The take's marks between the engine and the page, with the check and the second
// model stood in for.

const mockCheck = jest.fn<Promise<V1CheckAnswer>, [V1Mark, unknown]>();
jest.mock('../checkMark', () => ({
  ...jest.requireActual('../checkMark'),
  checkV1Mark: (mark: V1Mark, ctx: unknown) => mockCheck(mark, ctx),
}));
const mockModel = {current: {run: jest.fn()} as unknown};
jest.mock('../../secondLook/checkWord', () => ({
  secondLookModelNow: async () => mockModel.current,
}));
const mockHeard = {samples: 0};
jest.mock('../../secondLook/audioRing', () => ({
  recentAudio: {
    heard: () => mockHeard.samples,
    samples: () => new Float32Array(0),
  },
}));
jest.mock('../../secondLook/ayahLetters', () => ({ayahLetters: () => null}));
jest.mock('../../secondLook/alternatives', () => ({alternativesOf: () => []}));

type Session = typeof import('../session');
let session: Session;
let published: V1Shown[];
let buzzes: number;
let traces: string[];

// The follower's places so far, which a test may extend.
let mockPath: [number, {surah: number; ayah: number; word: number}][] = [];
const engine = {
  wordCount: () => 4,
  timeline: () => ({words: new Map(), ayahEntered: new Map(), path: mockPath}),
};

const mark = (over: Partial<V1Mark>): V1Mark => ({
  id: 'm1',
  state: 'confirmed',
  errorClass: 'wrong_word',
  surah: 1,
  ayah: 1,
  word: 2,
  totalWords: 4,
  audioTime: 2,
  confidence: 0.8,
  ...over,
});

const kept: V1CheckAnswer = {outcome: 'kept', why: 'x', detail: {}, ms: 5};
const cancelled: V1CheckAnswer = {
  outcome: 'cancelled',
  why: 'x',
  detail: {},
  ms: 5,
};

/** Lets timers and promises run. */
async function settle(ms = 100): Promise<void> {
  await jest.advanceTimersByTimeAsync(ms);
}

const last = () => published[published.length - 1];

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockModel.current = {run: jest.fn()};
  mockHeard.samples = 0;
  mockPath = [];
  published = [];
  buzzes = 0;
  traces = [];
  jest.isolateModules(() => {
    session = require('../session');
  });
  session.startV1Take({
    engine: () => engine as never,
    publish: shown => published.push(shown),
    buzz: () => {
      buzzes += 1;
    },
    trace: line => traces.push(line),
  });
});

afterEach(() => {
  session.endV1Take();
  jest.useRealTimers();
});

describe('v1 take', () => {
  it('checks a confirmed mark once the take has heard a little past it, then shows it', async () => {
    mockCheck.mockResolvedValue(kept);
    session.noteV1Message(mark({}));
    await settle();
    expect(mockCheck).not.toHaveBeenCalled();
    mockHeard.samples = Math.round((2 + 0.48) * 16000);
    await settle();
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(last().marks).toEqual([
      expect.objectContaining({
        surah: 1,
        ayah: 1,
        word: 2,
        kind: 'wrong',
        status: 'mistake',
      }),
    ]);
    expect(buzzes).toBe(1);
  });

  it('a cancelled mark never reaches the page', async () => {
    mockCheck.mockResolvedValue(cancelled);
    mockHeard.samples = 16000 * 10;
    session.noteV1Message(mark({}));
    await settle();
    expect(published.every(p => p.marks.length === 0)).toBe(true);
    expect(buzzes).toBe(0);
  });

  it('with no second model nothing shows', async () => {
    mockModel.current = null;
    mockHeard.samples = 16000 * 10;
    session.noteV1Message(mark({}));
    await settle();
    expect(mockCheck).not.toHaveBeenCalled();
    expect(published.every(p => p.marks.length === 0)).toBe(true);
    expect(traces.some(t => t.includes('no second model'))).toBe(true);
  });

  it('a check that takes too long shows the mark', async () => {
    mockCheck.mockReturnValue(new Promise(() => undefined));
    mockHeard.samples = 16000 * 10;
    session.noteV1Message(mark({}));
    await settle(2100);
    expect(last().marks).toHaveLength(1);
    expect(traces.some(t => t.includes('failed open'))).toBe(true);
  });

  it('a self-correction after the mark showed turns it corrected', async () => {
    mockCheck.mockResolvedValue(kept);
    mockHeard.samples = 16000 * 10;
    session.noteV1Message(mark({}));
    await settle();
    session.noteV1Message(mark({state: 'resolved'}));
    expect(last().marks[0].status).toBe('corrected');
  });

  it('re-reading past a shown mark corrects it', async () => {
    mockCheck.mockResolvedValue(kept);
    mockHeard.samples = 16000 * 10;
    session.noteV1Message(mark({}));
    await settle();
    session.noteV1Cursor({surah: 1, ayah: 1, word: 0});
    session.noteV1Cursor({surah: 1, ayah: 1, word: 3});
    expect(last().marks[0].status).toBe('corrected');
  });

  it('a dismissed word is not marked again this take', async () => {
    mockCheck.mockResolvedValue(kept);
    mockHeard.samples = 16000 * 10;
    session.noteV1Message(mark({}));
    await settle();
    session.dismissV1({surah: 1, ayah: 1, word: 2}, 'wrong');
    expect(last().marks).toEqual([]);
    session.noteV1Message(mark({id: 'm2'}));
    await settle();
    expect(last().marks).toEqual([]);
  });

  it('settleV1Checks waits for checks under way', async () => {
    let answer: (a: V1CheckAnswer) => void = () => undefined;
    mockCheck.mockReturnValue(new Promise(r => (answer = r)));
    mockHeard.samples = 16000 * 10;
    session.noteV1Message(mark({}));
    await settle(10);
    let done = false;
    void session.settleV1Checks(1500).then(() => (done = true));
    await settle(10);
    expect(done).toBe(false);
    answer(kept);
    await settle(10);
    expect(done).toBe(true);
    expect(last().marks).toHaveLength(1);
  });

  it('a mark Tilawa decides as the take stops is checked on what was heard', async () => {
    mockCheck.mockResolvedValue(cancelled);
    // The take heard up to 9.9 s and hears no more: a mark at 10 s must not
    // wait for audio that will not come.
    mockHeard.samples = Math.round(9.9 * 16000);
    session.noteV1Message(mark({audioTime: 10}));
    await settle(10);
    expect(mockCheck).not.toHaveBeenCalled();
    const settled = session.settleV1Checks(1500);
    await settle(100);
    await settled;
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(session.endV1Take()?.marks).toEqual([]);
  });

  it("a surah's first word is checked only once the follower has gone past it", async () => {
    mockCheck.mockResolvedValue(cancelled);
    mockHeard.samples = Math.round(4 * 16000);
    // Tilawa marks 2:1's first word while the reader is still saying the basmala.
    mockPath = [[1, {surah: 1, ayah: 7, word: 8}]];
    session.noteV1Message(mark({surah: 2, ayah: 1, word: 0, audioTime: 2}));
    await settle(500);
    expect(mockCheck).not.toHaveBeenCalled();
    // The reader says the word and goes on: the check runs.
    mockPath = [
      ...mockPath,
      [4.5, {surah: 2, ayah: 1, word: 0}],
      [5, {surah: 2, ayah: 2, word: 0}],
    ];
    mockHeard.samples = Math.round(6 * 16000);
    await settle(200);
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('it waits at most firstWord.waitSeconds for the follower', async () => {
    mockCheck.mockResolvedValue(cancelled);
    session.noteV1Message(mark({surah: 2, ayah: 1, word: 0, audioTime: 2}));
    mockHeard.samples = Math.round(9 * 16000);
    await settle(200);
    expect(mockCheck).not.toHaveBeenCalled();
    mockHeard.samples = Math.round(10.5 * 16000);
    await settle(200);
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('a take that ends with a check pending shows that mark', async () => {
    mockCheck.mockReturnValue(new Promise(() => undefined));
    mockHeard.samples = 16000 * 10;
    session.noteV1Message(mark({}));
    await settle(10);
    const final = session.endV1Take();
    expect(final?.marks).toHaveLength(1);
    expect(session.v1TakeActive()).toBe(false);
    // Nothing from the old take reaches anyone after its end.
    session.noteV1Message(mark({id: 'late'}));
    await settle();
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });
});
