/* eslint-env node, es2020 */
// Planted mistakes caught by the live check, by the follower's own marks (today's
// rules, replay2.mjs), and by either: the app runs both and writes one mark book.
//
//   node fix2/union_planted.mjs <tag>
//
// Reads .out/fix2/planted/<tag>/<name>.s<seed>.json with the kept follower run and
// truth of each file. A mark counts when it is on the word or a neighbour.
import fs from 'node:fs';
import path from 'node:path';
import {OUT, BENCH} from './common.mjs';

const tag = process.argv[2];
if (!tag) {
  console.error('usage: node fix2/union_planted.mjs <tag>');
  process.exit(2);
}
const {scoreRun} = await import(path.join(BENCH, 'replay2.mjs'));
const dir = path.join(OUT, 'planted');
const MISTAKES = [
  'wrong_word',
  'skip_word',
  'skip_first_word',
  'skip_last_word',
];
const T = {};
for (const f of fs.readdirSync(path.join(dir, tag)).sort()) {
  if (!/\.s\d+\.json$/.test(f)) {
    continue;
  }
  const stem = f.replace(/\.json$/, '');
  const sim = JSON.parse(fs.readFileSync(path.join(dir, tag, f), 'utf8'));
  const truth = JSON.parse(
    fs.readFileSync(path.join(dir, `${stem}.truth.json`), 'utf8'),
  );
  const run = JSON.parse(
    fs.readFileSync(path.join(dir, `${stem}.run.json`), 'utf8'),
  );
  for (const e of truth.events) {
    if (!MISTAKES.includes(e.type)) {
      continue;
    }
    if (e.type === 'skip_last_word' && e.word !== e.words) {
      continue;
    }
    const [s, a] = e.key.split(':').map(Number);
    const near = [-1, 0, 1].map(k => `${s}:${a}:${e.word - 1 + k}`);
    const live = sim.bad.some(b => near.includes(b.key));
    const follower = scoreRun(run, [e]).caught.length > 0;
    const t = (T[e.type] ??= {n: 0, live: 0, follower: 0, either: 0, both: 0});
    t.n += 1;
    t.live += live ? 1 : 0;
    t.follower += follower ? 1 : 0;
    t.either += live || follower ? 1 : 0;
    t.both += live && follower ? 1 : 0;
  }
}
const pct = (a, n) => `${a}/${n} ${((100 * a) / Math.max(1, n)).toFixed(0)}%`;
console.log('event              live        follower    either      both');
for (const type of MISTAKES) {
  const t = T[type];
  if (!t) {
    continue;
  }
  console.log(
    `${type.padEnd(18)} ${pct(t.live, t.n).padEnd(11)} ${pct(
      t.follower,
      t.n,
    ).padEnd(11)} ${pct(t.either, t.n).padEnd(11)} ${pct(t.both, t.n)}`,
  );
}
