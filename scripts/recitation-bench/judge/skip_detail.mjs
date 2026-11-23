/* eslint-env node, es2020 */
// Skipped-word events a policy no longer catches, with what the judge said. Dev.
//   node judge/skip_detail.mjs --rows <dir> --policy file.json [--split dev]
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
process.env.WORD_MARKS ??= path.join(HERE, 'wordMarks.judge.ts');
const {scoreEvent} = await import('../natural/score.mjs');
const {applyPolicy, DEFAULTS, answer} = await import('./policy.mjs');
const MAN = path.join(HERE, '../.out/natural/manifests');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const split = args.split ?? 'dev';
const P = {...DEFAULTS, ...JSON.parse(fs.readFileSync(args.policy, 'utf8'))};
const engineWords = JSON.parse(fs.readFileSync(path.join(MAN, 'engine_words.json'), 'utf8'));
const words = key => engineWords[key];
const hasKey = key => key in engineWords;
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
const dir = path.join(HERE, '../.out/natural/baseline/runs/w1');
let n = 0;
let base = 0;
let pol = 0;
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.json') || !f.includes('__skipped__')) continue;
  const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const t = run.clip.truth;
  if (t.short) continue;
  if (split !== 'all' && (t.reciterSplit !== split || (t.pairSplit ?? split) !== split)) continue;
  const rows = rowsOf.get(run.clip.id) ?? new Map();
  const b = scoreEvent(run, words, hasKey);
  const p = scoreEvent(applyPolicy(run, rows, P, wordCount).run, words, hasKey);
  n += 1;
  if (b.caught.carry) base += 1;
  if (p.caught.carry) pol += 1;
  if (b.caught.carry && !p.caught.carry) {
    console.log(`${t.pair} target ${t.target} base marks ${b.marks.carry.map(m => m.id).join(',')} | ${[...rows.values()].map(r => `${r.id} t=${r.t} ${r.state} exp=${r.r.expected} nothing=${r.r.nothing} says=${answer(r, P)}`).join(' ; ')}`);
  }
}
console.log({n, base, pol});
