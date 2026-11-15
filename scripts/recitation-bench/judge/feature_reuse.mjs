/* eslint-env node, es2020 */
// The engine already computes the same log-mel recipe in JavaScript for every
// chunk (@tilawa/core's KaldiFbank, MIT). Can the judge read those frames from a
// rolling buffer instead of running a second FFT? Compares, on real recordings,
// the features and the model's output both ways.
//
//   ORT_THREADS=1 node judge/feature_reuse.mjs [--clips 20] [--seconds 8]
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fbank, NUM_BINS} from './fbank.mjs';
import {loadModel, loadTokens, greedy, readF32, VOCAB} from './model.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../../..');
const dist = path.join(ROOT, 'node_modules/@tilawa/core/dist/recitation/fbank.js');
const {KaldiFbank} = await import(dist);
const require = createRequire(path.join(HERE, '../package.json'));
const ort = require('onnxruntime-node');

const argOf = (name, d) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? Number(process.argv[at + 1]) : d;
};
const CLIPS = argOf('--clips', 20);
const SECONDS = argOf('--seconds', 8);
const CHUNK = 7680;

const audioRoot = path.join(HERE, '../.out/natural/audio');
const reciter = path.join(audioRoot, fs.readdirSync(audioRoot).sort()[0]);
const files = fs
  .readdirSync(reciter)
  .filter(f => f.endsWith('.f32'))
  .map(f => [fs.statSync(path.join(reciter, f)).size, f])
  .filter(([s]) => s / 4 / 16000 > SECONDS + 2)
  .sort((a, b) => (a[1] < b[1] ? -1 : 1));
const picked = files.filter((_, i) => i % Math.max(1, Math.floor(files.length / CLIPS)) === 0).slice(0, CLIPS);

const model = await loadModel();
const tokens = loadTokens();
const runFeatures = async (data, frames) => {
  const out = await model.session.run({
    x: new ort.Tensor('float32', data, [1, frames, NUM_BINS]),
    x_lens: new ort.Tensor('int64', BigInt64Array.from([BigInt(frames)]), [1]),
  });
  const len = Number(out.log_probs_len.data[0]);
  return {logp: out.log_probs.data.slice(0, len * VOCAB), frames: len};
};

let worstFeature = 0;
let inner = 0;
let innerWorst = 0;
let sameText = 0;
let compared = 0;
let rmsSum = 0;
let lenDiff = 0;
for (const [, f] of picked) {
  const wave = readF32(path.join(reciter, f));
  const engine = new KaldiFbank();
  const frames = [];
  for (let off = 0; off + CHUNK <= wave.length; off += CHUNK) {
    frames.push(...engine.acceptWaveform(wave.subarray(off, off + CHUNK)));
  }
  // A slice ending at a chunk boundary, as a verdict's would.
  const endChunk = Math.floor(wave.length / CHUNK) - 1;
  const end = endChunk * CHUNK;
  const start = end - SECONDS * 16000;
  if (start < 0) continue;
  const fresh = fbank(wave.subarray(start, end));
  const first = start / 160;
  // What a rolling buffer holds at that moment: frames whose window has ended.
  const available = Math.floor((end - 280) / 160) + 1 - first;
  const buffered = new Float32Array(available * NUM_BINS);
  for (let t = 0; t < available; t++) buffered.set(frames[first + t], t * NUM_BINS);
  for (let t = 0; t < available; t++) {
    for (let b = 0; b < NUM_BINS; b++) {
      const d = Math.abs(buffered[t * NUM_BINS + b] - fresh.data[t * NUM_BINS + b]);
      if (t === 0) worstFeature = Math.max(worstFeature, d);
      else {
        innerWorst = Math.max(innerWorst, d);
        inner += 1;
      }
    }
  }
  const a = await runFeatures(fresh.data, fresh.frames);
  const b = await runFeatures(buffered, available);
  const ga = greedy(a.logp, a.frames, tokens).text;
  const gb = greedy(b.logp, b.frames, tokens).text;
  compared += 1;
  if (ga === gb) sameText += 1;
  else console.log(`differs ${f}\n  fresh    ${ga}\n  buffered ${gb}`);
  lenDiff = Math.max(lenDiff, Math.abs(a.frames - b.frames));
  const n = Math.min(a.frames, b.frames) - 2;
  let sum = 0;
  for (let i = 0; i < n * VOCAB; i++) sum += (a.logp[i] - b.logp[i]) ** 2;
  rmsSum += Math.sqrt(sum / (n * VOCAB));
}
console.log(
  JSON.stringify({
    slices: compared,
    seconds: SECONDS,
    firstFrameWorstDifference: +worstFeature.toFixed(4),
    otherFramesWorstDifference: +innerWorst.toFixed(5),
    otherFramesCompared: inner,
    sameGreedyText: sameText,
    modelFramesDifferBy: lenDiff,
    logProbRmsDifference: +(rmsSum / Math.max(1, compared)).toFixed(4),
  }),
);
