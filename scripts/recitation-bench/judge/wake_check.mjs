/* eslint-env node, es2020 */
// On changed words of W1: would any engine verdict on the word wake the judge, and
// which? Engine output, for the engine-side trigger only.
//   node judge/wake_check.mjs [--split dev]
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const RUNS = path.join(HERE, '../.out/natural/baseline/runs/w1');
const at = process.argv.indexOf('--split');
const split = at > 0 ? process.argv[at + 1] : 'dev';
const SPLITS = {'15:7': 0, '27:20': 3, '36:22': 0};
void SPLITS;
const out = {};
const add = (g, k) => {
  const o = (out[g] ??= {events: 0});
  o[k] = (o[k] ?? 0) + 1;
};
for (const f of fs.readdirSync(RUNS).sort()) {
  if (!f.endsWith('.json')) continue;
  const run = JSON.parse(fs.readFileSync(path.join(RUNS, f), 'utf8'));
  const t = run.clip.truth;
  if (t.type !== 'changed') continue;
  if (split !== 'all' && (t.reciterSplit !== split || t.pairSplit !== split)) continue;
  const id = `${t.expectedKey}:${t.target}`;
  const groups = [t.position, ...(t.close ? [`close ${t.position}`, 'close'] : []), 'all'];
  const live = run.vchanges.filter(c => !c.stop && c.id === id && c.to !== 'pending');
  const fl = (run.flush?.verdicts ?? []).find(v => v.id === id && v.newly && v.state !== 'pending');
  const seq = [...live.map(c => ({state: c.to, d: c.d, src: 'live'})), ...(fl ? [{state: fl.state, d: fl.d, src: 'flush'}] : [])];
  let klass = 'no verdict';
  const has = f => seq.some(f);
  if (has(v => v.state === 'wrong' || v.state === 'skipped')) klass = 'wrong or skipped';
  else if (has(v => v.state === 'unsure')) klass = 'unsure';
  else if (has(v => v.state === 'ok' && typeof v.d?.gop === 'number' && v.d.gop <= -3)) klass = 'ok gop<=-3';
  else if (has(v => v.state === 'ok' && typeof v.d?.gop === 'number' && v.d.gop <= -1.5)) klass = 'ok gop<=-1.5';
  else if (has(v => v.state === 'ok' && typeof v.d?.gop !== 'number' && v.d?.distance > 0)) klass = 'ok no gop distance>0';
  else if (has(v => v.state === 'ok')) klass = 'ok otherwise';
  for (const g of groups) {
    add(g, 'events');
    add(g, klass);
  }
}
for (const [g, o] of Object.entries(out).sort()) console.log(g, JSON.stringify(o));
