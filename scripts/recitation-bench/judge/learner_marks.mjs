/* eslint-env node, es2020 */
// Marks on the learner sets under a policy: what the labels say and what the judge
// heard. Report only: these sets are small and their clean clips partly unverified.
//   node judge/learner_marks.mjs --rows <dir> --policy file.json
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
const P = {...DEFAULTS, ...JSON.parse(fs.readFileSync(args.policy, 'utf8'))};
const engineWords = JSON.parse(fs.readFileSync(path.join(MAN, 'engine_words.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(J, 'index.json'), 'utf8'));
const wordCount = (s, a) => engineWords[`${s}:${a}`];
const count = (s, a) => wordCount(s, a) ?? undefined;
const rowsOf = new Map();
for (const f of fs.readdirSync(args.rows)) {
  if (!f.startsWith('learners') || !f.endsWith('.jsonl')) continue;
  for (const line of fs.readFileSync(path.join(args.rows, f), 'utf8').split('\n')) {
    if (!line) continue;
    const r = JSON.parse(line);
    let m = rowsOf.get(r.run);
    if (!m) rowsOf.set(r.run, (m = new Map()));
    m.set(`${r.id}|${r.t}|${r.src}`, r);
  }
}
const dir = path.join(HERE, '../.out/natural/baseline/runs/learners');
const totals = {};
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.json')) continue;
  const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const t = run.clip.truth;
  const rows = rowsOf.get(run.clip.id) ?? new Map();
  const applied = applyPolicy(run, rows, P, wordCount);
  for (const mode of ['app', 'carry']) {
    const base = replay(run, {mode, wordCount: count}).visible;
    const pol = replay(applied.run, {mode, wordCount: count}).visible;
    const key = `${t.dataset} ${mode} ${t.label}`;
    const o = (totals[key] ??= {clips: 0, base: 0, judge: 0, added: 0, removed: 0});
    o.clips += 1;
    o.base += base.size;
    o.judge += pol.size;
    for (const id of pol.keys()) if (!base.has(id)) o.added += 1;
    for (const id of base.keys()) if (!pol.has(id)) o.removed += 1;
    if (mode !== 'app') continue;
    for (const [id] of pol) {
      if (base.has(id)) continue;
      const mine = [...rows.values()].filter(r => r.id === id);
      const [s, a, w] = id.split(':').map(Number);
      const toks = index.ayat[`${s}:${a}`]?.map(x => x.l) ?? [];
      console.log(
        `ADDED ${t.dataset} label=${t.label} errors=${JSON.stringify((t.errors ?? []).map(e => [e.class, e.id]))} ${id} word=${toks[w]} | ${mine
          .map(r => `t=${r.t} ${r.state} gop=${r.gop} d=${r.distance} exp=${r.r.expected} mut=${r.r.mut[0]?.a}:${r.r.mut[0]?.s} near=${r.r.near[0]?.a}:${r.r.near[0]?.s} nothing=${r.r.nothing} says=${answer(r, P)}`)
          .join(' ; ')}`,
      );
    }
  }
}
console.log(JSON.stringify(totals, null, 1));
