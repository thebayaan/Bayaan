/* eslint-env node, es2020 */
// How well the engine's own word times (the tracker's frames, as the app could
// read them at any moment) mark where an ayah starts, against the second model's
// alignment. Only for placing the slice: nothing about the judge's margins comes
// from here.
//   node judge/engine_timing.mjs [--split dev]
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const J = path.join(HERE, '../.out/natural/judge');
const RUNS = path.join(HERE, '../.out/natural/baseline/runs/pool');
const at = process.argv.indexOf('--split');
const split = at > 0 ? process.argv[at + 1] : 'dev';
const align = new Map();
for (const f of fs.readdirSync(path.join(J, 'align'))) {
  for (const line of fs.readFileSync(path.join(J, 'align', f), 'utf8').split('\n')) {
    if (!line) continue;
    const r = JSON.parse(line);
    align.set(`${r.slug}|${r.key}`, r);
  }
}
const q = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : null;
};
const firstDiff = [];
const lastDiff = [];
let ayat = 0;
let missing = 0;
for (const f of fs.readdirSync(RUNS)) {
  if (!f.endsWith('.json')) continue;
  const run = JSON.parse(fs.readFileSync(path.join(RUNS, f), 'utf8'));
  const t = run.clip.truth;
  if (split !== 'all' && (t.reciterSplit !== split || t.blockSplit !== split)) continue;
  const words = new Map(run.flush.words.map(w => [w.id, w]));
  for (const part of run.partsAt) {
    ayat += 1;
    const a = align.get(`${t.reciter}|${part.key}`);
    const w = words.get(`${part.key}:0`);
    if (!w || w.from === null || a.restarts) {
      missing += 1;
      continue;
    }
    firstDiff.push(w.from * 0.04 - (part.start + a.times[0][0]));
    // The last word's end against the clip's own end.
    const n = a.map.length;
    const lastId = `${part.key}:${Math.max(...a.map)}`;
    const lw = words.get(lastId);
    if (lw && lw.to !== null) lastDiff.push(lw.to * 0.04 - (part.start + a.times[n - 1][1]));
  }
}
console.log(
  JSON.stringify({
    split,
    ayat,
    missingOrRestart: missing,
    engineFirstWordStartMinusModel: {n: firstDiff.length, p1: q(firstDiff, 0.01), p10: q(firstDiff, 0.1), p50: q(firstDiff, 0.5), p90: q(firstDiff, 0.9), p99: q(firstDiff, 0.99)},
    engineLastWordEndMinusModel: {n: lastDiff.length, p1: q(lastDiff, 0.01), p10: q(lastDiff, 0.1), p50: q(lastDiff, 0.5), p90: q(lastDiff, 0.9), p99: q(lastDiff, 0.99)},
  }),
);
