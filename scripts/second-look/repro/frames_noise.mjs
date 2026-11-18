/* eslint-env node, es2020 */
// The bench's rows were scored on judge/fbank.mjs's frames, and the app reads the engine's
// own. The two differ by under 0.002 in any bin, but the model is int8, and a score can move
// by more than that. This measures by how much, on the same slices: the judge's scores on
// both, and how often the answer changes. Tuning cells only.
//   node scripts/second-look/repro/frames_noise.mjs <suite> [limit of runs]
import fs from 'node:fs';
import {
  loadModel,
  sliceFrames,
  MIN_FRAMES,
} from '../../recitation-bench/judge/model.mjs';
import {fbank} from '../../recitation-bench/judge/fbank.mjs';
import {judgeWord} from '../../recitation-bench/judge/judge.mjs';
import {answer} from '../../recitation-bench/judge/policy.mjs';
import {POLICIES} from '../chain.mjs';
import {
  HOLD,
  LEFT,
  RIGHT,
  SUITES,
  altsOf,
  audioOf,
  gate,
  hafsToken,
  lettersOf,
  loadRows,
  suiteRunIds,
} from '../lib.mjs';
import {melFramesOf} from './engine.mjs';

const [name, limit] = process.argv.slice(2);
const suite = SUITES[name];
const rowsByRun = loadRows(name, HOLD);
const model = await loadModel();
const moved = {expected: [], nothing: []};
let slices = 0;
let flips = 0;
let scored = 0;
let worst = 0;
const flipList = [];
for (const id of suiteRunIds(name).slice(0, Number(limit ?? Infinity))) {
  const rows = rowsByRun.get(id);
  if (!rows?.size) continue;
  await gate();
  const run = JSON.parse(fs.readFileSync(suite.plain(id), 'utf8'));
  const audio = audioOf(run);
  const recipe = fbank(audio);
  const engine = melFramesOf(audio);
  const bySlice = new Map();
  for (const r of rows.values()) {
    if (r.src !== 'live') continue;
    const k = r.slice.join();
    if (!bySlice.has(k)) bySlice.set(k, []);
    bySlice.get(k).push(r);
  }
  for (const list of bySlice.values()) {
    const start = Math.round(list[0].slice[0] * 16000);
    const end = Math.round(list[0].slice[1] * 16000);
    const piece = sliceFrames(recipe, start, end, audio.length);
    if (piece.frames < MIN_FRAMES) continue;
    const first = Math.round(start / 160);
    const other = engine.data.subarray(first * 80, (first + piece.frames) * 80);
    if (other.length !== piece.data.length) continue;
    for (let i = 0; i < other.length; i++) {
      worst = Math.max(worst, Math.abs(other[i] - piece.data[i]));
    }
    const a = await model.runFrames(piece.data, piece.frames);
    const b = await model.runFrames(other, piece.frames);
    slices += 1;
    for (const r of list) {
      const [s, ay, w] = r.id.split(':').map(Number);
      const key = `${s}:${ay}`;
      const words = lettersOf(key);
      if (!words) continue;
      const j = hafsToken(key, w);
      const opts = {leftWords: LEFT, rightWords: RIGHT};
      const x = judgeWord(a.logp, a.frames, words, j, altsOf(key, j), opts);
      const y = judgeWord(b.logp, b.frames, words, j, altsOf(key, j), opts);
      moved.expected.push(Math.abs(x.expected - y.expected));
      moved.nothing.push(Math.abs(x.nothing - y.nothing));
      scored += 1;
      const sayX = answer({r: x}, POLICIES.S1);
      const sayY = answer({r: y}, POLICIES.S1);
      if (sayX !== sayY) {
        flips += 1;
        flipList.push([x.expected, y.expected, sayX, sayY]);
      }
    }
  }
}
const q = (xs, p) => {
  const s = [...xs].sort((u, v) => u - v);
  return s.length
    ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3)
    : null;
};
console.log(
  JSON.stringify({
    suite: name,
    slices,
    words: scored,
    worstBin: +worst.toFixed(5),
    expectedMoved: {
      median: q(moved.expected, 0.5),
      p90: q(moved.expected, 0.9),
      p99: q(moved.expected, 0.99),
      max: q(moved.expected, 1),
    },
    answerChanged: flips,
    samples: flipList.slice(0, 8),
  }),
);
process.exit(0);
