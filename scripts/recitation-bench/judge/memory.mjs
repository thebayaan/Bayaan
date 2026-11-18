/* eslint-env node, es2020 */
// Resident memory and time per slice at one slice length, in a fresh process.
//   ORT_THREADS=1 [ORT_ARENA=0] node judge/memory.mjs [seconds] [runs]
import fs from 'node:fs';
import path from 'node:path';
import {loadModel, readF32} from './model.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const rssMb = () => Math.round(process.memoryUsage().rss / 1048576);
const seconds = Number(process.argv[2] ?? 8);
const runs = Number(process.argv[3] ?? 40);
const ROOT = path.join(HERE, '../.out/natural/audio');
const dir = path.join(ROOT, fs.readdirSync(ROOT).sort()[0]);
const longest = fs
  .readdirSync(dir)
  .map(f => [fs.statSync(path.join(dir, f)).size, f])
  .sort((a, b) => b[0] - a[0])[0][1];
const wave = readF32(path.join(dir, longest));
const start = rssMb();
const model = await loadModel();
const loaded = rssMb();
const times = [];
let peak = loaded;
for (let i = 0; i < runs; i++) {
  const from = 16000 * (i * 2);
  const r = await model.run(wave.subarray(from, from + 16000 * seconds));
  times.push(r.ortMs);
  peak = Math.max(peak, rssMb());
}
times.sort((a, b) => a - b);
console.log(
  JSON.stringify({
    seconds,
    arena: process.env.ORT_ARENA !== '0',
    startMb: start,
    afterLoadMb: loaded,
    peakMb: peak,
    endMb: rssMb(),
    ortMsMin: +times[0].toFixed(1),
    ortMsP50: +times[times.length >> 1].toFixed(1),
    ortMsP90: +times[Math.floor(times.length * 0.9)].toFixed(1),
  }),
);
