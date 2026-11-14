/* eslint-env node, es2020 */
// Every mark a policy leaves on correct recitation, with the engine's and the
// judge's view of it. Dev only.
//   node judge/pool_marks.mjs --rows <dir> --policy file.json [--suite pool|w1_control] [--split dev]
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
process.env.WORD_MARKS ??= path.join(HERE, 'wordMarks.judge.ts');
const {replay} = await import('../natural/replay.mjs');
const {applyPolicy, DEFAULTS, answer} = await import('./policy.mjs');
const MAN = path.join(HERE, '../.out/natural/manifests');
const J = path.join(HERE, '../.out/natural/judge');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const split = args.split ?? 'dev';
const suite = args.suite ?? 'pool';
const P = {...DEFAULTS, ...JSON.parse(fs.readFileSync(args.policy, 'utf8'))};
const engineWords = JSON.parse(fs.readFileSync(path.join(MAN, 'engine_words.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(J, 'index.json'), 'utf8'));
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
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.json')) continue;
  const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const t = run.clip.truth;
  if (split !== 'all' && (t.reciterSplit !== split || (t.pairSplit ?? t.blockSplit ?? split) !== split)) continue;
  const rows = rowsOf.get(run.clip.id) ?? new Map();
  const applied = applyPolicy(run, rows, P, wordCount);
  const base = replay(run, {mode: 'app', wordCount: count}).visible;
  const pol = replay(applied.run, {mode: 'app', wordCount: count}).visible;
  const restart = new Set((t.ayat ?? []).filter(x => x.restarts > 0).map(x => x.key));
  for (const [id, m] of pol) {
    const [s, a, w] = id.split(':').map(Number);
    const key = `${s}:${a}`;
    const toks = index.ayat[key]?.map(x => x.l) ?? [];
    const mine = [...rows.values()].filter(r => r.id === id);
    console.log(
      `${base.has(id) ? 'kept ' : 'ADDED'} ${id}/${toks.length} kind=${m.kind} restart=${restart.has(key)} since=${m.since} word=${toks[w]} | ${mine
        .map(r => `t=${r.t} ${r.state} gop=${r.gop} d=${r.distance} slice=${r.slice} exp=${r.r.expected} mut=${r.r.mut[0]?.a}:${r.r.mut[0]?.s} near=${r.r.near[0]?.a}:${r.r.near[0]?.s} says=${answer(r, P)}`)
        .join(' ; ')}`,
    );
  }
  for (const [id] of base) {
    if (pol.has(id)) continue;
    const mine = [...rows.values()].filter(r => r.id === id);
    const [s, a] = id.split(':').map(Number);
    console.log(`GONE  ${id} restart=${restart.has(`${s}:${a}`)} | ${mine.map(r => `t=${r.t} ${r.state} exp=${r.r.expected} says=${answer(r, P)}`).join(' ; ')}`);
  }
}
