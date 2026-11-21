/* eslint-env node, es2020 */
// Scores runs through the app's mark rules (replay.mjs; WORD_MARKS picks the
// version), for the junction experiment: marks on left-out last words at natural
// sites, marks on the same words when they are said, marks on the correct pool,
// W5 and the W1 junction and dropped-last clips.
//
//   WORD_MARKS=<file> node natural/junction/score_junction.mjs --runs <dir>
//     --split dev|test|all --out <file.json> [--boot 2000] [--only <suite>]
//     [--tau -7 --fit -4 --post <dir>] [--alt hits:<x>|frames:<x>|distance:<x>]
//
// <dir> holds live, control, pool, w5 and w1 folders; a missing one is skipped.
// Rows of the same run in two scorings can be compared by `id`.
//
// With --tau <llr> --post <dir>, runs of the plain engine with the probe stand in
// for the patched engine: each take's verdicts get the check's result at the time
// the patched engine would add it, computed on the take's dumped posteriors
// (<dir>/<suite>/). verify_inline.mjs compares this with the patched engine itself.
import fs from 'node:fs';
import path from 'node:path';
import {pigeonhole} from '../score.mjs';
import {replay} from '../replay.mjs';
import {loadCorpus} from './llr.mjs';
import {consonantsHeard, withCheck, withSimpleRule} from './decision.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT_ROOT = path.resolve(HERE, '../../.out/natural');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const runsDir = path.resolve(args.runs);
const split = args.split ?? 'all';
const boot = Number(args.boot ?? 2000);
if (split === 'test' && !fs.existsSync(path.join(OUT_ROOT, 'junction/frozen.json'))) {
  throw new Error('the rule is not frozen yet');
}
const engineWords = JSON.parse(fs.readFileSync(path.join(OUT_ROOT, 'manifests/engine_words.json'), 'utf8'));
const wordCount = (s, a) => engineWords[`${s}:${a}`];

// --alt hits:<x> | frames:<x> | distance:<x>: a simpler rule instead of the check.
const simple = (() => {
  if (!args.alt) return null;
  const [name, value] = args.alt.split(':');
  const x = Number(value);
  if (name === 'hits') return (row, expected) => consonantsHeard(expected, row.ch ?? '') <= x;
  if (name === 'frames') return row => (row.from === undefined ? 0 : row.lf - row.ff + 1) <= x;
  if (name === 'distance') return row => (row.distance ?? 1) >= x;
  throw new Error(`unknown --alt ${args.alt}`);
})();
const tau = args.tau === undefined ? null : Number(args.tau);
const postRoot = args.post ? path.resolve(args.post) : null;
const corpus = tau === null && !simple ? null : loadCorpus();
const tested = {tests: 0, missing: 0, joins: 0, noWindow: 0, early: 0, decided: 0};
const constants = {llrMissing: tau, fitNext: Number(args.fit ?? -4), fitLate: Number(args['fit-late'] ?? -Infinity)};

function* runsIn(dir, suite) {
  if (args.only && args.only !== suite) return;
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (simple) yield withSimpleRule(run, simple, corpus);
    else yield tau !== null && run.probe ? withCheck(run, path.join(postRoot, suite), constants, corpus, tested) : run;
  }
}
// 'mixed': dev reciters on test passages or last-word types, and test reciters on dev
// ones: cells neither the tuning nor the test report read.
const keepPair = t => {
  if (split === 'all') return true;
  const other = t.pairSplit ?? t.blockSplit;
  if (split === 'mixed') return other !== undefined && other !== null && t.reciterSplit !== other;
  return t.reciterSplit === split && (other ?? split) === split;
};

const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2);
};
const rate = rows => {
  const r = pigeonhole(rows, boot);
  return {est: r.est, lo: r.lo, hi: r.hi, num: r.num, den: r.den, unitsA: r.unitsA, unitsB: r.unitsB};
};

/**
 * A site's tracker locks on the word before with no history, so its cost rate over
 * the first few dozen sounds is high and it reports 'lost' around the join. In the app
 * the reader has been followed for a long stretch by then (the rate is over 120
 * sounds), and the same few sounds do not get near it. So those events are left out
 * of the replay, unless --keep-lost 1. The verdicts themselves do not depend on them.
 */
function withoutShortHistoryLost(run) {
  if (args['keep-lost'] === '1') return run;
  return {...run, log: run.log.filter(e => !(e.type === 'debug' && e.event === 'lost'))};
}

function scoreSite(rawRun, wantMissing) {
  const run = withoutShortHistoryLost(rawRun);
  const t = run.clip.truth;
  const key = t.expectedKey;
  const [s, a] = key.split(':').map(Number);
  const n = engineWords[key];
  const exact = `${key}:${n - 1}`;
  const near = new Set([exact, `${key}:${n - 2}`, `${s}:${a + 1}:0`]);
  const {visible, trail} = replay(run, {mode: 'app', wordCount});
  // Words where the audio and the text agree: from the lock to the word before, and
  // the next ayah's words in common. A mark there is collateral, not the event's.
  const agreed = new Set();
  for (let w = t.lockWord ?? n - 2; w < n - 1; w++) agreed.add(`${key}:${w}`);
  for (let w = 0; w < (t.right ?? 1); w++) agreed.add(`${s}:${a + 1}:${w}`);
  const row = {
    id: run.clip.id,
    site: t.pair,
    reciter: t.reciter,
    word: t.word,
    right: t.right,
    left: t.left,
    exact: visible.has(exact) ? 1 : 0,
    nearOnly: !visible.has(exact) && [...visible.keys()].some(k => near.has(k)) ? 1 : 0,
    other: [...visible.keys()].filter(k => !near.has(k)).length,
    collateral: [...visible.keys()].filter(k => agreed.has(k)).length,
    marks: [...visible.keys()],
    verdicts: (trail.get(exact) ?? []).map(v => v.state),
  };
  if (wantMissing && visible.has(exact) && run.partsAt?.[1]) {
    const onset = run.partsAt[1].start + (t.nextOnsetMs ?? 0) / 1000;
    row.latency = +(visible.get(exact).shownAt - onset).toFixed(2);
    row.kind = visible.get(exact).kind;
  }
  return row;
}

function poolRow(run) {
  const t = run.clip.truth;
  const {visible} = replay(run, {mode: 'app', wordCount});
  const marks = [...visible.keys()];
  const isLast = id => {
    const [s, a, w] = id.split(':').map(Number);
    return w === engineWords[`${s}:${a}`] - 1;
  };
  return {
    id: run.clip.id,
    block: t.block ?? t.category ?? t.pair ?? run.clip.id,
    reciter: t.reciter,
    words: t.words ?? 0,
    marks,
    lastWordMarks: marks.filter(isLast),
  };
}

const out = {split, rules: process.env.WORD_MARKS ?? 'services/recitation/wordMarks.ts'};

// Natural sites.
const live = [];
for (const run of runsIn(path.join(runsDir, 'live'), 'live')) {
  if (keepPair(run.clip.truth)) live.push(scoreSite(run, true));
}
const control = [];
for (const run of runsIn(path.join(runsDir, 'control'), 'control')) {
  if (keepPair(run.clip.truth)) control.push(scoreSite(run, false));
}
const siteTable = (rows, filter) => {
  const list = rows.filter(filter);
  return {
    runs: list.length,
    sites: new Set(list.map(r => r.site)).size,
    types: new Set(list.map(r => r.word)).size,
    exact: rate(list.map(r => ({a: r.site, b: r.reciter, num: r.exact, den: 1}))),
    exactOrNear: rate(list.map(r => ({a: r.site, b: r.reciter, num: r.exact + r.nearOnly, den: 1}))),
    // Sites share last words, so a wider interval resamples the word types themselves.
    exactByType: rate(list.map(r => ({a: r.word, b: r.reciter, num: r.exact, den: 1}))),
    otherMarksPerRun: list.length ? list.reduce((x, r) => x + r.other, 0) / list.length : null,
    collateralMarks: list.reduce((x, r) => x + r.collateral, 0),
    runsWithCollateral: list.filter(r => r.collateral > 0).length,
  };
};
if (live.length) {
  out.live = {
    all: siteTable(live, () => true),
    twoPlusNextWords: siteTable(live, r => r.right >= 2),
    oneNextWord: siteTable(live, r => r.right < 2),
    latencyFromNextWord: {
      n: live.filter(r => r.latency !== undefined).length,
      median: pct(live.filter(r => r.latency !== undefined).map(r => r.latency), 0.5),
      p90: pct(live.filter(r => r.latency !== undefined).map(r => r.latency), 0.9),
    },
    bySite: Object.values(
      live.reduce((m, r) => {
        const e = (m[r.site] ??= {site: r.site, word: r.word, left: r.left, right: r.right, runs: 0, exact: 0});
        e.runs += 1;
        e.exact += r.exact;
        return m;
      }, {}),
    ),
  };
}
if (control.length) out.control = {all: siteTable(control, () => true)};

// Correct recitation.
const poolish = name => {
  const rows = [];
  for (const run of runsIn(path.join(runsDir, name), name)) {
    if (keepPair(run.clip.truth)) rows.push(poolRow(run));
  }
  if (!rows.length) return null;
  const sum = f => rows.reduce((x, r) => x + f(r), 0);
  return {
    takes: rows.length,
    words: sum(r => r.words),
    falseMarks: sum(r => r.marks.length),
    onLastWords: sum(r => r.lastWordMarks.length),
    per1000: rate(rows.map(r => ({a: r.block, b: r.reciter, num: r.marks.length, den: r.words}))),
    rows: rows.map(({id, marks, lastWordMarks}) => ({id, marks, lastWordMarks})),
  };
};
for (const name of ['pool', 'w5']) {
  const got = poolish(name);
  if (got) out[name] = got;
}

// W1 events that end or cross at a last word.
const w1 = [];
for (const run of runsIn(path.join(runsDir, 'w1'), 'w1')) {
  const t = run.clip.truth;
  if (split !== 'all' && !(t.reciterSplit === split && t.pairSplit === split)) continue;
  if (!['junction', 'dropped_last', 'added_last'].includes(t.type)) continue;
  const key = t.expectedKey;
  const n = engineWords[key];
  const exact = `${key}:${n - 1}`;
  const {visible} = replay(run, {mode: 'app', wordCount});
  w1.push({type: t.type, pair: t.pair, reciter: t.reciter, exact: visible.has(exact) ? 1 : 0, marks: visible.size});
}
if (w1.length) {
  out.w1 = {};
  for (const type of new Set(w1.map(r => r.type))) {
    const list = w1.filter(r => r.type === type);
    out.w1[type] = {runs: list.length, pairs: new Set(list.map(r => r.pair)).size, exact: rate(list.map(r => ({a: r.pair, b: r.reciter, num: r.exact, den: 1})))};
  }
}

if (tau !== null) out.check = {...constants, ...tested};
if (args.out) fs.writeFileSync(args.out, JSON.stringify(out));
const brief = {...out};
for (const k of ['pool', 'w5']) if (brief[k]) brief[k] = {...brief[k], rows: undefined};
console.log(JSON.stringify(brief, null, 1));
