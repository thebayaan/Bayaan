/* eslint-env node, es2020 */
// How long after a word ends does the engine's first verdict on it arrive, and how
// long until the next word starts? For choosing how long the judge waits after a
// verdict. Engine output: timing only, nothing about margins.
//   node judge/verdict_delay.mjs [--split dev]
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
const SPLITS = {'15:7': 0, '27:20': 3, '36:22': 0};
const hafs = (key, e) => (SPLITS[key] !== undefined && e > SPLITS[key] ? e - 1 : e);
const delayInterior = [];
const delayLast = [];
const delayBad = [];
for (const f of fs.readdirSync(RUNS)) {
  if (!f.endsWith('.json')) continue;
  const run = JSON.parse(fs.readFileSync(path.join(RUNS, f), 'utf8'));
  const t = run.clip.truth;
  if (split !== 'all' && (t.reciterSplit !== split || t.blockSplit !== split)) continue;
  const first = new Map();
  for (const c of run.vchanges) {
    if (c.stop || c.to === 'pending' || first.has(c.id)) continue;
    first.set(c.id, c);
  }
  for (const part of run.partsAt) {
    const a = align.get(`${t.reciter}|${part.key}`);
    if (a.restarts) continue;
    const n = a.map.length;
    for (const [id, c] of first) {
      const [s, x, w] = id.split(':').map(Number);
      if (`${s}:${x}` !== part.key) continue;
      const j = hafs(part.key, w);
      if (j >= n) continue;
      const d = c.t - (part.start + a.times[j][1]);
      if (j === n - 1) delayLast.push(d);
      else delayInterior.push(d);
      if (c.to !== 'ok') delayBad.push(d);
    }
  }
}
const show = xs => ({n: xs.length, p10: q(xs, 0.1), p50: q(xs, 0.5), p90: q(xs, 0.9), p99: q(xs, 0.99)});
console.log(JSON.stringify({split, interior: show(delayInterior), last: show(delayLast), notOk: show(delayBad)}));
