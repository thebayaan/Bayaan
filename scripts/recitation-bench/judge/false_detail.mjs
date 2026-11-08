/* eslint-env node, es2020 */
// Marks the judge added on words that were said correctly, with what it heard. Dev.
//   node judge/false_detail.mjs --rows <dir> --policy file.json --suite w1|pool|w1_control [--split dev]
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
process.env.WORD_MARKS ??= path.join(HERE, 'wordMarks.judge.ts');
const {replay} = await import('../natural/replay.mjs');
const {nearSet} = await import('../natural/score.mjs');
const {applyPolicy, DEFAULTS} = await import('./policy.mjs');
const MAN = path.join(HERE, '../.out/natural/manifests');
const J = path.join(HERE, '../.out/natural/judge');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const split = args.split ?? 'dev';
const suite = args.suite ?? 'w1';
const P = {...DEFAULTS, ...JSON.parse(fs.readFileSync(args.policy, 'utf8'))};
const engineWords = JSON.parse(fs.readFileSync(path.join(MAN, 'engine_words.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(J, 'index.json'), 'utf8'));
const words = key => engineWords[key];
const hasKey = key => key in engineWords;
const wordCount = (s, a) => engineWords[`${s}:${a}`];
const count = (s, a) => wordCount(s, a) ?? undefined;
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
const dir = path.join(HERE, '../.out/natural/baseline/runs', suite);
let n = 0;
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.json')) continue;
  const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const t = run.clip.truth;
  if (split !== 'all' && (t.reciterSplit !== split || (t.pairSplit ?? t.blockSplit ?? split) !== split)) continue;
  const rows = rowsOf.get(run.clip.id) ?? new Map();
  const applied = applyPolicy(run, rows, P, wordCount);
  const near = t.type && ['changed', 'skipped', 'added', 'trap'].includes(t.type) ? nearSet(t, words, hasKey) : new Set();
  if (t.type && !['changed', 'skipped', 'added', 'trap', 'pool', 'control'].includes(t.type)) continue;
  const base = replay(run, {mode: 'carry', wordCount: count}).visible;
  const pol = replay(applied.run, {mode: 'carry', wordCount: count}).visible;
  for (const [id, m] of pol) {
    if (near.has(id) || base.has(id)) continue;
    const mine = [...rows.values()].filter(r => r.id === id);
    const [s, a, w] = id.split(':').map(Number);
    const key = `${s}:${a}`;
    const toks = index.ayat[key]?.map(x => x.l) ?? [];
    const j = index.splits[key] !== undefined && w > index.splits[key] ? w - 1 : w;
    n += 1;
    console.log(
      `${run.clip.id.replace(/__[^_]*(_[^_]*)*?_(mp3quran|way2quran|tvquran)/, '')} ${t.type} ${t.pair ?? ''} target ${t.target ?? ''} mark ${id} since ${m.since} word=${toks[j]} ctx=${toks.slice(Math.max(0, j - 2), j).join(' ')} | ${mine
        .map(r => `t=${r.t} ${r.state} gop=${r.gop} d=${r.distance} slice=${r.slice} exp=${r.r.expected} mut=${r.r.mut[0]?.a}:${r.r.mut[0]?.s} near=${r.r.near[0]?.a}:${r.r.near[0]?.s}`)
        .join(' ; ')}`,
    );
    if (n > Number(args.max ?? 60)) process.exit(0);
  }
}
console.log('total', n);
