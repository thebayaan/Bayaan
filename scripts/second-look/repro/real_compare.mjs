/* eslint-env node, es2020 */
// The real engine's run (real_engine.mjs) beside the playback of the same clips (run.mjs
// with --trace 1 --tag realcheck): do the same verdicts wake the judge, does it answer the
// same, and do the same marks show? Word positions and numbers only.
//   node scripts/second-look/repro/real_compare.mjs
import fs from 'node:fs';
import path from 'node:path';
import {OUT} from '../lib.mjs';

const REPRO = path.join(OUT, 'repro');
const read = f =>
  fs.existsSync(f)
    ? fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l))
    : [];
const real = read(path.join(REPRO, 'real.jsonl'));
const playback = new Map();
for (const suite of ['pool', 'w1', 'live_last']) {
  for (const r of read(path.join(REPRO, `${suite}.realcheck.jsonl`))) {
    playback.set(r.id, r);
  }
}
const JUDGE =
  /^judge (\S+ word \d+) (\w+) at ([\d.]+) s: (\w+)(?:, expected (-?[\d.]+))?/;
const judgeLines = lines =>
  new Map(
    lines
      .map(l => JUDGE.exec(l))
      .filter(Boolean)
      .map(m => [
        `${m[1]}@${m[3]}`,
        {state: m[2], answer: m[4], expected: m[5] ? Number(m[5]) : null},
      ]),
  );
const out = {};
for (const c of ['s1', 's2']) {
  const t = {
    clips: 0,
    wakesReal: 0,
    wakesPlayback: 0,
    both: 0,
    sameAnswer: 0,
    answerDiffers: [],
    scoreMoved: [],
    marksReal: 0,
    marksPlayback: 0,
    marksOnlyReal: [],
    marksOnlyPlayback: [],
  };
  for (const r of real) {
    const p = playback.get(r.id)?.cfg[c]?.['0.25']?.app;
    if (!r.cfg[c] || !p) continue;
    t.clips += 1;
    const a = judgeLines(r.cfg[c].lines);
    const b = judgeLines(p.trace);
    t.wakesReal += a.size;
    t.wakesPlayback += b.size;
    for (const [k, v] of a) {
      const w = b.get(k);
      if (!w) continue;
      t.both += 1;
      if (v.answer === w.answer) t.sameAnswer += 1;
      else t.answerDiffers.push(`${r.id} ${k}: ${w.answer} to ${v.answer}`);
      if (v.expected !== null && w.expected !== null) {
        t.scoreMoved.push(Math.abs(v.expected - w.expected));
      }
    }
    const x = new Set(r.cfg[c].shown.map(m => m.id));
    const y = new Set(p.shown.map(m => m.id));
    t.marksReal += x.size;
    t.marksPlayback += y.size;
    for (const id of x) if (!y.has(id)) t.marksOnlyReal.push(`${r.id} ${id}`);
    for (const id of y)
      if (!x.has(id)) t.marksOnlyPlayback.push(`${r.id} ${id}`);
  }
  const s = t.scoreMoved.sort((u, v) => u - v);
  t.scoreMoved = {
    n: s.length,
    identical: s.filter(v => v === 0).length,
    median: s[s.length >> 1] ?? null,
    max: s[s.length - 1] ?? null,
  };
  out[c] = t;
}
console.log(JSON.stringify(out, null, 1));
