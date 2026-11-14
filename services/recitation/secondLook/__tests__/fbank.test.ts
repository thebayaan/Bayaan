import {testWave} from '@/test-utils/secondLookSignals';
import {fbank, fbankInSteps, numFrames, NUM_BINS} from '../fbank';
import golden from './fixtures/fbankGolden.json';

// The goldens are the plain JavaScript original's output on the same inputs, at
// the version fixtures/originals.json names. Cut by
// scripts/second-look/gen_goldens.mjs, whose --check says whether they still hold.

interface Summary {
  samples: number;
  frames: number;
  numFrames: number;
  rows: Record<string, number[]>;
  frameMeans: number[];
  binMeans: number[];
}

const TOLERANCE = 2e-5;

function expectClose(actual: number, expected: number, what: string): void {
  if (Math.abs(actual - expected) > TOLERANCE) {
    throw new Error(`${what}: ${actual} is not ${expected}`);
  }
}

function expectSame(
  {data, frames}: {data: Float32Array; frames: number},
  summary: Summary,
): void {
  expect(frames).toBe(summary.frames);
  expect(data.length).toBe(summary.frames * NUM_BINS);
  for (const [at, row] of Object.entries(summary.rows)) {
    row.forEach((value, b) => {
      expectClose(
        data[Number(at) * NUM_BINS + b],
        value,
        `frame ${at} bin ${b}`,
      );
    });
  }
  summary.frameMeans.forEach((value, t) => {
    let sum = 0;
    for (let b = 0; b < NUM_BINS; b++) sum += data[t * NUM_BINS + b];
    expectClose(sum / NUM_BINS, value, `frame ${t} mean`);
  });
  summary.binMeans.forEach((value, b) => {
    let sum = 0;
    for (let t = 0; t < frames; t++) sum += data[t * NUM_BINS + b];
    expectClose(sum / Math.max(1, frames), value, `bin ${b} mean`);
  });
}

const whole = testWave(88000);

const CASES: [string, Float32Array, Summary][] = [
  ['5.5 s', whole, golden.fiveAndAHalfSeconds],
  [
    '1 s cut anywhere',
    whole.slice(12345, 12345 + 16000),
    golden.oneSecondCutAnywhere,
  ],
  ['shorter than one window', whole.slice(0, 100), golden.shorterThanOneWindow],
  ['digital silence', new Float32Array(1600), golden.silence],
  ['no audio', new Float32Array(0), golden.empty],
];

describe('fbank', () => {
  it.each(CASES)('matches the original on %s', (_name, wave, summary) => {
    expect(numFrames(wave.length)).toBe(summary.numFrames);
    expectSame(fbank(wave), summary);
  });

  it.each(CASES)('in steps matches the original on %s', async (_n, wave, s) => {
    expectSame(await fbankInSteps(wave), s);
  });

  it('gives the thread back every so many frames', async () => {
    const pause = jest.fn(async () => undefined);
    const {frames} = await fbankInSteps(whole, 100, pause);
    expect(frames).toBe(550);
    // After frames 100, 200, 300, 400 and 500; none after the last.
    expect(pause).toHaveBeenCalledTimes(5);
  });

  it('never pauses for a slice shorter than one step', async () => {
    const pause = jest.fn(async () => undefined);
    await fbankInSteps(whole.slice(0, 16000), 100, pause);
    expect(pause).toHaveBeenCalledTimes(0);
    await fbankInSteps(whole.slice(0, 16000), 101, pause);
    expect(pause).toHaveBeenCalledTimes(0);
  });
});
