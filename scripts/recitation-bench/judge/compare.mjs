/* eslint-env node, es2020 */
// One policy against the baseline on one split, through the app's own rules: what
// the judge gains and what it costs, with intervals that resample pairs (or
// passages) and reciters together. Marks that appear or disappear are counted
// per run, so a change in the rate can be read as words added and removed.
//
//   node judge/compare.mjs --rows <dir> --policy file.json --split dev|test
//     [--boot 2000] [--hold 0.48] [--inference 0.25] [--out out.json]
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
process.env.WORD_MARKS ??= path.join(HERE, 'wordMarks.judge.ts');
const {replay} = await import('../natural/replay.mjs');
const {scoreEvent, pigeonhole} = await import('../natural/score.mjs');
const {applyPolicy, DEFAULTS} = await import('./policy.mjs');

const MAN = path.join(HERE, '../.out/natural/manifests');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const split = args.split ?? 'dev';
const boot = Number(args.boot ?? 2000);
const hold = Number(args.hold ?? 0.48);
const inference = Number(args.inference ?? 0.25);
const P = {...DEFAULTS, ...JSON.parse(fs.readFileSync(args.policy, 'utf8'))};
const runsRoot = args.runs ?? path.join(HERE, '../.out/natural/baseline/runs');
const engineWords = JSON.parse(fs.readFileSync(path.join(MAN, 'engine_words.json'), 'utf8'));
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

function* runs(suite) {
  const dir = path.join(runsRoot, suite);
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const t = run.clip.truth;
    if (split !== 'all' && (t.reciterSplit !== split || (t.pairSplit ?? t.blockSplit ?? split) !== split)) continue;
    yield run;
  }
}

const pctCI = r => (r.est === null ? null : {est: +(100 * r.est).toFixed(1), lo: r.lo === null ? null : +(100 * r.lo).toFixed(1), hi: r.hi === null ? null : +(100 * r.hi).toFixed(1)});
const rateCI = r => (r.est === null ? null : {est: +(1000 * r.est).toFixed(2), lo: r.lo === null ? null : +(1000 * r.lo).toFixed(2), hi: r.hi === null ? null : +(1000 * r.hi).toFixed(2)});

const pairsBase = [];
for (const run of runs('w1')) {
  const applied = applyPolicy(run, rowsOf.get(run.clip.id) ?? new Map(), P, wordCount);
  const base = scoreEvent(run, words, hasKey);
  const pol = scoreEvent(applied.run, words, hasKey);
  // Latency with the judge's wait: a mark it touched cannot show before the slice
  // has been heard and scored.
  const t = run.clip.truth;
  let latency = null;
  const exact = base.expectedKey && t.target !== undefined && t.target !== null ? `${base.expectedKey}:${t.target}` : null;
  const next = t.stamps?.[String((t.target ?? -9) + 1)];
  const mark = pol.marks.app.find(m => m.id === exact);
  if (mark && next) {
    const judged = applied.changed.some(c => c.id === exact && c.to === 'wrong');
    const at = judged ? Math.max(mark.shownAt, mark.since + hold + inference) : mark.shownAt;
    latency = {judged, base: base.latency, with: +(at - next[0] / 1000).toFixed(3)};
  }
  pairsBase.push({base, pol, latency, changed: applied.changed});
}
const changedOnly = pairsBase.filter(x => x.base.type === 'changed');
const groups = {
  all: x => true,
  interior: x => x.base.position === 'interior',
  last: x => x.base.position === 'last',
  first: x => x.base.position === 'first',
  close: x => x.base.close,
  closeInterior: x => x.base.close && x.base.position === 'interior',
  closeLast: x => x.base.close && x.base.position === 'last',
  closeFirst: x => x.base.close && x.base.position === 'first',
  distance34: x => x.base.textDistance >= 3 && x.base.textDistance <= 4,
  distance5plus: x => x.base.textDistance >= 5,
};
const catchTable = {};
for (const [name, test] of Object.entries(groups)) {
  const rows = changedOnly.filter(test);
  const of = (side, mode, field = 'caught') =>
    pigeonhole(rows.map(x => ({a: x.base.pair, b: x.base.reciter, num: x[side][field][mode] ? 1 : 0, den: 1})), boot);
  const diff = mode =>
    pigeonhole(rows.map(x => ({a: x.base.pair, b: x.base.reciter, num: (x.pol.caught[mode] ? 1 : 0) - (x.base.caught[mode] ? 1 : 0), den: 1})), boot);
  catchTable[name] = {
    events: rows.length,
    pairs: new Set(rows.map(x => x.base.pair)).size,
    reciters: new Set(rows.map(x => x.base.reciter)).size,
    baseApp: pctCI(of('base', 'app')),
    baseCarry: pctCI(of('base', 'carry')),
    judgeApp: pctCI(of('pol', 'app')),
    judgeCarry: pctCI(of('pol', 'carry')),
    judgeCarryExact: pctCI(of('pol', 'carry', 'exact')),
    gainCarry: pctCI(diff('carry')),
    gained: rows.filter(x => x.pol.caught.carry && !x.base.caught.carry).length,
    lost: rows.filter(x => !x.pol.caught.carry && x.base.caught.carry).length,
  };
}

function falseTable(rows, unit, den, marksOf) {
  // rows: [{a, b, words, base: Set, pol: Set}]
  const of = side => pigeonhole(rows.map(r => ({a: unit(r), b: r.b, num: r[side].size, den: den(r)})), boot);
  const diff = pigeonhole(rows.map(r => ({a: unit(r), b: r.b, num: r.pol.size - r.base.size, den: den(r)})), boot);
  let removed = 0;
  let added = 0;
  for (const r of rows) {
    for (const id of r.base) if (!r.pol.has(id)) removed += 1;
    for (const id of r.pol) if (!r.base.has(id)) added += 1;
  }
  void marksOf;
  return {
    words: rows.reduce((x, r) => x + den(r), 0),
    baseMarks: rows.reduce((x, r) => x + r.base.size, 0),
    judgeMarks: rows.reduce((x, r) => x + r.pol.size, 0),
    removed,
    added,
    basePer1000: rateCI(of('base')),
    judgePer1000: rateCI(of('pol')),
    changePer1000: rateCI(diff),
  };
}

const unchangedRows = pairsBase.filter(x => ['changed', 'skipped', 'added'].includes(x.base.type));
const nonEvent = (row, mode) => new Set(row.marks[mode].filter(m => row.falseMarks[mode] > 0 && !isNear(row, m.id)).map(m => m.id));
function isNear(row, id) {
  // A mark next to the event's word belongs to the event.
  const [s, a, w] = id.split(':').map(Number);
  if (`${s}:${a}` !== row.expectedKey) return false;
  const target = row.target;
  if (target === null) return false;
  return row.type === 'added' ? w === target || w === target - 1 : Math.abs(w - target) <= 1;
}
const w1Unchanged = {};
for (const mode of ['app', 'carry']) {
  w1Unchanged[mode] = falseTable(
    unchangedRows.map(x => ({a: x.base.pair, b: x.base.reciter, words: x.base.unchangedWords, base: nonEvent(x.base, mode), pol: nonEvent(x.pol, mode)})),
    r => r.a,
    r => r.words,
  );
}
const trapRows = pairsBase.filter(x => x.base.type === 'trap');
const traps = {};
for (const mode of ['app', 'carry']) {
  traps[mode] = falseTable(
    trapRows.map(x => ({a: x.base.pair, b: x.base.reciter, words: x.base.words, base: new Set(x.base.marks[mode].map(m => m.id)), pol: new Set(x.pol.marks[mode].map(m => m.id))})),
    r => r.a,
    r => r.words,
  );
}
const eventSets = {};
for (const type of ['skipped', 'added']) {
  const rows = pairsBase.filter(x => x.base.type === type && !x.base.short);
  eventSets[type] = {
    events: rows.length,
    pairs: new Set(rows.map(x => x.base.pair)).size,
    baseCarry: pctCI(pigeonhole(rows.map(x => ({a: x.base.pair, b: x.base.reciter, num: x.base.caught.carry ? 1 : 0, den: 1})), boot)),
    judgeCarry: pctCI(pigeonhole(rows.map(x => ({a: x.base.pair, b: x.base.reciter, num: x.pol.caught.carry ? 1 : 0, den: 1})), boot)),
  };
}
const control = {};
{
  const rows = [];
  for (const run of runs('w1_control')) {
    const applied = applyPolicy(run, rowsOf.get(run.clip.id) ?? new Map(), P, wordCount);
    const base = scoreEvent(run, words, hasKey);
    const pol = scoreEvent(applied.run, words, hasKey);
    rows.push({base, pol});
  }
  for (const mode of ['app', 'carry']) {
    control[mode] = falseTable(
      rows.map(x => ({a: x.base.expectedKey, b: x.base.reciter, words: x.base.words, base: new Set(x.base.marks[mode].map(m => m.id)), pol: new Set(x.pol.marks[mode].map(m => m.id))})),
      r => r.a,
      r => r.words,
    );
  }
}
const pool = {};
let woke = 0;
let poolSeconds = 0;
const wakeBy = {};
const poolAdded = [];
const poolRemoved = [];
{
  const rows = [];
  for (const run of runs('pool')) {
    const applied = applyPolicy(run, rowsOf.get(run.clip.id) ?? new Map(), P, wordCount);
    woke += applied.woke;
    poolSeconds += run.summary.seconds;
    for (const c of applied.changed) {
      const k = `${c.from}>${c.to}`;
      wakeBy[k] = (wakeBy[k] ?? 0) + 1;
    }
    const t = run.clip.truth;
    const entry = {a: t.block, b: t.reciter, words: t.words};
    const restart = new Set(t.ayat.filter(x => x.restarts > 0).map(x => x.key));
    for (const mode of ['app', 'carry']) {
      const base = new Set(replay(run, {mode, wordCount: count}).visible.keys());
      const pol = new Set(replay(applied.run, {mode, wordCount: count}).visible.keys());
      entry[mode] = {a: t.block, b: t.reciter, words: t.words, base, pol};
      if (mode === 'app') {
        for (const id of pol) {
          if (!base.has(id)) {
            const [s, x] = id.split(':');
            poolAdded.push({run: run.clip.id, id, restart: restart.has(`${s}:${x}`), rows: [...(rowsOf.get(run.clip.id) ?? new Map()).values()].filter(r => r.id === id).map(r => ({t: r.t, state: r.state, expected: r.r.expected, mut: r.r.mut[0] ?? null, near: r.r.near[0] ?? null}))});
          }
        }
        for (const id of base) {
          if (!pol.has(id)) {
            const [s, x] = id.split(':');
            poolRemoved.push({run: run.clip.id, id, restart: restart.has(`${s}:${x}`)});
          }
        }
      }
    }
    rows.push(entry);
  }
  for (const mode of ['app', 'carry']) {
    pool[mode] = falseTable(rows.map(r => r[mode]), r => r.a, r => r.words);
  }
}
const latencies = pairsBase.map(x => x.latency).filter(Boolean);
const q = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3);
};
const baseLat = latencies.map(l => l.base).filter(x => x !== null);
const withLat = latencies.map(l => l.with);
// Marks shown either way: how much later the judge makes them.
const addedLat = latencies.filter(l => l.base !== null).map(l => l.with - l.base);
const result = {
  split,
  policy: P,
  catches: catchTable,
  w1Unchanged,
  traps,
  control,
  pool,
  poolChanges: wakeBy,
  wakePerMinute: +(woke / Math.max(1e-9, poolSeconds / 60)).toFixed(2),
  wakes: woke,
  poolMinutes: +(poolSeconds / 60).toFixed(1),
  eventSets,
  latency: {
    note: `with the judge: hold ${hold} s + inference ${inference} s on marks it touched`,
    n: latencies.length,
    judged: latencies.filter(l => l.judged).length,
    base: {median: q(baseLat, 0.5), p90: q(baseLat, 0.9)},
    with: {median: q(withLat, 0.5), p90: q(withLat, 0.9)},
    addedOnSameMarks: {n: addedLat.length, median: q(addedLat, 0.5), p90: q(addedLat, 0.9), max: q(addedLat, 1)},
  },
  poolAdded,
  poolRemoved,
};
if (args.out) fs.writeFileSync(args.out, JSON.stringify(result, null, 1));
const brief = {...result, poolAdded: result.poolAdded.length, poolRemoved: result.poolRemoved.length};
console.log(JSON.stringify(brief, null, 1));
