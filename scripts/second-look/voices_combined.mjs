/* eslint-env node, es2020 */
// The combined engine with voices behind correct recitation: every mark is false. False
// junction fires and false added marks per 1,000 words per condition, and whether the engine's
// other verdicts moved. Loads no model. Writes .out/second-look/voices_combined.json.
//   node scripts/second-look/voices_combined.mjs
import fs from 'node:fs';
import path from 'node:path';
import {marksOf} from '../recitation-bench/added/lib.mjs';
import {junctionMark, quiet} from './chain.mjs';
import {BENCH, OUT, fileOf, suiteRunIds, wordCount} from './lib.mjs';
import {replay} from './replay_marks.mjs';
import {fmtR, pigeonhole} from './stats.mjs';

const CONDS = [
  'none_0',
  'one_ar_10',
  'crowd_10',
  'one_ar_5',
  'crowd_5',
  'rec_one_5',
];
const COMBINED = path.join(BENCH, '.out/chatter/runs/combined');
const SHIPPED = path.join(BENCH, '.out/chatter/runs/shipped');
const BASE = path.join(BENCH, '.out/natural/baseline/runs/pool');
const verdicts = run =>
  run.vchanges.filter(c => !c.stop).map(c => `${c.t}|${c.id}|${c.to}`);
/** Verdicts of the plain engine the combined engine did not also give at that moment. */
const lost = (plain, combined) => {
  const have = new Set(verdicts(combined));
  return verdicts(plain).filter(x => !have.has(x)).length;
};
const report = {};
for (const cond of CONDS) {
  const dir = path.join(COMBINED, cond);
  if (!fs.existsSync(dir)) continue;
  const want = suiteRunIds(`voices_${cond}`);
  const rows = [];
  let lostAgainstShipped = 0;
  let lostAgainstBaseline = 0;
  let verdictsTotal = 0;
  const fireList = [];
  const addedList = [];
  for (const id of want) {
    const f = path.join(dir, fileOf(id));
    if (!fs.existsSync(f)) continue;
    const run = JSON.parse(fs.readFileSync(f, 'utf8'));
    const shipped = JSON.parse(
      fs.readFileSync(path.join(SHIPPED, cond, fileOf(id)), 'utf8'),
    );
    verdictsTotal += verdicts(shipped).length;
    lostAgainstShipped += lost(shipped, run);
    if (cond === 'none_0')
      lostAgainstBaseline += lost(
        JSON.parse(fs.readFileSync(path.join(BASE, fileOf(id)), 'utf8')),
        run,
      );
    const q = quiet(run);
    const fires = q.vchanges.filter(
      c => !c.stop && c.d?.junctionMissing === true,
    );
    const {visible} = replay(q, {mode: 'app', wordCount});
    const junctionShown = [...visible.entries()].filter(([k, m]) =>
      junctionMark(q, k, m.shownAt),
    );
    const added = [
      ...marksOf({...run, truth: run.clip.truth, id}).values(),
    ].filter(m => m.mode === 'live');
    rows.push({
      a: run.clip.truth.block,
      b: run.clip.truth.reciter,
      words: run.clip.truth.words,
      seconds: run.summary.seconds,
      fires: fires.length,
      shown: junctionShown.length,
      added: added.length,
      red: visible.size,
    });
    for (const c of fires)
      fireList.push({run: id, id: c.id, t: c.t, llr: c.d.junction});
    for (const m of added)
      addedList.push({
        run: id,
        left: m.left,
        right: m.right,
        t: m.t,
        sounds: [...m.chars].length,
      });
  }
  const rate = k =>
    pigeonhole(
      rows.map(r => ({a: r.a, b: r.b, num: r[k], den: r.words})),
      2000,
    );
  report[cond] = {
    runs: rows.length,
    of: want.length,
    words: rows.reduce((x, r) => x + r.words, 0),
    minutes: +(rows.reduce((x, r) => x + r.seconds, 0) / 60).toFixed(1),
    verdictsInShipped: verdictsTotal,
    verdictsLostAgainstShipped: lostAgainstShipped,
    ...(cond === 'none_0'
      ? {verdictsLostAgainstBaseline: lostAgainstBaseline}
      : {}),
    junctionFires: rows.reduce((x, r) => x + r.fires, 0),
    junctionFiresPer1000: fmtR(rate('fires')),
    junctionMarksShown: rows.reduce((x, r) => x + r.shown, 0),
    junctionMarksPer1000: fmtR(rate('shown')),
    addedMarks: rows.reduce((x, r) => x + r.added, 0),
    addedPer1000: fmtR(rate('added')),
    redMarksNoJudge: rows.reduce((x, r) => x + r.red, 0),
    fires: fireList,
    added: addedList,
  };
}
// The pool's dev cell on the same engine, with no voices: the same two counts.
{
  const rows = [];
  const addedList = [];
  const fireList = [];
  for (const id of suiteRunIds('pool')) {
    const run = JSON.parse(
      fs.readFileSync(
        path.join(BENCH, '.out/natural/verify/runs/pool', fileOf(id)),
        'utf8',
      ),
    );
    const fires = quiet(run).vchanges.filter(
      c => !c.stop && c.d?.junctionMissing === true,
    );
    const added = [
      ...marksOf({...run, truth: run.clip.truth, id}).values(),
    ].filter(m => m.mode === 'live');
    rows.push({
      a: run.clip.truth.block,
      b: run.clip.truth.reciter,
      words: run.clip.truth.words,
      fires: fires.length,
      added: added.length,
    });
    for (const c of fires)
      fireList.push({run: id, id: c.id, t: c.t, llr: c.d.junction});
    for (const m of added)
      addedList.push({
        run: id,
        left: m.left,
        right: m.right,
        t: m.t,
        sounds: [...m.chars].length,
      });
  }
  const rate = k =>
    pigeonhole(
      rows.map(r => ({a: r.a, b: r.b, num: r[k], den: r.words})),
      2000,
    );
  report.pool_dev = {
    runs: rows.length,
    of: rows.length,
    words: rows.reduce((x, r) => x + r.words, 0),
    junctionFires: fireList.length,
    junctionFiresPer1000: fmtR(rate('fires')),
    addedMarks: addedList.length,
    addedPer1000: fmtR(rate('added')),
    fires: fireList,
    added: addedList,
  };
}
fs.writeFileSync(
  path.join(OUT, 'voices_combined.json'),
  JSON.stringify(report, null, 1),
);
for (const [c, r] of Object.entries(report)) {
  const {fires, added, ...rest} = r;
  console.log(c, JSON.stringify(rest));
}
