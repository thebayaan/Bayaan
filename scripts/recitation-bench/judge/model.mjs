/* eslint-env node, es2020 */
// quran-asr-small under onnxruntime-node, the same runtime and version as the
// app's onnxruntime-react-native (1.24.3). Inputs and outputs as in the model's
// export: x [N, T, 80] float32, x_lens [N] int64; log_probs [N, T', 31] float32,
// log_probs_len [N] int64. One output frame is 40 ms.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fbank, NUM_BINS} from './fbank.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(path.join(HERE, '../package.json'));
const ort = require('onnxruntime-node');

export const REVISION = '004f898639f3127a74eac1b898a2cb3ef0b5268d';
export const MODEL_DIR = path.join(HERE, '../.out/natural/qas', `hf_${REVISION}`);
export const VOCAB = 31;
export const BLANK = 0;
export const WORD = 30;

export async function loadModel(file = path.join(MODEL_DIR, 'model.int8.onnx')) {
  const session = await ort.InferenceSession.create(file, {
    executionProviders: ['cpu'],
    intraOpNumThreads: Number(process.env.ORT_THREADS ?? 1),
    interOpNumThreads: 1,
    // ORT_ARENA=0 returns memory after each run, at some cost per run.
    ...(process.env.ORT_ARENA === '0' ? {enableCpuMemArena: false, enableMemPattern: false} : {}),
  });
  return {
    session,
    /**
     * From log-mel frames already computed, as the app would read them from a
     * rolling buffer of the engine's own frames.
     * @param {Float32Array} data [frames, 80] row by row
     * @param {number} frames
     * @returns {{logp: Float32Array, frames: number, ortMs: number}} logp is
     *   [frames, 31] row by row
     */
    async runFrames(data, frames) {
      const t0 = performance.now();
      const out = await session.run({
        x: new ort.Tensor('float32', data, [1, frames, NUM_BINS]),
        x_lens: new ort.Tensor('int64', BigInt64Array.from([BigInt(frames)]), [1]),
      });
      const t1 = performance.now();
      const dims = out.log_probs.dims;
      const len = Number(out.log_probs_len.data[0]);
      return {logp: out.log_probs.data.slice(0, len * dims[2]), frames: len, ortMs: t1 - t0};
    },
    /** From audio: runs the features too. */
    async run(wave) {
      const t0 = performance.now();
      const {data, frames} = fbank(wave);
      const t1 = performance.now();
      const r = await this.runFrames(data, frames);
      return {...r, featureMs: t1 - t0};
    },
  };
}

const SHIFT = 160;
const WINDOW_AFTER_START = 280; // a frame's window ends this far after its grid point

/**
 * The frames a rolling buffer of the stream's features holds for the audio from
 * sample `start` to sample `end`: only frames whose window has ended by `end`,
 * unless `end` is the end of the stream.
 * @param {{data: Float32Array, frames: number}} feats the whole stream's features
 * @returns {{data: Float32Array, frames: number}} a view, not a copy
 */
export function sliceFrames(feats, start, end, streamEnd) {
  const first = Math.max(0, Math.round(start / SHIFT));
  const last =
    end >= streamEnd
      ? feats.frames
      : Math.min(feats.frames, Math.floor((end - WINDOW_AFTER_START) / SHIFT) + 1);
  const frames = Math.max(0, last - first);
  return {data: feats.data.subarray(first * NUM_BINS, last * NUM_BINS), frames};
}
/**
 * The slice followed by `extra` copies of its quietest frame, as a reader's pause
 * would look, so the model does not meet an abrupt cut.
 */
export function withQuietTail(cut, extra) {
  let quietest = 0;
  let lowest = Infinity;
  for (let t = 0; t < cut.frames; t++) {
    let sum = 0;
    for (let b = 0; b < NUM_BINS; b++) sum += cut.data[t * NUM_BINS + b];
    if (sum < lowest) {
      lowest = sum;
      quietest = t;
    }
  }
  const frames = cut.frames + extra;
  const data = new Float32Array(frames * NUM_BINS);
  data.set(cut.data);
  const row = cut.data.subarray(quietest * NUM_BINS, (quietest + 1) * NUM_BINS);
  for (let t = cut.frames; t < frames; t++) data.set(row, t * NUM_BINS);
  return {data, frames};
}
/** Below this many frames the model's subsampling leaves too little to score. */
export const MIN_FRAMES = 16;

export function loadTokens(file = path.join(MODEL_DIR, 'tokens.txt')) {
  return fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map(l => l.split(' ')[0]);
}

/** Greedy CTC: letters with ▁ between words. */
export function greedy(logp, frames, tokens) {
  const ids = [];
  const at = [];
  let prev = -1;
  for (let t = 0; t < frames; t++) {
    let best = 0;
    let bestV = -Infinity;
    for (let k = 0; k < VOCAB; k++) {
      const v = logp[t * VOCAB + k];
      if (v > bestV) {
        bestV = v;
        best = k;
      }
    }
    if (best !== BLANK && best !== prev) {
      ids.push(best);
      at.push(t);
    }
    prev = best;
  }
  return {ids, at, text: ids.map(i => (i === WORD ? ' ' : tokens[i])).join('')};
}

export function readF32(file) {
  const buf = fs.readFileSync(file);
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}
