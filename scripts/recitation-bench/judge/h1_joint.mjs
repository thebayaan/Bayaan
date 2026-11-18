/* eslint-env node, es2020 */
// The judge's rule with both conditions: an alternative beats the expected word by
// a margin, and fits the audio itself. Engine-free; sets the judge's own constants.
//   node judge/h1_joint.mjs <dir> [--cfg 0] [--boot 2000] [--rule mut,alt,near,nearAlt]
import fs from 'node:fs';
import path from 'node:path';
import {pigeonhole} from '../natural/score.mjs';

const dir = process.argv[2];
const argOf = (n, d) => {
  const at = process.argv.indexOf(n);
  return at > 0 ? process.argv[at + 1] : d;
};
const cfg = Number(argOf('--cfg', 0));
const boot = Number(argOf('--boot', 0));
function read(prefix) {
  const rows = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(prefix) || !f.endsWith('.jsonl')) continue;
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (line) rows.push(JSON.parse(line));
    }
  }
  return rows;
}
const changedRows = read('changed');
const poolRows = read('pool');
const controlRows = read('control');
const changed = changedRows.filter(r => r.suite === 'changed');
const traps = changedRows.filter(r => r.suite === 'trap');
const pos = r => r.position ?? (r.j === 0 ? 'first' : r.j === r.n - 1 ? 'last' : 'interior');
const fires = (x, thetaM, phiM, thetaN, phiN, skip) => {
  if (x.tooShort) return false;
  const m = x.mut.find(a => a.a !== skip);
  if (m && m.s - x.expected >= thetaM && m.s >= -phiM) return true;
  const n = x.near.find(a => a.a !== skip);
  if (n && n.s - x.expected >= thetaN && n.s >= -phiN) return true;
  return false;
};
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : 'na');
const per = (n, d) => (d ? ((1000 * n) / d).toFixed(2) : 'na');
const count = (rows, f) => rows.reduce((x, r) => x + (f(r) ? 1 : 0), 0);
const groups = {
  all: changed,
  interior: changed.filter(r => pos(r) === 'interior'),
  last: changed.filter(r => pos(r) === 'last'),
  first: changed.filter(r => pos(r) === 'first'),
  close: changed.filter(r => r.close),
};
const rules = [];
for (const m of [2, 3, 4, 5, 6, 8]) {
  for (const a of [1, 2, 3, 5, 10, 1000]) rules.push([m, a, 99, 0]);
}
for (const n of [6, 8, 10, 12, 15]) {
  for (const a of [1, 2, 3]) rules.push([4, 3, n, a]);
}
console.log(`config ${JSON.stringify(changedRows[0].r[cfg].cfg)}; changed ${changed.length}, pool ${poolRows.length} (restart ${count(poolRows, r => r.restart)}), control ${controlRows.length}, traps ${traps.length}`);
console.log('mut margin, alt fit, near margin, near fit | catch all/int/last/first/close | said out all/int/last/close | pool n per1000 (not in restart ayat n per1000) | control n per1000 | traps');
for (const [m, a, n, na] of rules) {
  const f = (r, skip) => fires(r.r[cfg], m, a, n, na, skip);
  const c = Object.values(groups).map(rows => pct(count(rows, r => f(r)), rows.length)).join('/');
  const out = ['all', 'interior', 'last', 'close'].map(k => pct(count(groups[k], r => f(r, r.said)), groups[k].length)).join('/');
  const fp = count(poolRows, r => f(r));
  const plain = poolRows.filter(r => !r.restart);
  const fq = count(plain, r => f(r));
  const fc = count(controlRows, r => f(r));
  console.log(
    `${m} ${a} ${n} ${na} | ${c} | ${out} | ${fp} ${per(fp, poolRows.length)} (${fq} ${per(fq, plain.length)}) | ${fc} ${per(fc, controlRows.length)} | ${count(traps, r => f(r))}`,
  );
}
if (boot) {
  const [m, a, n, na] = argOf('--rule', '4,3,99,0').split(',').map(Number);
  const f = r => fires(r.r[cfg], m, a, n, na);
  const fmt = r => `${(r.est * 100).toFixed(2)} [${(r.lo * 100).toFixed(2)}, ${(r.hi * 100).toFixed(2)}] of ${r.den}`;
  for (const [name, rows] of Object.entries(groups)) {
    console.log(`catch ${name}: ${fmt(pigeonhole(rows.map(r => ({a: r.unit, b: r.reciter, num: f(r) ? 1 : 0, den: 1})), boot))}`);
  }
  const rate = (rows, unit) => {
    const p = pigeonhole(rows.map(r => ({a: unit(r), b: r.reciter, num: f(r) ? 1 : 0, den: 1})), boot);
    return `${(p.est * 1000).toFixed(2)} [${(p.lo * 1000).toFixed(2)}, ${(p.hi * 1000).toFixed(2)}] per 1000 of ${p.den}`;
  };
  console.log(`judge alone on every correct word, pool: ${rate(poolRows, r => r.unit)}`);
  console.log(`judge alone on every correct word, control: ${rate(controlRows, r => r.unit)}`);
}
