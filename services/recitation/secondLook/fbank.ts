// 80-bin log-mel features of quran-asr-small.
//
// The recipe is the model's own (Kaldi defaults as kaldi-native-fbank computes
// them): 25 ms povey window, 10 ms shift, DC removal per frame, pre-emphasis
// 0.97, 512-point FFT, power spectrum without the Nyquist bin, 80 triangular mel
// bins from 20 Hz to 7600 Hz, log floored at the float32 epsilon, no dither,
// snip_edges false (samples outside the signal reflected), samples in [-1, 1].
// The model holds its own mean and variance, so nothing is normalised here.

export const SAMPLE_RATE = 16000;
export const NUM_BINS = 80;
const SHIFT = 160;
const LENGTH = 400;
const FFT = 512;
const BINS = FFT / 2;
const EPS = 1.1920928955078125e-7; // float32 epsilon
const LOW = 20;
const HIGH = SAMPLE_RATE / 2 - 400;

/**
 * Frames worked out between two pauses in fbankInSteps. A 5.5 s slice is 550
 * frames and takes about 200 ms of CPU with no JIT on a Mac (node --jitless),
 * which has run close to an iPhone 14 Pro for this kind of code. In one go that
 * would hold the JS thread too long; a step of 32 frames is about 12 ms.
 */
const FRAMES_PER_STEP = 32;

interface Tables {
  /** For each bin, the first FFT bin and its weights. */
  banks: {first: number; weights: Float32Array}[];
  /** FFT bins past this one carry no mel weight. */
  maxBin: number;
  window: Float32Array;
  /** Where each half-size sample goes in the half-size FFT. */
  bitrev: Int32Array;
  /** The half-size FFT's twiddles, stage by stage. */
  stageRe: Float64Array[];
  stageIm: Float64Array[];
  /** The twiddles of the split pass. */
  splitRe: Float64Array;
  splitIm: Float64Array;
}

const mel = (f: number) => 1127 * Math.log(1 + f / 700);

function melBanks(): Tables['banks'] {
  const width = SAMPLE_RATE / FFT;
  const lo = mel(LOW);
  const hi = mel(HIGH);
  const delta = (hi - lo) / (NUM_BINS + 1);
  const banks: Tables['banks'] = [];
  for (let b = 0; b < NUM_BINS; b++) {
    const left = lo + b * delta;
    const center = lo + (b + 1) * delta;
    const right = lo + (b + 2) * delta;
    let first = -1;
    const weights: number[] = [];
    for (let i = 0; i < BINS; i++) {
      const m = mel(width * i);
      if (m > left && m < right) {
        if (first < 0) first = i;
        weights.push(
          m <= center
            ? (m - left) / (center - left)
            : (right - m) / (right - center),
        );
      } else if (first >= 0) {
        break;
      }
    }
    banks.push({
      first: Math.max(first, 0),
      weights: Float32Array.from(weights),
    });
  }
  return banks;
}

let tables: Tables | null = null;

// Built on first use, so opening the app does not pay for a feature that may
// not run.
function getTables(): Tables {
  if (tables) return tables;
  const banks = melBanks();
  const window = new Float32Array(LENGTH);
  for (let i = 0; i < LENGTH; i++) {
    window[i] = Math.pow(
      0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (LENGTH - 1)),
      0.85,
    );
  }
  const bitrev = new Int32Array(BINS);
  for (let i = 1, j = 0; i < BINS; i++) {
    let bit = BINS >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    bitrev[i] = j;
  }
  const stageRe: Float64Array[] = [];
  const stageIm: Float64Array[] = [];
  for (let size = 2; size <= BINS; size *= 2) {
    const re = new Float64Array(size / 2);
    const im = new Float64Array(size / 2);
    for (let j = 0; j < size / 2; j++) {
      re[j] = Math.cos((2 * Math.PI * j) / size);
      im[j] = -Math.sin((2 * Math.PI * j) / size);
    }
    stageRe.push(re);
    stageIm.push(im);
  }
  const splitRe = new Float64Array(BINS);
  const splitIm = new Float64Array(BINS);
  for (let k = 0; k < BINS; k++) {
    splitRe[k] = Math.cos((2 * Math.PI * k) / FFT);
    splitIm[k] = -Math.sin((2 * Math.PI * k) / FFT);
  }
  let maxBin = 0;
  for (const {first, weights} of banks) {
    maxBin = Math.max(maxBin, first + weights.length);
  }
  tables = {
    banks,
    maxBin,
    window,
    bitrev,
    stageRe,
    stageIm,
    splitRe,
    splitIm,
  };
  return tables;
}

/** In-place FFT of size BINS; the input is already in bit-reversed order. */
function fftHalf(re: Float64Array, im: Float64Array, t: Tables): void {
  for (let size = 2, stage = 0; size <= BINS; size *= 2, stage++) {
    const half = size / 2;
    const stageRe = t.stageRe[stage];
    const stageIm = t.stageIm[stage];
    for (let start = 0; start < BINS; start += size) {
      for (let j = 0; j < half; j++) {
        const a = start + j;
        const b = a + half;
        const wr = stageRe[j];
        const wi = stageIm[j];
        const br = re[b];
        const bi = im[b];
        const tr = br * wr - bi * wi;
        const ti = br * wi + bi * wr;
        const ar = re[a];
        const ai = im[a];
        re[b] = ar - tr;
        im[b] = ai - ti;
        re[a] = ar + tr;
        im[a] = ai + ti;
      }
    }
  }
}

export function numFrames(numSamples: number): number {
  return Math.floor((numSamples + SHIFT / 2) / SHIFT);
}

/** Space for one frame's sums, reused from frame to frame. */
interface Work {
  frame: Float32Array;
  re: Float64Array;
  im: Float64Array;
  power: Float64Array;
}

function newWork(): Work {
  return {
    // The model's recipe works in float32, so this does too: the log-mels then
    // match it to float rounding.
    frame: new Float32Array(LENGTH),
    re: new Float64Array(BINS),
    im: new Float64Array(BINS),
    power: new Float64Array(BINS),
  };
}

/** Writes frame t into out. */
function writeFrame(
  wave: Float32Array,
  t: number,
  out: Float32Array,
  {frame, re, im, power}: Work,
  tablesNow: Tables,
): void {
  const n = wave.length;
  const start = t * SHIFT + SHIFT / 2 - LENGTH / 2;
  let sum = 0;
  for (let i = 0; i < LENGTH; i++) {
    let idx = start + i;
    if (idx < 0) idx = -idx - 1;
    if (idx >= n) idx = 2 * n - 1 - idx;
    if (idx < 0) idx = 0;
    if (idx > n - 1) idx = n - 1;
    frame[i] = wave[idx];
    sum += frame[i];
  }
  const mean = sum / LENGTH;
  for (let i = 0; i < LENGTH; i++) frame[i] -= mean;
  // Pre-emphasis, last sample backwards so the previous sample is unchanged.
  for (let i = LENGTH - 1; i > 0; i--) frame[i] -= 0.97 * frame[i - 1];
  frame[0] *= 1 - 0.97;
  // The windowed frame is real, so the 512-point FFT runs as a 256-point complex
  // FFT over its even and odd samples plus one split pass, at half the time in an
  // interpreter. z[n] = x[2n] + i x[2n+1], straight to bit-reversed slots.
  const {window, bitrev, splitRe, splitIm, maxBin, banks} = tablesNow;
  re.fill(0);
  im.fill(0);
  for (let i = 0; i < LENGTH; i += 2) {
    const slot = bitrev[i >> 1];
    re[slot] = frame[i] * window[i];
    im[slot] = frame[i + 1] * window[i + 1];
  }
  fftHalf(re, im, tablesNow);
  // X[k] = E[k] + W^k O[k], with E and O the spectra of the even and odd samples.
  for (let k = 0; k < maxBin; k++) {
    const m = (BINS - k) & (BINS - 1);
    const er = (re[k] + re[m]) * 0.5;
    const ei = (im[k] - im[m]) * 0.5;
    const or = (im[k] + im[m]) * 0.5;
    const oi = (re[m] - re[k]) * 0.5;
    const xr = er + splitRe[k] * or - splitIm[k] * oi;
    const xi = ei + splitRe[k] * oi + splitIm[k] * or;
    power[k] = xr * xr + xi * xi;
  }
  const row = t * NUM_BINS;
  for (let b = 0; b < NUM_BINS; b++) {
    const {first, weights} = banks[b];
    let e = 0;
    for (let i = 0; i < weights.length; i++) e += power[first + i] * weights[i];
    out[row + b] = Math.log(Math.max(e, EPS));
  }
}

export interface Features {
  /** [frames, 80] row by row. */
  data: Float32Array;
  frames: number;
}

/** @param wave - 16 kHz mono in [-1, 1] */
export function fbank(wave: Float32Array): Features {
  const frames = numFrames(wave.length);
  const data = new Float32Array(frames * NUM_BINS);
  const work = newWork();
  const tablesNow = getTables();
  for (let t = 0; t < frames; t++) writeFrame(wave, t, data, work, tablesNow);
  return {data, frames};
}

const nextTask = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });

/**
 * The same features, pausing every so many frames so a slice never holds the
 * JS thread for long.
 */
export async function fbankInSteps(
  wave: Float32Array,
  framesPerStep: number = FRAMES_PER_STEP,
  pause: () => Promise<void> = nextTask,
): Promise<Features> {
  const frames = numFrames(wave.length);
  const data = new Float32Array(frames * NUM_BINS);
  const work = newWork();
  const tablesNow = getTables();
  for (let t = 0; t < frames; t++) {
    writeFrame(wave, t, data, work, tablesNow);
    if ((t + 1) % framesPerStep === 0 && t + 1 < frames) await pause();
  }
  return {data, frames};
}
