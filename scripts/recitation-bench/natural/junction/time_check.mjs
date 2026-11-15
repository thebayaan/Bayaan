/* eslint-env node, es2020 */
// How long one junction test takes on this machine, on real joins: the frames it
// reads, the forced alignments it runs and the wall time. Scores are not printed.
//
//   node natural/junction/time_check.mjs <runs dir> <post dir> [takes]
import fs from 'node:fs';
import path from 'node:path';
import {DumpPosteriors, junctionTest, loadCorpus} from './llr.mjs';

const [runsDir, postDir, takes] = process.argv.slice(2);
const corpus = loadCorpus();
const ms = [];
const frames = [];
const files = fs.readdirSync(runsDir).filter(f => f.endsWith('.json')).slice(0, Number(takes ?? 40));
for (const f of files) {
  const run = JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8'));
  const pr = run.probe;
  if (!pr?.post) continue;
  const post = new DumpPosteriors(fs.readFileSync(path.join(postDir, pr.post)), pr.epochs);
  for (const j of pr.joins) {
    const snap = j.snaps.find(x => x.m >= 1);
    if (!snap) continue;
    const words = new Map(snap.words.map(w => [w.g, w]));
    const before = words.get(j.L - 1);
    if (before?.from === undefined) continue;
    post.setEpoch(snap.epoch);
    const from = Math.max(0, before.ff - 1);
    if (!post.has(from, snap.frames) || snap.frames <= from) continue;
    const start = performance.now();
    junctionTest(corpus, post, j.L - 1, j.L, from, snap.frames);
    ms.push(performance.now() - start);
    frames.push(snap.frames - from);
  }
}
const q = (xs, p) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
console.log(JSON.stringify({
  tests: ms.length,
  msMedian: +q(ms, 0.5).toFixed(2),
  msP90: +q(ms, 0.9).toFixed(2),
  msP99: +q(ms, 0.99).toFixed(2),
  msMax: +q(ms, 1).toFixed(2),
  framesMedian: q(frames, 0.5),
  framesP99: q(frames, 0.99),
  framesMax: q(frames, 1),
}));
