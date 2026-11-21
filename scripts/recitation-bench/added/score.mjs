/* eslint-env node, es2020 */
// Scores the added-word rule.
//   node added/score.mjs --split dev|test|all [--set '{"noGap":-3}'] [--show 1]
//     [--out .out/added/score_dev]
//
// Catches come from the natural events (added/pairs.py), run through the model.
// False marks come from correct recitation. The offline screen
// (added/replay_text.mjs) read every clip of a suite without the model; a clip it
// passed as clean cannot get a mark at any score cut-off, so it counts with zero
// marks, and only the clips it held went through the model. A clip the screen held
// with no model run is an error, never a zero.
//
// Intervals: 95%, 2000 resamples of the independent units (events or passages) and
// reciters together. Raw counts of runs are not sample sizes.
import fs from 'node:fs';
import path from 'node:path';
import {BENCH, DEFAULTS, features, inSplit, index, marksOf, readPacked, twoWay, words} from './lib.mjs';
import {replay} from '../natural/replay.mjs';
import {poissonUpper} from '../natural/score.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const split = args.split ?? 'dev';
const P = {...DEFAULTS, ...(args.set ? JSON.parse(args.set) : {})};
const show = args.show === '1';
const outDir = args.out ? path.resolve(args.out) : null;
const PACKED = path.join(BENCH, '.out/added/packed');
const SCREEN = path.join(BENCH, '.out/added/screen');

const splits = split === 'all' ? ['dev', 'test'] : [split];
const packedNames = fs.existsSync(PACKED) ? fs.readdirSync(PACKED).map(n => n.replace('.jsonl.gz', '')) : [];
const readAll = prefix => packedNames.filter(n => n.startsWith(prefix)).flatMap(n => readPacked(n));

const gapDist = (m, left, right) => {
  const a = index.get(m.left) - index.get(left);
  const b = index.get(m.right) - index.get(right);
  return Math.max(Math.abs(a), Math.abs(b));
};
const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const fmtPct = r => (r.est === null ? '-' : `${(100 * r.est).toFixed(1)}% [${(100 * r.lo).toFixed(1)}, ${(100 * r.hi).toFixed(1)}]`);
const fmtRate = r => (r.est === null ? '-' : `${(1000 * r.est).toFixed(2)} [${(1000 * r.lo).toFixed(2)}, ${(1000 * r.hi).toFixed(2)}]`);
const report = {split, constants: P};
const lines = [];
const say = (...x) => {
  const s = x.join(' ');
  lines.push(s);
  console.log(s);
};
const wordCount = (s, a) => {
  const k = index.get(`${s}:${a}:0`);
  return k === undefined ? undefined : words[k].total;
};

// ------------------------------------------------------------- natural events
function scoreNatural(runs, label) {
  const rows = [];
  const missed = [];
  const lat = [];
  let redBefore = 0;
  let redAfter = 0;
  let falseBefore = 0;
  for (const run of runs) {
    const t = run.truth;
    const list = [...marksOf(run, P).values()];
    const exact = list.find(m => m.left === t.left && m.right === t.right);
    const near = list.find(m => gapDist(m, t.left, t.right) <= 1);
    const before = list.filter(m => index.get(m.right) <= index.get(t.left));
    falseBefore += before.length;
    const live = exact && exact.mode === 'live';
    rows.push({a: t.cluster, b: t.reciter, exact: exact ? 1 : 0, live: live ? 1 : 0, near: near ? 1 : 0});
    if (live && t.wordStampMs) {
      const [s, a] = t.cluster.split(':');
      const part = run.partsAt?.find(p => p.key === `${s}:${a}`);
      lat.push(exact.t - ((part?.start ?? 0) + t.wordStampMs[1] / 1000));
    }
    // Red marks the app would show on the two correct words around the event.
    const shown = replay(run, {mode: 'app', wordCount}).visible;
    const red = [t.left, t.right].filter(id => shown.has(id));
    if (red.length) {
      redBefore += 1;
      if (!live) redAfter += 1;
    }
    if (!exact) missed.push({cluster: t.cluster, kind: t.kind, word: t.phon, left: t.left, right: t.right, reciter: t.reciter});
  }
  const pick = key => twoWay(rows.map(x => ({a: x.a, b: x.b, num: x[key], den: 1})));
  const r = {
    runs: rows.length,
    exact: pick('exact'),
    live: pick('live'),
    near: pick('near'),
    falseBefore,
    latencyMedian: pct(lat, 0.5),
    latencyP90: pct(lat, 0.9),
    latencyN: lat.length,
    redNeighbour: redBefore,
    redNeighbourLeft: redAfter,
    missed,
  };
  say(`${label}: ${rows.length} runs, ${r.exact.unitsA} events, ${r.exact.unitsB} reciters. In the exact gap ${fmtPct(r.exact)}; live ${fmtPct(r.live)}; within one word ${fmtPct(r.near)}. Marks before the event: ${falseBefore}. From the next word's onset, median ${r.latencyMedian?.toFixed(2)} s, p90 ${r.latencyP90?.toFixed(2)} s, n=${lat.length}. Runs with a red mark on a word around the event: ${redBefore}; left if a confirmed added mark clears them: ${redAfter}.`);
  return r;
}

const kept = readAll('added_kept').filter(r => inSplit(r.truth, split));
const between = readAll('added_between').filter(r => inSplit(r.truth, split));
const appFlow = readAll('added_app').filter(r => inSplit(r.truth, split));
say(`## Natural added words (${split})`);
for (const [name, list] of [
  ['interior, reader keeps the place', kept.filter(r => r.truth.kind === 'interior')],
  ['interior, the place kept, at least 2 shared words after', kept.filter(r => r.truth.kind === 'interior' && r.truth.rightWords >= 2)],
  ['interior, the place kept, 1 shared word after', kept.filter(r => r.truth.kind === 'interior' && r.truth.rightWords < 2)],
  ['interior, recording starts on other words, place kept', kept.filter(r => r.truth.kind === 'interior_prefix')],
  ['between two ayat, reader arrives through other words, place kept', between],
  ['interior, the app flow as it is, no help', appFlow],
]) {
  if (list.length) report[name] = scoreNatural(list, name);
}
// By the extra word's size.
for (const [name, keep] of [
  ['interior, place kept, word of up to 3 sounds', n => n <= 3],
  ['interior, place kept, word of 4-6 sounds', n => n >= 4 && n <= 6],
  ['interior, place kept, word of 7 or more', n => n >= 7],
]) {
  const list = kept.filter(r => r.truth.kind === 'interior' && keep([...new Set([...r.truth.phon])].length));
  if (list.length) report[name] = scoreNatural(list, name);
}

// ---------------------------------------------------------------- correct text
function screened(suite) {
  const dir = SCREEN;
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(`${suite}.`)) continue;
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!line) continue;
      const r = JSON.parse(line);
      out.set(r.id, r);
    }
  }
  return out;
}

function falseSet(name, suite, prefix, opts = {}) {
  const screen = [...screened(suite).values()].filter(r => r.truth && inSplit(r.truth, split) && (opts.keep ? opts.keep(r.truth) : true));
  const models = new Map(readAll(prefix).map(r => [r.id, r]));
  const rows = [];
  const listed = [];
  const funnel = {};
  let held = 0;
  let missing = 0;
  let flush = 0;
  let live = 0;
  let wordsTotal = 0;
  for (const r of screen) {
    const den = opts.words ? opts.words(r.truth) : r.truth.words ?? 0;
    wordsTotal += den;
    for (const [k, v] of Object.entries(r.rejected ?? {})) funnel[k] = (funnel[k] ?? 0) + v;
    const needs = r.candidates.length > 0 || r.unlocks > 0;
    const run = models.get(r.id);
    if (needs) {
      held += 1;
      if (!run) missing += 1;
    }
    let num = 0;
    if (run) {
      const marks = [...marksOf(run, P).values()].filter(m => (opts.keepMark ? opts.keepMark(m, r.truth) : true));
      num = marks.filter(m => m.mode === 'live').length;
      live += num;
      flush += marks.length - num;
      for (const m of marks) {
        listed.push({run: r.id, chars: m.chars, left: m.left, right: m.right, t: m.t, mode: m.mode, noGap: m.rec.noGap, tokens: m.rec.tokens, fit: [m.rec.fitL, m.rec.fitR], margin: m.rec.margin});
      }
    }
    rows.push({a: opts.unit ? opts.unit(r) : r.truth.block ?? r.truth.expectedKey ?? r.truth.audioKey, b: r.truth.reciter ?? r.truth.speaker ?? 'x', num, den});
  }
  const rate = twoWay(rows);
  const upper = wordsTotal ? (1000 * poissonUpper(live)) / wordsTotal : null;
  const res = {clips: screen.length, words: wordsTotal, held, modelRuns: models.size, missing, live, flush, rate, poissonUpperPer1000: upper, units: rate.unitsA, reciters: rate.unitsB, funnel, listed};
  say(`${name}: ${screen.length} clips, ${wordsTotal} words, ${rate.unitsA} units, ${rate.unitsB} speakers. Screen held ${held} clips${missing ? ` (${missing} WITHOUT A MODEL RUN)` : ''}. False added marks: ${live} live, ${fmtRate(rate)} per 1,000, exact Poisson upper bound before clustering ${upper?.toFixed(2)}; ${flush} more only at the harness's flush.`);
  if (show) {
    say(`  text funnel ${JSON.stringify(funnel)}`);
    for (const m of listed) say('  FALSE', JSON.stringify(m));
  }
  return res;
}

say(`## Correct recitation (${split})`);
report.pool = falseSet('Pool', 'pool', 'pool');
report.poolRestart = falseSet('  words in ayat with a natural restart', 'pool', 'pool', {
  words: t => t.ayat.filter(a => a.restarts > 0).reduce((n, a) => n + a.words, 0),
  keepMark: (m, t) => {
    const [s, a] = m.right.split(':');
    return t.ayat.some(x => x.key === `${s}:${a}` && x.restarts > 0);
  },
});
report.poolJoins = falseSet('  joins between ayat (per 1,000 joins)', 'pool', 'pool', {
  words: t => Math.max(0, t.ayat.length - 1),
  keepMark: m => features(m.rec, P).between,
});
report.control = falseSet('W1 control: the same recordings against their own text', 'w1_control', 'control', {unit: r => r.truth.expectedKey});
report.w5 = {};
for (const cat of ['basmala', 'madd_lazim', 'midstart', 'muqattaat', 'options', 'pause_over_3s', 'sakta', 'silent_alif', 'written_form']) {
  report.w5[cat] = falseSet(`W5 ${cat}`, 'w5', 'w5', {keep: t => t.category === cat, unit: r => r.truth.expectedKey});
}
if (splits.includes('dev')) {
  const wordsOf = t => {
    const [s, a] = t.expectedKey.split(':').map(Number);
    const n = wordCount(s, a) ?? 0;
    return t.wordEnd ? Math.max(1, t.wordEnd - (t.wordStart ?? 0)) : n;
  };
  report.learnersIkhlas = falseSet('Learners, Al-Ikhlas dev half, clips an expert marked correct', 'learners', 'learners', {
    keep: t => t.dataset === 'al-ikhlas' && t.label === 'correct',
    words: wordsOf,
    unit: r => r.truth.speaker,
  });
  report.learnersSobolev = falseSet('Learners, sobolev, clips with no recorded error (not verified correct)', 'learners', 'learners', {
    keep: t => t.dataset === 'sobolev' && t.label === 'unknown',
    words: wordsOf,
    unit: r => r.truth.speaker,
  });
}

// ---------------------------------------------------------------------- W1
say(`## W1 (${split})`);
const w1Screen = [...screened('w1').values()].filter(r => r.truth && inSplit(r.truth, split));
const w1Models = new Map(readAll('w1').map(r => [r.id, r]));
const w1Marks = r => {
  const run = w1Models.get(r.id);
  return run ? [...marksOf(run, P).values()] : [];
};
const w1Held = w1Screen.filter(r => r.candidates.length || r.unlocks).length;
const w1Missing = w1Screen.filter(r => (r.candidates.length || r.unlocks) && !w1Models.has(r.id)).length;
say(`W1 clips ${w1Screen.length}; screen held ${w1Held}${w1Missing ? ` (${w1Missing} WITHOUT A MODEL RUN)` : ''}.`);
for (const [label, keep] of [
  ['added, interior', t => t.type === 'added' && t.position === 'interior'],
  ['added, first word', t => t.type === 'added' && t.position === 'first' && !t.short],
  ['added, first word, under-4-word ayat', t => t.type === 'added' && t.position === 'first' && t.short],
  ['added last word', t => t.type === 'added_last'],
]) {
  const rows = [];
  for (const r of w1Screen.filter(x => keep(x.truth))) {
    const t = r.truth;
    const [s, a] = t.expectedKey.split(':');
    const rightId = t.target === null || t.target === undefined ? null : `${s}:${a}:${t.target}`;
    const m = rightId ? w1Marks(r).find(x => x.right === rightId) : null;
    rows.push({a: t.pair, b: t.reciter, num: m ? 1 : 0, den: 1, live: m?.mode === 'live' ? 1 : 0});
  }
  if (rows.length) {
    const all = twoWay(rows);
    const live = twoWay(rows.map(x => ({...x, num: x.live})));
    say(`${label}: ${rows.length} runs, ${all.unitsA} pairs, ${all.unitsB} reciters. Marked with flush ${fmtPct(all)}; live ${fmtPct(live)}.`);
    report[`w1 ${label}`] = {runs: rows.length, withFlush: all, live};
  }
}
for (const type of ['changed', 'trap', 'skipped', 'dropped_last', 'junction']) {
  const mine = w1Screen.filter(r => r.truth.type === type);
  if (!mine.length) continue;
  let beside = 0;
  let elsewhere = 0;
  const rows = [];
  for (const r of mine) {
    const t = r.truth;
    const [s, a] = (t.expectedKey ?? '0:0').split(':');
    const k = t.target === null || t.target === undefined ? undefined : index.get(`${s}:${a}:${t.target}`);
    const marks = w1Marks(r);
    const n = marks.filter(m => k !== undefined && Math.abs(index.get(m.right) - k) <= 1).length;
    beside += n;
    elsewhere += marks.length - n;
    rows.push({a: t.pair, b: t.reciter, num: marks.length - n, den: t.words ?? 1});
  }
  const rate = twoWay(rows);
  say(`W1 ${type}: ${mine.length} runs, ${rate.unitsA} pairs. Added marks beside the event's word ${beside}; elsewhere ${elsewhere} (${fmtRate(rate)} per 1,000 words).`);
  report[`w1 ${type}`] = {runs: mine.length, beside, elsewhere, rate};
}

if (outDir) {
  fs.mkdirSync(outDir, {recursive: true});
  fs.writeFileSync(path.join(outDir, 'score.json'), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(outDir, 'score.md'), lines.join('\n') + '\n');
}
