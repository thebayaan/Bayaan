/* eslint-env node, es2020 */
// Why changed words are still missed under a policy, and which unchanged words get
// marked, by place and engine verdict. Dev only.
//   node judge/miss_reasons.mjs --rows <dir> --policy file.json [--split dev]
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
process.env.WORD_MARKS ??= path.join(HERE, 'wordMarks.judge.ts');
const {scoreEvent} = await import('../natural/score.mjs');
const {applyPolicy, DEFAULTS, margins} = await import('./policy.mjs');
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
const tally = {};
const bump = (g, k) => {
  const o = (tally[g] ??= {});
  o[k] = (o[k] ?? 0) + 1;
};
const falseMarks = {};
const missDetail = [];
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.json')) continue;
  const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const t = run.clip.truth;
  if (split !== 'all' && (t.reciterSplit !== split || (t.pairSplit ?? split) !== split)) continue;
  const rows = rowsOf.get(run.clip.id) ?? new Map();
  const applied = applyPolicy(run, rows, P, wordCount);
  const row = scoreEvent(applied.run, words, hasKey);
  if (t.type === 'changed') {
    const g = `${t.position}${t.close ? ' close' : ''}`;
    bump(g, 'events');
    if (!row.caught.carry) {
      const id = `${t.expectedKey}:${t.target}`;
      const mine = [...rows.values()].filter(r => r.id === id);
      let kind;
      if (!mine.length) kind = `not woken: ${row.miss}`;
      else {
        const best = Math.max(...mine.map(r => margins(r).mut));
        kind = best >= P.mut ? `judged but stopped: ${row.reasons.carry.join(',') || row.miss}` : `margin under ${P.mut}`;
      }
      bump(g, kind);
      if (missDetail.length < 400) {
        missDetail.push({pair: t.pair, reciter: t.reciter, g, kind, verdicts: (row.verdicts[id] ?? []).map(v => [v.t, v.state, v.d?.gop ?? null, v.d?.distance ?? null]), judge: mine.map(r => [r.t, r.state, r.r.expected, r.r.mut[0]?.a, r.r.mut[0]?.s])});
      }
    } else {
      bump(g, 'caught');
    }
  }
  if (['changed', 'skipped', 'added'].includes(t.type)) {
    const near = new Set();
    const key = t.expectedKey;
    const add = w => near.add(`${key}:${w}`);
    if (t.type === 'added') {
      add(t.target - 1);
      add(t.target);
    } else {
      add(t.target - 1);
      add(t.target);
      add(t.target + 1);
    }
    for (const m of row.marks.carry) {
      if (near.has(m.id)) continue;
      const [, , w] = m.id.split(':').map(Number);
      const gap = w - t.target;
      const judgedHere = applied.changed.some(c => c.id === m.id && c.to === 'wrong');
      const k = `${t.type} gap ${gap > 3 ? '>3' : gap < -3 ? '<-3' : gap} ${judgedHere ? 'judged' : 'engine'}`;
      falseMarks[k] = (falseMarks[k] ?? 0) + 1;
    }
  }
}
console.log(JSON.stringify(tally, null, 1));
console.log('unchanged words marked, by distance from the event:', JSON.stringify(falseMarks, null, 1));
if (args.out) fs.writeFileSync(args.out, JSON.stringify(missDetail, null, 0));
