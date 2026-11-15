/* eslint-env node, es2020 */
// What a slice costs on this machine, one thread, one process: features, model
// and scoring by slice length, plus resident memory. Run on a quiet machine;
// reports the fastest pass, since other work only ever slows it.
//
//   ORT_THREADS=1 node judge/timing.mjs [<recording.f32>]
//   ORT_THREADS=1 node --jitless judge/timing.mjs      # JavaScript with no JIT,
//                                                      # closer to a phone's Hermes
import fs from 'node:fs';
import path from 'node:path';
import {loadModel, readF32} from './model.mjs';
import {fbank} from './fbank.mjs';
import {relativeTo, prepare, scoreWord} from './ctc.mjs';
import {tokensOf} from './judge.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const rssMb = () => +(process.memoryUsage().rss / 1048576).toFixed(0);
const before = rssMb();
const t0 = performance.now();
const model = await loadModel();
const loadMs = performance.now() - t0;
const afterLoad = rssMb();
// The longest recording of the first reciter, unless one is named.
const ROOT = path.join(HERE, '../.out/natural/audio');
const dir = path.join(ROOT, fs.readdirSync(ROOT).sort()[0]);
const longest = fs
  .readdirSync(dir)
  .map(f => [fs.statSync(path.join(dir, f)).size, f])
  .sort((a, b) => b[0] - a[0])[0][1];
const wave = readF32(process.argv[2] ?? path.join(dir, longest));
const passes = 7;
const out = [];
for (const seconds of [2, 4, 6, 8, 10, 12, 16, 20, 30]) {
  const slice = wave.subarray(16000 * 3, 16000 * (3 + seconds));
  let feat = Infinity;
  let ort = Infinity;
  let frames = 0;
  let logp;
  for (let i = 0; i < passes; i++) {
    const r = await model.run(slice);
    feat = Math.min(feat, r.featureMs);
    ort = Math.min(ort, r.ortMs);
    frames = r.frames;
    logp = r.logp;
  }
  // Scoring one disputed word with its alternatives, by how many there are.
  const left = [...tokensOf('قال'), 30, ...tokensOf('رب'), 30];
  const right = [30, ...tokensOf('العلمين')];
  const cand = tokensOf('الرحمن');
  const score = {};
  for (const n of [1, 14, 60, 200]) {
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const s = performance.now();
      const rel = relativeTo(logp, frames);
      const p = prepare(rel, frames, left, right);
      for (let k = 0; k < n; k++) scoreWord(p, cand);
      best = Math.min(best, performance.now() - s);
    }
    score[n] = +best.toFixed(1);
  }
  out.push({seconds, frames, featureMs: +feat.toFixed(1), ortMs: +ort.toFixed(1), scoreMsByAlternatives: score, rssMb: rssMb()});
}
console.log(JSON.stringify({jitless: process.execArgv.includes('--jitless'), threads: process.env.ORT_THREADS ?? 'default', beforeLoadMb: before, afterLoadMb: afterLoad, loadMs: +loadMs.toFixed(0), passes, slices: out}, null, 1));
void fbank;
