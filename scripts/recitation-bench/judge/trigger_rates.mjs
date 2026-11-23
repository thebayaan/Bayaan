/* eslint-env node, es2020 */
// How often the engine's verdicts would wake the second judge on correct
// recitation: verdict changes on the pool's dev runs, per minute, by place and
// kind. Engine output, so anything tuned from it stays on the engine's side.
//
//   node judge/trigger_rates.mjs [--split dev|test|all]
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const RUNS = path.join(HERE, '../.out/natural/baseline/runs');
const words = JSON.parse(fs.readFileSync(path.join(HERE, '../.out/natural/manifests/engine_words.json'), 'utf8'));
const at = process.argv.indexOf('--split');
const split = at > 0 ? process.argv[at + 1] : 'dev';

function* runs(suite) {
  const dir = path.join(RUNS, suite);
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const t = r.clip.truth;
    if (split !== 'all' && (t.reciterSplit !== split || (t.blockSplit ?? t.pairSplit ?? split) !== split)) continue;
    yield r;
  }
}
const place = id => {
  const [s, a, w] = id.split(':').map(Number);
  const n = words[`${s}:${a}`];
  return w === 0 ? 'first' : w === n - 1 ? 'last' : 'interior';
};
const bump = (o, k, n = 1) => {
  o[k] = (o[k] ?? 0) + n;
};
let seconds = 0;
let nRuns = 0;
let wordCount = 0;
const changes = {};
const firstVerdict = {};
const wordsWith = {};
for (const r of runs('pool')) {
  nRuns += 1;
  seconds += r.summary.seconds;
  wordCount += r.clip.truth.words;
  const seen = new Set();
  const everHas = new Map();
  for (const c of r.vchanges) {
    if (c.stop || c.to === 'pending') continue;
    const p = place(c.id);
    bump(changes, `${p} ${c.to}`);
    if (!seen.has(c.id)) {
      seen.add(c.id);
      bump(firstVerdict, `${p} ${c.to}`);
    }
    const gop = c.d?.gop;
    const dist = c.d?.distance;
    const classes = [];
    if (c.to === 'wrong') classes.push('wrong');
    if (c.to === 'skipped') classes.push('skipped');
    if (c.to === 'unsure') classes.push('unsure');
    if (c.to === 'ok' && typeof gop === 'number' && gop <= -3) classes.push('ok gop<=-3');
    if (c.to === 'ok' && typeof gop === 'number' && gop <= -1.5) classes.push('ok gop<=-1.5');
    if (c.to === 'ok' && typeof gop !== 'number' && dist > 0) classes.push('ok no gop, distance>0');
    if (c.to !== 'ok' && dist >= 0.3) classes.push('bad or unsure, distance>=0.3');
    for (const k of classes) {
      const key = `${p} ${k}`;
      if (!everHas.has(key)) everHas.set(key, new Set());
      everHas.get(key).add(c.id);
    }
  }
  for (const [k, set] of everHas) bump(wordsWith, k, set.size);
}
const minutes = seconds / 60;
const fmt = o =>
  Object.fromEntries(
    Object.entries(o)
      .sort()
      .map(([k, v]) => [k, `${v} (${(v / minutes).toFixed(3)}/min, ${((1000 * v) / wordCount).toFixed(2)}/1000w)`]),
  );
console.log(JSON.stringify({split, runs: nRuns, minutes: +minutes.toFixed(1), words: wordCount, changes: fmt(changes), firstVerdict: fmt(firstVerdict), wordsWith: fmt(wordsWith)}, null, 1));
