import type {RecitationEngine} from '../../recitationEngine';
import type {ModelOutput, SecondLookModel} from '../../secondLook/model';
import {
  melFrameMeans,
  melFramesHeard,
  startLiveCheck,
  type LiveCheckPort,
  type LiveHost,
} from '../runner';
import type {LiveCheck, LiveOpinion, LivePlan} from '../types';

// The runner with a fake engine, a fake model session and a fake check: what it reads,
// what it runs, what it skips and what it hands on.

const mockTrace = jest.fn((_line: string) => undefined);
jest.mock('@/services/recitation/debugTake', () => ({
  trace: (line: string) => mockTrace(line),
}));

const traced = () => mockTrace.mock.calls.map(([line]) => line);

let chunkDone: ((audioTime: number) => void) | null;
let backlog: number;
let heldFrames: number;
const engine = {
  readMelFrames: jest.fn((from: number, to: number) => {
    const last = Math.min(to, heldFrames);
    const frames = Math.max(0, last - from);
    return {first: from, frames, data: new Float32Array(frames * 80)};
  }),
  getStats: jest.fn(() => ({backlog})),
  setChunkListener: jest.fn((listener: ((t: number) => void) | null) => {
    chunkDone = listener;
  }),
};

let modelAnswer: () => Promise<ModelOutput>;
const model: SecondLookModel = {
  run: jest.fn((_data: Float32Array, _frames: number) => modelAnswer()),
  release: jest.fn(async () => undefined),
};

const plans: LivePlan[] = [];
let opinions: LiveOpinion[];
// How many windows the check wants for one `heard`: after that it says null.
let windows: number;
const asked = new Map<number, number>();
const check = {
  setPlace: jest.fn(),
  relocated: jest.fn(),
  lost: jest.fn(),
  plan: jest.fn((heard: number): LivePlan | null => {
    const n = asked.get(heard) ?? 0;
    if (n >= windows) return null;
    asked.set(heard, n + 1);
    const plan = {
      from: Math.max(0, heard - 100 + 40 * n),
      to: heard,
      id: plans.length,
    };
    plans.push(plan);
    return plan;
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

let ready: boolean;
let busy: boolean;
let modelReady: boolean;
const reported: LiveOpinion[][] = [];
const host: LiveHost = {
  engine: () => engine as unknown as RecitationEngine,
  ready: () => ready,
  report: o => {
    reported.push([...o]);
  },
};
const port: LiveCheckPort = {
  create: jest.fn(() => check),
  model: () => (modelReady ? model : null),
  modelBusy: () => busy,
  holdModel: jest.fn(),
};

const opinion: LiveOpinion = {
  surah: 67,
  ayah: 2,
  word: 3,
  totalWords: 12,
  verdict: 'changed',
  final: true,
  evidence: {letterShare: 0.5, gap: 3, audioFrom: 4, audioTo: 4.5, reading: 0},
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  chunkDone = null;
  backlog = 0;
  heldFrames = 1000;
  ready = true;
  busy = false;
  modelReady = true;
  plans.length = 0;
  windows = 1;
  asked.clear();
  reported.length = 0;
  opinions = [opinion];
  modelAnswer = async () => ({logp: new Float32Array(31 * 5), frames: 5});
});

afterEach(() => {
  jest.useRealTimers();
});

// Each task of a tick (a run, a step, a report) waits for a timer of its own: a fake
// millisecond each, so 20 is room for a whole tick of three windows.
async function chunkAt(audioTime: number): Promise<void> {
  chunkDone?.(audioTime);
  await jest.advanceTimersByTimeAsync(20);
}

describe('melFramesHeard', () => {
  it('counts the frames the engine holds after that much audio', () => {
    expect(melFramesHeard(0)).toBe(0);
    expect(melFramesHeard(0.01)).toBe(0);
    expect(melFramesHeard(0.48)).toBe(47);
    expect(melFramesHeard(4.8)).toBe(479);
  });
});

describe('melFrameMeans', () => {
  it('is the mean of each frame’s 80 bins', () => {
    const data = new Float32Array(3 * 80);
    for (let b = 0; b < 80; b += 1) {
      data[b] = 2;
      data[80 + b] = b;
      data[160 + b] = b % 2 === 0 ? -10 : -20;
    }
    const means = melFrameMeans(data, 3);
    expect(means).toHaveLength(3);
    expect(means[0]).toBeCloseTo(2);
    expect(means[1]).toBeCloseTo(39.5);
    expect(means[2]).toBeCloseTo(-15);
  });

  it('is empty for no frames', () => {
    expect(melFrameMeans(new Float32Array(0), 0)).toHaveLength(0);
  });
});

describe('a tick', () => {
  it('reads the planned frames, runs the model on them, and reports', async () => {
    startLiveCheck(host, port);
    expect(engine.setChunkListener).toHaveBeenCalledTimes(1);
    await chunkAt(4.8);
    expect(check.plan).toHaveBeenCalledWith(479);
    expect(engine.readMelFrames).toHaveBeenCalledWith(379, 479);
    expect(model.run).toHaveBeenCalledTimes(1);
    const [data, frames] = (model.run as jest.Mock).mock.calls[0];
    expect(frames).toBe(100);
    expect(data).toHaveLength(100 * 80);
    expect(port.holdModel).toHaveBeenCalledTimes(1);
    expect(check.step).toHaveBeenCalledWith(
      plans[0],
      expect.any(Float32Array),
      5,
      expect.any(Float32Array),
    );
    expect(reported).toEqual([[opinion]]);
    expect(traced()).toContain(
      'live run 379-479: 1 opinions (1 final), model 0 ms',
    );
  });

  it('passes the check each planned frame’s mean energy', async () => {
    engine.readMelFrames.mockImplementationOnce((from: number, to: number) => {
      const frames = to - from;
      const data = new Float32Array(frames * 80);
      for (let f = 0; f < frames; f += 1) {
        data.fill(-f / 10, f * 80, (f + 1) * 80);
        data[f * 80] += 8;
      }
      return {first: from, frames, data};
    });
    startLiveCheck(host, port);
    await chunkAt(4.8);
    const energy = check.step.mock.calls[0][3] as Float32Array;
    expect(energy).toHaveLength(100);
    expect(energy[0]).toBeCloseTo(0.1);
    expect(energy[37]).toBeCloseTo(-3.7 + 0.1);
    expect(energy[99]).toBeCloseTo(-9.9 + 0.1);
  });

  it('never runs inside the engine’s queue', () => {
    startLiveCheck(host, port);
    chunkDone?.(4.8);
    expect(check.plan).not.toHaveBeenCalled();
    expect(model.run).not.toHaveBeenCalled();
  });

  it('reports nothing for a run with no opinions', async () => {
    opinions = [];
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(check.step).toHaveBeenCalledTimes(1);
    expect(reported).toEqual([]);
  });

  it('runs at most once per tick of audio', async () => {
    startLiveCheck(host, port);
    await chunkAt(4.8);
    await chunkAt(5.0);
    expect(model.run).toHaveBeenCalledTimes(1);
    await chunkAt(5.28);
    expect(model.run).toHaveBeenCalledTimes(2);
  });
});

describe('more than one window a tick', () => {
  it('runs up to three, asking again with the same frames heard', async () => {
    windows = 5;
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(check.plan.mock.calls).toEqual([[479], [479], [479]]);
    expect(model.run).toHaveBeenCalledTimes(3);
    expect(port.holdModel).toHaveBeenCalledTimes(3);
    expect((model.run as jest.Mock).mock.calls.map(([, f]) => f)).toEqual([
      100, 60, 20,
    ]);
    expect(check.step.mock.calls.map(([plan]) => plan)).toEqual(plans);
    expect(check.step.mock.calls.map(([, , , e]) => e?.length)).toEqual([
      100, 60, 20,
    ]);
    // One report for the tick: its marks show together.
    expect(reported).toEqual([[opinion, opinion, opinion]]);
    expect(traced()).toEqual(
      expect.arrayContaining([
        'live run 379-479: 1 opinions (1 final), model 0 ms',
        'live run 419-479: 1 opinions (1 final), model 0 ms',
        'live run 459-479: 1 opinions (1 final), model 0 ms',
      ]),
    );
  });

  it('stops when the check has nothing more to read', async () => {
    windows = 2;
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(check.plan).toHaveBeenCalledTimes(3);
    expect(model.run).toHaveBeenCalledTimes(2);
    expect(reported).toEqual([[opinion, opinion]]);
  });

  it('yields between runs: the next one starts in a task of its own', async () => {
    windows = 2;
    const order: string[] = [];
    (model.run as jest.Mock).mockImplementation(() => {
      order.push(`run at ${Date.now()}`);
      return modelAnswer();
    });
    check.step.mockImplementation(() => {
      order.push(`step at ${Date.now()}`);
      return opinions;
    });
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(order.map(o => o.split(' ')[0])).toEqual([
      'run',
      'step',
      'run',
      'step',
    ]);
    const times = order.map(o => Number(o.split(' ')[2]));
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it('stops on a follower backlog between runs, and reports what it has', async () => {
    windows = 3;
    check.step.mockImplementationOnce(() => {
      backlog = 2;
      return opinions;
    });
    const runner = startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(model.run).toHaveBeenCalledTimes(1);
    expect(check.plan).toHaveBeenCalledTimes(1);
    expect(reported).toEqual([[opinion]]);
    runner.stop();
    expect(traced().at(-1)).toMatch(/ 1 backlog,/);
  });

  it('stops when the second look takes the model between runs', async () => {
    windows = 3;
    check.step.mockImplementationOnce(() => {
      busy = true;
      return opinions;
    });
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(model.run).toHaveBeenCalledTimes(1);
    expect(reported).toEqual([[opinion]]);
  });

  it('stops on a short read of a later window', async () => {
    windows = 3;
    engine.readMelFrames
      .mockImplementationOnce((from: number, to: number) => ({
        first: from,
        frames: to - from,
        data: new Float32Array((to - from) * 80),
      }))
      .mockImplementationOnce((from: number) => ({
        first: from,
        frames: 3,
        data: new Float32Array(240),
      }));
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(model.run).toHaveBeenCalledTimes(1);
    expect(check.plan).toHaveBeenCalledTimes(2);
    expect(traced()).toContain(
      'live run 419-479: skipped, read 3 frames from 419',
    );
    expect(reported).toEqual([[opinion]]);
  });

  it('a take stopped between runs runs and reports nothing more', async () => {
    windows = 3;
    let runner: ReturnType<typeof startLiveCheck> | null = null;
    check.step.mockImplementationOnce(() => {
      runner?.stop();
      return opinions;
    });
    runner = startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(model.run).toHaveBeenCalledTimes(1);
    expect(reported).toEqual([]);
  });

  it('a run that fails ends the tick and keeps what came before', async () => {
    windows = 3;
    let n = 0;
    modelAnswer = async () => {
      n += 1;
      if (n === 2) throw new Error('ort');
      return {logp: new Float32Array(31 * 5), frames: 5};
    };
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(model.run).toHaveBeenCalledTimes(2);
    expect(traced()).toContain('live run 419-479: failed (ort)');
    expect(reported).toEqual([[opinion]]);
  });
});

describe('corrupted model output', () => {
  // As onnxruntime 1.24.3 gives it on x86-64: a row with one token at 0, the rest far
  // below any real log-probability.
  function corrupted(frames: number, row: number): ModelOutput {
    const logp = new Float32Array(31 * frames).fill(-3);
    logp.fill(-4e5, row * 31, (row + 1) * 31);
    logp[row * 31 + 5] = 0;
    return {logp, frames};
  }

  it('drops the run, counts it, and says so once a take', async () => {
    modelAnswer = async () => corrupted(5, 2);
    const runner = startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(model.run).toHaveBeenCalledTimes(1);
    expect(check.step).not.toHaveBeenCalled();
    expect(reported).toEqual([]);
    await chunkAt(5.28);
    expect(model.run).toHaveBeenCalledTimes(2);
    expect(check.step).not.toHaveBeenCalled();
    const said = traced().filter(l =>
      l.startsWith('live check: corrupted model output, run dropped'),
    );
    expect(said).toEqual([
      'live check: corrupted model output, run dropped (run 379-479, row 2)',
    ]);
    modelAnswer = async () => ({logp: new Float32Array(31 * 5), frames: 5});
    await chunkAt(5.76);
    expect(reported).toEqual([[opinion]]);
    runner.stop();
    expect(traced().at(-1)).toMatch(
      /^live check this take: 3 runs, .* 2 corrupted$/,
    );
  });

  it('a corrupted later window ends the tick and keeps what came before', async () => {
    windows = 3;
    let n = 0;
    modelAnswer = async () => {
      n += 1;
      return n === 2
        ? corrupted(5, 4)
        : {logp: new Float32Array(31 * 5), frames: 5};
    };
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(model.run).toHaveBeenCalledTimes(2);
    expect(check.step).toHaveBeenCalledTimes(1);
    expect(reported).toEqual([[opinion]]);
    expect(traced()).toContain(
      'live check: corrupted model output, run dropped (run 419-479, row 4)',
    );
  });
});

describe('skips', () => {
  it('while a run is in flight, without queueing', async () => {
    let answer: (out: ModelOutput) => void = () => undefined;
    modelAnswer = () =>
      new Promise(resolve => {
        answer = resolve;
      });
    startLiveCheck(host, port);
    await chunkAt(4.8);
    await chunkAt(5.28);
    await chunkAt(5.76);
    expect(model.run).toHaveBeenCalledTimes(1);
    answer({logp: new Float32Array(31), frames: 1});
    await jest.advanceTimersByTimeAsync(5);
    expect(reported).toHaveLength(1);
    expect(model.run).toHaveBeenCalledTimes(1);
    await chunkAt(6.24);
    expect(model.run).toHaveBeenCalledTimes(2);
  });

  it('when the follower has a backlog', async () => {
    backlog = 1;
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(check.plan).not.toHaveBeenCalled();
    expect(model.run).not.toHaveBeenCalled();
  });

  it('when the take is not ready', async () => {
    ready = false;
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(check.plan).not.toHaveBeenCalled();
  });

  it('while the second look uses the model', async () => {
    busy = true;
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(check.plan).not.toHaveBeenCalled();
    expect(model.run).not.toHaveBeenCalled();
  });

  it('with no model loaded', async () => {
    modelReady = false;
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(model.run).not.toHaveBeenCalled();
  });

  it('when the check has nothing to do', async () => {
    check.plan.mockReturnValueOnce(null);
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(engine.readMelFrames).not.toHaveBeenCalled();
  });

  it('on a short read of the frames', async () => {
    heldFrames = 470;
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(model.run).not.toHaveBeenCalled();
    expect(traced()).toContain(
      'live run 379-479: skipped, read 91 frames from 379',
    );
  });

  it('when the frames start later than asked', async () => {
    engine.readMelFrames.mockReturnValueOnce({
      first: 400,
      frames: 100,
      data: new Float32Array(8000),
    });
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(model.run).not.toHaveBeenCalled();
  });
});

describe('failures', () => {
  it('a model that fails skips the run, and the next one goes on', async () => {
    modelAnswer = async () => {
      throw new Error('ort');
    };
    startLiveCheck(host, port);
    await chunkAt(4.8);
    expect(reported).toEqual([]);
    expect(traced()).toContain('live run 379-479: failed (ort)');
    modelAnswer = async () => ({logp: new Float32Array(31), frames: 1});
    await chunkAt(5.28);
    expect(reported).toHaveLength(1);
  });

  it('a check that throws never reaches the engine', async () => {
    check.plan.mockImplementationOnce(() => {
      throw new Error('plan');
    });
    check.step.mockImplementationOnce(() => {
      throw new Error('step');
    });
    check.setPlace.mockImplementationOnce(() => {
      throw new Error('place');
    });
    const runner = startLiveCheck(host, port);
    expect(() => chunkDone?.(4.8)).not.toThrow();
    await jest.advanceTimersByTimeAsync(5);
    await chunkAt(5.28);
    expect(reported).toEqual([]);
    expect(() =>
      runner.setPlace({surah: 67, ayah: 2, word: 3, totalWords: 12}),
    ).not.toThrow();
    await chunkAt(5.76);
    expect(reported).toHaveLength(1);
  });

  it('a check that cannot be made runs nothing', async () => {
    (port.create as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no');
    });
    const runner = startLiveCheck(host, port);
    expect(engine.setChunkListener).not.toHaveBeenCalled();
    runner.lost();
    runner.stop();
  });
});

describe('the follower’s place', () => {
  it('is passed on', () => {
    const runner = startLiveCheck(host, port);
    runner.setPlace({surah: 67, ayah: 2, word: 3, totalWords: 12});
    runner.relocated({surah: 67, ayah: 2, word: 1}, 3.84);
    runner.lost();
    expect(check.setPlace).toHaveBeenCalledWith({
      surah: 67,
      ayah: 2,
      word: 3,
      totalWords: 12,
    });
    expect(check.relocated).toHaveBeenCalledWith(
      {surah: 67, ayah: 2, word: 1},
      3.84,
    );
    expect(check.lost).toHaveBeenCalledTimes(1);
  });
});

describe('stop', () => {
  it('lets the engine go and a run still out reports nothing', async () => {
    let answer: (out: ModelOutput) => void = () => undefined;
    modelAnswer = () =>
      new Promise(resolve => {
        answer = resolve;
      });
    const runner = startLiveCheck(host, port);
    await chunkAt(4.8);
    runner.stop();
    expect(engine.setChunkListener).toHaveBeenLastCalledWith(null);
    answer({logp: new Float32Array(31), frames: 1});
    await jest.advanceTimersByTimeAsync(5);
    expect(check.step).not.toHaveBeenCalled();
    expect(reported).toEqual([]);
    runner.setPlace({surah: 67, ayah: 2, word: 4, totalWords: 12});
    expect(check.setPlace).not.toHaveBeenCalled();
    expect(
      traced().some(l => l.startsWith('live check this take: 0 runs')),
    ).toBe(true);
  });
});
