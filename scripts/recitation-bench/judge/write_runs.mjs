/* eslint-env node, es2020 */
// Writes a policy's rewritten runs so natural/score.mjs can score them with its
// intervals. A run the policy leaves alone is linked to the baseline file.
//
//   node judge/write_runs.mjs --rows <dir of e2e jsonl> --policy file.json --out <runs dir>
//     [--suites w1,w1_control,pool,w5,learners] [--split dev|test|all]
//   WORD_MARKS=judge/wordMarks.judge.ts node natural/score.mjs --runs <runs dir> --split dev --out <dir>
import fs from 'node:fs';
import path from 'node:path';
import {applyPolicy, DEFAULTS} from './policy.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const MAN = path.join(HERE, '../.out/natural/manifests');
const BASE = path.join(HERE, '../.out/natural/baseline/runs');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const P = {...DEFAULTS, ...JSON.parse(fs.readFileSync(args.policy, 'utf8'))};
const suites = (args.suites ?? 'w1,w1_control,pool,w5,learners').split(',');
const split = args.split ?? 'all';
const engineWords = JSON.parse(fs.readFileSync(path.join(MAN, 'engine_words.json'), 'utf8'));
const wordCount = (s, a) => engineWords[`${s}:${a}`];

const rowsOf = new Map();
for (const f of fs.readdirSync(args.rows)) {
  if (!f.endsWith('.jsonl')) continue;
  for (const line of fs.readFileSync(path.join(args.rows, f), 'utf8').split('\n')) {
    if (!line) continue;
    const r = JSON.parse(line);
    let m = rowsOf.get(r.run);
    if (!m) rowsOf.set(r.run, (m = new Map()));
    m.set(`${r.id}|${r.t}|${r.src}`, r);
  }
}
const totals = {};
for (const suite of suites) {
  const from = path.join(BASE, suite);
  const to = path.join(args.out, suite);
  fs.mkdirSync(to, {recursive: true});
  let wrote = 0;
  let linked = 0;
  for (const f of fs.readdirSync(from)) {
    if (!f.endsWith('.json')) continue;
    const src = path.join(from, f);
    const dst = path.join(to, f);
    fs.rmSync(dst, {force: true});
    const run = JSON.parse(fs.readFileSync(src, 'utf8'));
    const t = run.clip.truth;
    const inSplit = split === 'all' || (t.reciterSplit === split && (t.pairSplit ?? t.blockSplit ?? split) === split);
    if (!inSplit) continue;
    const {run: rewritten, changed} = applyPolicy(run, rowsOf.get(run.clip.id) ?? new Map(), P, wordCount);
    if (changed.length) {
      fs.writeFileSync(dst, JSON.stringify(rewritten));
      wrote += 1;
    } else {
      fs.symlinkSync(src, dst);
      linked += 1;
    }
  }
  totals[suite] = {wrote, linked};
}
console.log(JSON.stringify(totals));
