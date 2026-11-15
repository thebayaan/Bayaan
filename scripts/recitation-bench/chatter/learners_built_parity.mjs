/* eslint-env node, es2020 */
// The parity gate. Compares a suite of this job with the frozen QuranMB results, take by take:
// the chains in .out/second-look/marks/quranmb.jsonl and the judge's rows behind them, on the
// listed takes; then the labelled counts, computed as tables.mjs computes its QuranMB table,
// against RULE.md's table as .out/second-look/tables.json holds it. Loads no model. Writes
// .out/chatter/learners_built/parity.<suite>.json.
//   node chatter/learners_built_parity.mjs lb_parity
import fs from 'node:fs';
import path from 'node:path';
import {pigeonhole, fmtP} from '../../second-look/stats.mjs';
import {labelOf} from '../../second-look/quranmb_labels.mjs';
import {BENCH, OUT, rowFile, suiteRunIds} from './learners_built_lib.mjs';
import {diffTake, labelTable, compareTables, readRowsText} from './learners_built_stats.mjs';

const suite = process.argv[2] ?? 'lb_parity';
const FROZEN = path.join(BENCH, '.out/second-look');
const list = new Set(suiteRunIds(suite));
const jsonl = f =>
  fs
    .readFileSync(f, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l));
const frozenAll = jsonl(path.join(FROZEN, 'marks/quranmb.jsonl'));
const frozen = new Map(frozenAll.filter(r => list.has(r.id)).map(r => [r.id, r]));
const mine = new Map(jsonl(path.join(OUT, 'marks', `${suite}.jsonl`)).map(r => [r.id, r]));
const out = {suite, takes: list.size, frozenTakes: frozen.size, mineTakes: mine.size};

// Take by take, every chain.
const CHAINS = Object.keys(frozenAll[0].cfg);
const byChain = Object.fromEntries(CHAINS.map(c => [c, 0]));
let takesDiffering = 0;
let otherFields = 0;
const examples = [];
for (const id of list) {
  const d = diffTake(frozen.get(id), mine.get(id), CHAINS);
  for (const c of d.chains) byChain[c] += 1;
  if (d.chains.length) takesDiffering += 1;
  otherFields += d.fields.length;
  if ((d.chains.length || d.fields.length) && examples.length < 8)
    examples.push({id, chains: d.chains.slice(0, 6), fields: d.fields});
}
out.chains = CHAINS.length;
out.chainsDiffering = Object.entries(byChain).filter(([, n]) => n).length;
out.takesDiffering = takesDiffering;
out.byChain = Object.fromEntries(Object.entries(byChain).filter(([, n]) => n));
out.otherFieldsDiffering = otherFields;
out.examples = examples;

// The judge's rows.
out.rows = {};
for (const [hold, tag] of [[0.48, 'h48'], [0, 'h0']]) {
  const a = readRowsText(fs.readFileSync(path.join(FROZEN, 'rows', `quranmb.${tag}.jsonl`), 'utf8'), list);
  const b = readRowsText(fs.readFileSync(rowFile(suite, hold), 'utf8'), list);
  let differ = 0;
  let onlyFrozen = 0;
  let onlyMine = 0;
  let sliceDiffer = 0;
  let answerScoreDiffer = 0;
  let worst = 0;
  for (const [k, x] of a) {
    const y = b.get(k);
    if (!y) {
      onlyFrozen += 1;
      continue;
    }
    if (JSON.stringify(x.slice) !== JSON.stringify(y.slice)) sliceDiffer += 1;
    worst = Math.max(worst, Math.abs(x.r.expected - y.r.expected));
    if (JSON.stringify(x.r) !== JSON.stringify(y.r)) answerScoreDiffer += 1;
    const {suite: _s1, ...p} = x;
    const {suite: _s2, ...q} = y;
    if (JSON.stringify(p) !== JSON.stringify(q)) differ += 1;
  }
  for (const k of b.keys()) if (!a.has(k)) onlyMine += 1;
  out.rows[tag] = {
    frozen: a.size,
    mine: b.size,
    differ,
    onlyFrozen,
    onlyMine,
    sliceDiffer,
    answerScoreDiffer,
    worstExpectedDifference: +worst.toFixed(4),
  };
}

// Labelled counts, as tables.mjs computes them.
const takes = new Map(
  JSON.parse(
    fs.readFileSync(path.join(BENCH, '.out/takes/quranmb/manifest.json'), 'utf8'),
  ).map(t => [t.id, t]),
);
const tables = JSON.parse(fs.readFileSync(path.join(FROZEN, 'tables.json'), 'utf8'));
const label = (id, m) => labelOf(takes.get(id).segments, m.id, m.s);
const opts = {label, chains: CHAINS, pigeonhole, fmtP};
const copyOnFrozen = labelTable(frozenAll, opts);
const onList = labelTable([...frozen.values()], opts);
const onMine = labelTable([...mine.values()], opts);
out.tableCopyAgainstRule = compareTables(tables.quranmb.cfg, copyOnFrozen, true);
out.mineAgainstFrozenOnList = compareTables(onList, onMine, true);
out.mineAgainstRuleKept = compareTables(tables.quranmb.cfg, onMine, false);
out.addedOffList = {};
for (const c of CHAINS) {
  const a = tables.quranmb.cfg[c].added;
  const b = onMine[c].added;
  const gone = {};
  for (const k of Object.keys(a)) if ((b[k] ?? 0) !== a[k]) gone[k] = a[k] - (b[k] ?? 0);
  if (Object.keys(gone).length) out.addedOffList[c] = gone;
}
out.requested = Object.fromEntries(
  ['J.none', 'J.P1', 'S1.P3', 'S2.P4', 'S1h0.P3', 'N1.P3', 'S1.P3s'].map(c => [
    c,
    {mine: onMine[c], rule: tables.quranmb.cfg[c]},
  ]),
);
fs.writeFileSync(path.join(OUT, `parity.${suite}.json`), JSON.stringify(out, null, 1));
const {requested: _r, examples: ex, ...short} = out;
console.log(JSON.stringify(short, null, 1));
console.log(JSON.stringify(ex.slice(0, 3)));
