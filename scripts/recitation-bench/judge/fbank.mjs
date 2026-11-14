/* eslint-env es2020 */
// 80-bin log-mel features of quran-asr-small, in plain JavaScript with no Node
// or browser API, so the same file can run under React Native.
//
// The recipe is the model's own (code/quran_asr/features.py at the pinned
// revision; Kaldi defaults as kaldi-native-fbank computes them): 25 ms povey
// window, 10 ms shift, DC removal per frame, pre-emphasis 0.97, 512-point FFT,
// power spectrum without the Nyquist bin, 80 triangular mel bins from 20 Hz to
// 7600 Hz, log floored at the float32 epsilon, no dither, snip_edges false
// (samples outside the signal reflected), samples in [-1, 1]. The model holds
// its own mean and variance, so nothing is normalised here.
//
// test_fbank.mjs checks this against a NumPy port of the model's recipe.

export const SAMPLE_RATE = 16000;
export const NUM_BINS = 80;
const SHIFT = 160;
const LENGTH = 400;
const FFT = 512;
const BINS = FFT / 2;
const EPS = 1.1920928955078125e-7; // float32 epsilon
const LOW = 20;
const HIGH = SAMPLE_RATE / 2 - 400;

const mel = f => 1127 * Math.log(1 + f / 700);

/** Triangular filters: for each bin, the first FFT bin and its weights. */
function melBanks() {
  const width = SAMPLE_RATE / FFT;
  const lo = mel(LOW);
  const hi = mel(HIGH);
  const delta = (hi - lo) / (NUM_BINS + 1);
  const banks = [];
  for (let b = 0; b < NUM_BINS; b++) {
    const left = lo + b * delta;
    const center = lo + (b + 1) * delta;
    const right = lo + (b + 2) * delta;
    let first = -1;
    const weights = [];
    for (let i = 0; i < BINS; i++) {
      const m = mel(width * i);
      if (m > left && m < right) {
        if (first < 0) first = i;
        weights.push(m <= center ? (m - left) / (center - left) : (right - m) / (right - center));
      } else if (first >= 0) {
        break;
      }
    }
    banks.push({first: Math.max(first, 0), weights: Float32Array.from(weights)});
  }
  return banks;
}

const BANKS = melBanks();
const WINDOW = (() => {
  const w = new Float32Array(LENGTH);
  for (let i = 0; i < LENGTH; i++) {
    w[i] = Math.pow(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (LENGTH - 1)), 0.85);
  }
  return w;
})();

// Radix-2 FFT tables.
const COS = new Float64Array(FFT / 2);
const SIN = new Float64Array(FFT / 2);
for (let i = 0; i < FFT / 2; i++) {
  COS[i] = Math.cos((2 * Math.PI * i) / FFT);
  SIN[i] = Math.sin((2 * Math.PI * i) / FFT);
}
const REV = new Uint16Array(FFT);
for (let i = 0, bits = Math.log2(FFT); i < FFT; i++) {
  let r = 0;
  for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
  REV[i] = r;
}

function fftInPlace(re, im) {
  for (let i = 0; i < FFT; i++) {
    const r = REV[i];
    if (r > i) {
      const t = re[i];
      re[i] = re[r];
      re[r] = t;
      const u = im[i];
      im[i] = im[r];
      im[r] = u;
    }
  }
  for (let size = 2; size <= FFT; size *= 2) {
    const half = size / 2;
    const step = FFT / size;
    for (let start = 0; start < FFT; start += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = start + j;
        const b = a + half;
        const wr = COS[k];
        const wi = -SIN[k];
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

export function numFrames(numSamples) {
  return Math.floor((numSamples + SHIFT / 2) / SHIFT);
}

/**
 * @param {Float32Array} wave 16 kHz mono in [-1, 1]
 * @returns {{data: Float32Array, frames: number}} [frames, 80] row by row
 */
export function fbank(wave) {
  const n = wave.length;
  const frames = numFrames(n);
  const out = new Float32Array(frames * NUM_BINS);
  // The model's recipe works in float32, so this does too (Math.fround): the
  // log-mels then match it to float rounding.
  const frame = new Float32Array(LENGTH);
  const re = new Float64Array(FFT);
  const im = new Float64Array(FFT);
  const power = new Float64Array(BINS);
  for (let t = 0; t < frames; t++) {
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
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < LENGTH; i++) re[i] = frame[i] * WINDOW[i];
    fftInPlace(re, im);
    for (let i = 0; i < BINS; i++) power[i] = re[i] * re[i] + im[i] * im[i];
    const row = t * NUM_BINS;
    for (let b = 0; b < NUM_BINS; b++) {
      const {first, weights} = BANKS[b];
      let e = 0;
      for (let i = 0; i < weights.length; i++) e += power[first + i] * weights[i];
      out[row + b] = Math.log(Math.max(e, EPS));
    }
  }
  return {data: out, frames};
}
