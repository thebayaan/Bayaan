jest.mock('onnxruntime-react-native', () => ({
  InferenceSession: {create: jest.fn()},
  Tensor: class {},
}));
jest.mock('expo-file-system/legacy', () => ({readAsStringAsync: jest.fn()}));

import type {EngineEvent, SessionPolicy} from '@tilawa/core-v1';
import type {EngineMessage} from '../../recitationEngine';
import {createTilawaV1Engine, V1_POLICY, type V1Sdk} from '../engine';

type Listener = (e: EngineEvent) => void;

class FakeSession {
  listeners = new Set<Listener>();
  pushed: number[] = [];
  ended = 0;
  disposed = false;
  /** Events end() raises before it resolves. */
  atEnd: EngineEvent[] = [];
  constructor(readonly policy: SessionPolicy | undefined) {}
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(e: EngineEvent) {
    for (const fn of [...this.listeners]) fn(e);
  }
  async pushAudio(samples: Float32Array) {
    this.pushed.push(samples.length);
    return [];
  }
  async end() {
    this.ended += 1;
    for (const e of this.atEnd) this.emit(e);
    return this.atEnd;
  }
  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }
}

const reference = {
  ayahs: [
    {s: 1, a: 1, w: ['a', 'b', 'c', 'd']},
    {s: 1, a: 2, w: ['e', 'f', 'g', 'h']},
    {s: 1, a: 3, w: ['i', 'j', 'k', 'l', 'm', 'n']},
  ],
};

let sessions: FakeSession[];
let releases: number;
let disposedTilawa: number;

function sdk(): V1Sdk {
  return {
    loadModel: async () =>
      ({
        manifest: {},
        backend: {
          release: async () => {
            releases += 1;
          },
        },
        supported: [],
      }) as never,
    loadReference: async () => reference as never,
    create: async () =>
      ({
        startFreeRecitation: (policy?: SessionPolicy) => {
          const s = new FakeSession(policy);
          sessions.push(s);
          return s;
        },
        dispose: async () => {
          disposedTilawa += 1;
        },
      }) as never,
  };
}

const position = (
  timeMs: number,
  state: 'locked' | 'acquiring' | 'lost' | 'ambiguous',
  word?: {surah: number; ayah: number; word: number},
): EngineEvent =>
  ({
    type: 'position',
    v: 1,
    timeMs,
    referenceVersion: 'ref-v2',
    expected: null,
    observed: word
      ? [
          {
            word,
            span: {start: word, end: word},
            confidence: 0.9,
            cost: 0,
            per: 0,
          },
        ]
      : [],
    state,
  }) as EngineEvent;

const checker = (
  timeMs: number,
  state: string,
  errorClass: string,
  word: {surah: number; ayah: number; word: number},
  id = 'm1',
): EngineEvent =>
  ({
    type: 'checker',
    v: 1,
    id,
    timeMs,
    state,
    errorClass,
    location: word,
    confidence: 0.8,
  }) as EngineEvent;

/** Lets the engine's queue run. */
const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  sessions = [];
  releases = 0;
  disposedTilawa = 0;
});

async function started() {
  const messages: EngineMessage[] = [];
  const engine = await createTilawaV1Engine(
    {modelPath: 'file:///m.onnx', referencePath: 'file:///r.json'},
    msg => messages.push(msg),
    sdk(),
  );
  engine.reset();
  await flush();
  return {engine, messages, session: () => sessions[sessions.length - 1]};
}

describe('createTilawaV1Engine', () => {
  it('runs free recitation with the confirm-at-the-next-word policy', async () => {
    const {session} = await started();
    expect(session().policy).toEqual(V1_POLICY);
    expect(V1_POLICY).toEqual({
      confirm: {after: 'next-word'},
      minConfidence: 0.6,
      countSelfCorrections: false,
    });
  });

  it('feeds audio to the session in order', async () => {
    const {engine, session} = await started();
    engine.feed(new Float32Array(100));
    engine.feed(new Float32Array(200));
    await flush();
    expect(session().pushed).toEqual([100, 200]);
    expect(engine.getStats().audioSeconds).toBeCloseTo(300 / 16000);
  });

  it("reports places as the app's 0-based word, with the ayah's word count", async () => {
    const {messages, session} = await started();
    session().emit(position(1000, 'locked', {surah: 1, ayah: 2, word: 3}));
    expect(messages).toContainEqual(
      expect.objectContaining({
        type: 'word_progress',
        surah: 1,
        ayah: 2,
        word_index: 2,
        total_words: 4,
      }),
    );
  });

  it('says located on the first lock and lost when the place goes', async () => {
    const {messages, session} = await started();
    session().emit(position(500, 'acquiring', {surah: 1, ayah: 3, word: 1}));
    session().emit(position(900, 'locked', {surah: 1, ayah: 1, word: 1}));
    session().emit(position(1200, 'locked', {surah: 1, ayah: 1, word: 2}));
    session().emit(position(3000, 'lost'));
    const events = messages
      .filter(m => m.type === 'debug')
      .map(m => (m as {event: string}).event);
    expect(events).toEqual(['tentative', 'located', 'lost']);
    const tentative = messages.find(
      m => m.type === 'debug' && (m as {event: string}).event === 'tentative',
    ) as {data: Record<string, unknown>};
    expect(tentative.data).toEqual({surah: 1, ayah: 3, word: 0, totalWords: 6});
  });

  it('reports an ayah recited once, when the cursor leaves it', async () => {
    const {messages, session} = await started();
    session().emit(position(100, 'locked', {surah: 1, ayah: 1, word: 1}));
    session().emit(position(400, 'locked', {surah: 1, ayah: 1, word: 4}));
    session().emit(position(700, 'locked', {surah: 1, ayah: 2, word: 1}));
    session().emit(position(800, 'locked', {surah: 1, ayah: 2, word: 2}));
    const matches = messages.filter(m => m.type === 'verse_match');
    expect(matches).toEqual([
      expect.objectContaining({type: 'verse_match', surah: 1, ayah: 1}),
    ]);
  });

  it('turns checker events into v1 marks, 0-based, in seconds', async () => {
    const {messages, session} = await started();
    session().emit(
      checker(2500, 'suspected', 'wrong_word', {surah: 1, ayah: 3, word: 2}),
    );
    session().emit(
      checker(3100, 'confirmed', 'wrong_word', {surah: 1, ayah: 3, word: 2}),
    );
    session().emit(
      checker(
        3200,
        'suspected',
        'short_vowel',
        {surah: 1, ayah: 3, word: 3},
        'p1',
      ),
    );
    const marks = messages.filter(m => m.type === 'v1_mark');
    expect(marks).toEqual([
      {
        type: 'v1_mark',
        id: 'm1',
        state: 'suspected',
        errorClass: 'wrong_word',
        surah: 1,
        ayah: 3,
        word: 1,
        totalWords: 6,
        audioTime: 2.5,
        confidence: 0.8,
      },
      expect.objectContaining({state: 'confirmed', audioTime: 3.1}),
    ]);
  });

  it('keeps word times and ayah entries for the check', async () => {
    const {engine, session} = await started();
    session().emit(position(1000, 'locked', {surah: 1, ayah: 2, word: 1}));
    session().emit(position(1400, 'locked', {surah: 1, ayah: 2, word: 2}));
    session().emit(position(1800, 'locked', {surah: 1, ayah: 2, word: 3}));
    expect(engine.ayahEnteredAt(1, 2)).toBe(1);
    expect(engine.ayahEnteredAt(1, 3)).toBeNull();
    expect(engine.wordFrames({surah: 1, ayah: 2, word: 1})).toEqual({
      from: 35,
      to: 45,
    });
    expect(engine.timeline().words.get('1:2:0')).toEqual({from: 1, to: 1.4});
    expect(engine.timeline().path.map(([t]) => t)).toEqual([1, 1.4, 1.8]);
  });

  it('settle ends the session once, while marks still reach the app', async () => {
    const {engine, messages, session} = await started();
    session().emit(position(100, 'locked', {surah: 1, ayah: 1, word: 3}));
    session().emit(position(300, 'locked', {surah: 1, ayah: 1, word: 4}));
    session().atEnd = [
      checker(900, 'confirmed', 'omitted_word', {surah: 1, ayah: 1, word: 2}),
    ];
    await engine.settle();
    await engine.settle();
    expect(session().ended).toBe(1);
    expect(messages.filter(m => m.type === 'v1_mark')).toHaveLength(1);
    // The cursor reached the ayah's last word, so it counts as recited.
    expect(messages.filter(m => m.type === 'verse_match')).toHaveLength(1);
    engine.feed(new Float32Array(160));
    await flush();
    expect(session().pushed).toEqual([]);
    const final = await engine.stop();
    expect(final).toEqual([
      expect.objectContaining({
        type: 'final_sequence',
        verses: [expect.objectContaining({surah: 1, ayah: 1})],
      }),
    ]);
  });

  it('reset starts a fresh session and forgets the last take', async () => {
    const {engine, session} = await started();
    const first = session();
    first.emit(position(1000, 'locked', {surah: 1, ayah: 2, word: 1}));
    engine.reset();
    await flush();
    expect(first.disposed).toBe(true);
    expect(sessions).toHaveLength(2);
    expect(engine.ayahEnteredAt(1, 2)).toBeNull();
    expect(engine.timeline().path).toEqual([]);
  });

  it('after dispose nothing reaches the app, and the model is released', async () => {
    const {engine, messages, session} = await started();
    const live = session();
    await engine.dispose();
    const before = messages.length;
    live.emit(position(1000, 'locked', {surah: 1, ayah: 2, word: 1}));
    expect(messages).toHaveLength(before);
    expect(disposedTilawa).toBe(1);
    expect(releases).toBe(1);
  });

  it('a model that loads while the SDK fails is released', async () => {
    const failing = {
      ...sdk(),
      create: async () => Promise.reject(new Error('no')),
    };
    await expect(
      createTilawaV1Engine(
        {modelPath: 'm', referencePath: 'r'},
        () => undefined,
        failing,
      ),
    ).rejects.toThrow('no');
    expect(releases).toBe(1);
  });
});
