/* eslint-env node, es2020 */
// Point estimates of what a judge policy does to the marks, through the app's own
// rules, on the saved runs of one split. For sweeping; final numbers with
// intervals come from natural/score.mjs on runs that write_runs.mjs rewrites.
//
//   node judge/sweep.mjs --rows <dir of e2e jsonl> --split dev --policies file.json [--out out.json]
//
// policies: [{"name": "...", ...constants of policy.mjs}]. A policy named
// "baseline" leaves every verdict alone.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
process.env.WORD_MARKS ??= path.join(HERE, 'wordMarks.judge.ts');
const {replay} = await import('../natural/replay.mjs');
const {scoreEvent} = await import('../natural/score.mjs');
const {applyPolicy, DEFAULTS} = await import('./policy.mjs');

const MAN = path.join(HERE, '../.out/natural/manifests');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const split = args.split ?? 'dev';
const runsRoot = args.runs ?? path.join(HERE, '../.out/natural/baseline/runs');
const engineWords = JSON.parse(fs.readFileSync(path.join(MAN, 'engine_words.json'), 'utf8'));
const words = key => engineWords[key];
const hasKey = key => key in engineWords;
const wordCount = (s, a) => engineWords[`${s}:${a}`];

export function loadRows(dir) {
  const rows = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.jsonl')) continue;
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!line) continue;
      const r = JSON.parse(line);
      let m = rows.get(r.run);
      if (!m) rows.set(r.run, (m = new Map()));
      m.set(`${r.id}|${r.t}|${r.src}`, r);
    }
  }
  return rows;
}

function loadRuns(suite) {
  const dir = path.join(runsRoot, suite);
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const t = run.clip.truth;
    if (split !== 'all' && (t.reciterSplit !== split || (t.pairSplit ?? t.blockSplit ?? split) !== split)) continue;
    out.push(run);
  }
  return out;
}

const mean = (rows, f) => (rows.length ? rows.reduce((x, r) => x + (f(r) ? 1 : 0), 0) / rows.length : null);
const pct = x => (x === null ? null : +(100 * x).toFixed(1));

function evaluate(sets, rowsOf, P) {
  const apply = run => {
    if (P.name === 'baseline') return {run, woke: 0, changed: []};
    return applyPolicy(run, rowsOf.get(run.clip.id) ?? new Map(), P, wordCount);
  };
  const ev = sets.w1.map(run => scoreEvent(apply(run).run, words, hasKey));
  const changed = ev.filter(r => r.type === 'changed');
  const group = {
    all: changed,
    interior: changed.filter(r => r.position === 'interior'),
    last: changed.filter(r => r.position === 'last'),
    first: changed.filter(r => r.position === 'first'),
    close: changed.filter(r => r.close),
    closeInterior: changed.filter(r => r.close && r.position === 'interior'),
    closeLast: changed.filter(r => r.close && r.position === 'last'),
    closeFirst: changed.filter(r => r.close && r.position === 'first'),
  };
  const catches = {};
  for (const [name, rows] of Object.entries(group)) {
    catches[name] = {
      n: rows.length,
      pairs: new Set(rows.map(r => r.pair)).size,
      app: pct(mean(rows, r => r.caught.app)),
      flush: pct(mean(rows, r => r.caught.flush)),
      carry: pct(mean(rows, r => r.caught.carry)),
      exactCarry: pct(mean(rows, r => r.exact.carry)),
    };
  }
  const unchanged = ev.filter(r => ['changed', 'skipped', 'added'].includes(r.type));
  const unchangedWords = unchanged.reduce((x, r) => x + r.unchangedWords, 0);
  const sumFalse = (rows, m) => rows.reduce((x, r) => x + r.falseMarks[m], 0);
  const traps = ev.filter(r => r.type === 'trap');
  const skipped = ev.filter(r => r.type === 'skipped' && !r.short);
  const control = sets.control.map(run => scoreEvent(apply(run).run, words, hasKey));
  const controlWords = control.reduce((x, r) => x + r.words, 0);
  const sumMarks = (rows, m) => rows.reduce((x, r) => x + r.marks[m].length, 0);
  let poolApp = 0;
  let poolCarry = 0;
  let poolWords = 0;
  let poolSeconds = 0;
  let woke = 0;
  const poolChanged = {};
  for (const run of sets.pool) {
    const a = apply(run);
    woke += a.woke;
    for (const c of a.changed) {
      const k = `${c.from}>${c.to}`;
      poolChanged[k] = (poolChanged[k] ?? 0) + 1;
    }
    const count = (s, x) => wordCount(s, x) ?? undefined;
    poolApp += replay(a.run, {mode: 'app', wordCount: count}).visible.size;
    poolCarry += replay(a.run, {mode: 'carry', wordCount: count}).visible.size;
    poolWords += run.clip.truth.words;
    poolSeconds += run.summary.seconds;
  }
  return {
    name: P.name,
    catches,
    skippedWord: {n: skipped.length, app: pct(mean(skipped, r => r.caught.app)), carry: pct(mean(skipped, r => r.caught.carry))},
    w1Unchanged: {
      words: unchangedWords,
      app: sumFalse(unchanged, 'app'),
      carry: sumFalse(unchanged, 'carry'),
      per1000App: +((1000 * sumFalse(unchanged, 'app')) / Math.max(1, unchangedWords)).toFixed(2),
      per1000Carry: +((1000 * sumFalse(unchanged, 'carry')) / Math.max(1, unchangedWords)).toFixed(2),
    },
    traps: {runs: traps.length, app: sumFalse(traps, 'app'), carry: sumFalse(traps, 'carry')},
    control: {
      runs: control.length,
      words: controlWords,
      app: sumMarks(control, 'app'),
      carry: sumMarks(control, 'carry'),
      per1000Carry: +((1000 * sumMarks(control, 'carry')) / Math.max(1, controlWords)).toFixed(2),
    },
    pool: {
      words: poolWords,
      minutes: +(poolSeconds / 60).toFixed(1),
      app: poolApp,
      carry: poolCarry,
      per1000App: +((1000 * poolApp) / Math.max(1, poolWords)).toFixed(2),
      per1000Carry: +((1000 * poolCarry) / Math.max(1, poolWords)).toFixed(2),
      wakePerMinute: +(woke / Math.max(1e-9, poolSeconds / 60)).toFixed(2),
      changed: poolChanged,
    },
  };
}

const isMain = process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  const rowsOf = loadRows(args.rows);
  const sets = {w1: loadRuns('w1'), control: loadRuns('w1_control'), pool: loadRuns('pool')};
  console.error(`runs: w1 ${sets.w1.length}, control ${sets.control.length}, pool ${sets.pool.length}; rows for ${rowsOf.size} runs`);
  const policies = JSON.parse(fs.readFileSync(args.policies, 'utf8'));
  const results = [];
  for (const p of policies) {
    const r = evaluate(sets, rowsOf, {...DEFAULTS, ...p});
    results.push(r);
    const c = r.catches;
    console.log(
      `${p.name}: all ${c.all.carry} (app ${c.all.app}) interior ${c.interior.carry} (app ${c.interior.app}) last ${c.last.carry} first ${c.first.carry} close ${c.close.carry} | pool ${r.pool.app}/${r.pool.carry} in ${r.pool.words} (${r.pool.per1000App}/${r.pool.per1000Carry}) control ${r.control.app}/${r.control.carry} unchanged ${r.w1Unchanged.app}/${r.w1Unchanged.carry} traps ${r.traps.app}/${r.traps.carry} skipped ${r.skippedWord.carry} wake ${r.pool.wakePerMinute}/min`,
    );
    if (args.out) fs.writeFileSync(args.out, JSON.stringify(results, null, 1));
  }
}
