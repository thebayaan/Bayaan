/* eslint-env node, es2020 */
// Tests of this job's logic, and of its results once they exist.
//   node --test chatter/learners_built_test.mjs
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {mulberry} from './learners_lib.mjs';
import {OUT, SUITES, audioOf, gate, loadRows, rowFile, suiteOf, withinLimits} from './learners_built_lib.mjs';
import {hashF32} from './learners_lib.mjs';
import {reading, stepsTable} from './learners_built_report_tables.mjs';
import {
  chainCost,
  ci,
  compareTables,
  diffTake,
  div,
  editKinds,
  jobsOf,
  labelTable,
  lengthClass,
  makeDraws,
  oneWayDrawer,
  othersChanged,
  productDrawer,
  reachChance,
  readRowsText,
  readersOfTexts,
  shuffleChance,
  sub,
  sumOver,
  twoWayInterval,
  withinWord,
} from './learners_built_stats.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const LOOK = path.resolve(HERE, '../../second-look');

// ------------------------------------------------------------------- the parity gate

test('diffTake names the chains and fields that differ', () => {
  const take = over => ({
    seconds: 1,
    onset: null,
    wakes: {S1: {wakes: 0}},
    features: {},
    cfg: {'J.none': {app: {shown: []}}, 'S1.P3': {app: {shown: []}}},
    ...over,
  });
  assert.deepEqual(diffTake(take(), take(), ['J.none', 'S1.P3']), {chains: [], fields: []});
  const b = take({cfg: {'J.none': {app: {shown: []}}, 'S1.P3': {app: {shown: [{id: 'x'}]}}}, wakes: {S1: {wakes: 1}}});
  assert.deepEqual(diffTake(take(), b, ['J.none', 'S1.P3']), {chains: ['S1.P3'], fields: ['wakes']});
  assert.deepEqual(diffTake(take(), undefined, ['J.none']).fields, ['missing here']);
  assert.deepEqual(diffTake(undefined, take(), ['J.none']).fields, ['missing in the frozen file']);
});

test('readRowsText keeps rows of the named runs and leaves out torn and done lines', () => {
  const text = [
    '{"run":"a","id":"1:1:0","t":1,"src":"live"}',
    '{"done":"a"}',
    '{"run":"b","id":"1:1:0","t":1,"src":"live"}',
    '{"run":"a","id":"1:1:1","t":2,"sr',
    '',
  ].join('\n');
  const all = readRowsText(text);
  assert.deepEqual([...all.keys()], ['a|1:1:0|1|live', 'b|1:1:0|1|live']);
  assert.deepEqual([...readRowsText(text, new Set(['b'])).keys()], ['b|1:1:0|1|live']);
});

test('labelTable counts what a chain keeps from the base and what it adds', () => {
  const rows = [
    {
      id: 'q/1_1',
      cfg: {
        'J.none': {app: {shown: [{id: 'hit-word', s: 1}, {id: 'false-word', s: 1}, {id: 'lead-word', s: 1}]}},
        X: {app: {shown: [{id: 'hit-word', s: 1}, {id: 'new-near', s: 1}, {id: 'lead-word', s: 1}]}},
      },
    },
  ];
  const label = (_id, m) =>
    ({'hit-word': 'hit', 'false-word': 'false-incorrect', 'new-near': 'near', 'lead-word': 'lead'})[m.id];
  const pigeonhole = pts => ({num: pts.reduce((n, p) => n + p.num, 0), den: pts.length});
  const fmtP = e => `${e.num}/${e.den}`;
  const t = labelTable(rows, {label, chains: ['J.none', 'X'], pigeonhole, fmtP});
  assert.equal(t.X.hit.kept, 1);
  assert.equal(t.X.hit.of, 1);
  assert.equal(t.X['false-incorrect'].kept, 0);
  assert.equal(t.X['false-incorrect'].of, 1);
  // As tables.mjs: a base mark that is not on a learner's word is not in the base.
  assert.deepEqual(t.X.added, {near: 1, lead: 1});
});

test('compareTables finds kept and added cells that differ', () => {
  const cell = (kept, of, ci2 = 'c') => ({kept, of, ci: ci2});
  const row = (hit, added = {}) => ({
    hit,
    near: cell(0, 0),
    'false-incorrect': cell(0, 0),
    'false-correct': cell(0, 0),
    added,
  });
  assert.equal(compareTables({A: row(cell(1, 2))}, {A: row(cell(1, 2))}, true).cells, 0);
  assert.equal(compareTables({A: row(cell(1, 2))}, {A: row(cell(2, 2))}, false).cells, 1);
  assert.equal(compareTables({A: row(cell(1, 2), {hit: 1})}, {A: row(cell(1, 2))}, false).cells, 0);
  assert.equal(compareTables({A: row(cell(1, 2), {hit: 1})}, {A: row(cell(1, 2))}, true).cells, 1);
  assert.equal(compareTables({A: row(cell(1, 2, 'x'))}, {A: row(cell(1, 2, 'y'))}, true).cells, 1);
});

// ------------------------------------------------------------------- draws

test('makeDraws draws each unit as often as there are units, and repeats with its seed', () => {
  const d = makeDraws(3, 5, 4, mulberry(7));
  for (let b = 0; b < 4; b++) {
    assert.equal(d.spk.subarray(b * 3, (b + 1) * 3).reduce((x, y) => x + y, 0), 3);
    assert.equal(d.word.subarray(b * 5, (b + 1) * 5).reduce((x, y) => x + y, 0), 5);
  }
  assert.deepEqual(makeDraws(3, 5, 4, mulberry(7)).word, d.word);
  assert.notDeepEqual(makeDraws(3, 5, 4, mulberry(8)).word, d.word);
});

test('makeDraws draws in the order of the first test, one draw at a time', () => {
  const rand = mulberry(20261107);
  const spk = new Int16Array(2 * 2);
  const word = new Int16Array(2 * 3);
  for (let b = 0; b < 2; b++) {
    for (let i = 0; i < 2; i++) spk[b * 2 + Math.floor(rand() * 2)] += 1;
    for (let i = 0; i < 3; i++) word[b * 3 + Math.floor(rand() * 3)] += 1;
  }
  const d = makeDraws(2, 3, 2, mulberry(20261107));
  assert.deepEqual(d.spk, spk);
  assert.deepEqual(d.word, word);
});

test('sumOver counts a row by its speaker draws times its word draws times its value', () => {
  const drawer = productDrawer({
    spk: Int16Array.from([2, 0, 0, 2]),
    word: Int16Array.from([1, 1, 2, 0]),
    nS: 2,
    nW: 2,
    boot: 2,
  });
  const rows = [{si: 0, wi: 0, v: 3}, {si: 1, wi: 1, v: 1}];
  assert.deepEqual(Array.from(sumOver(rows, drawer, r => r.v)), [2 * 1 * 3 + 0, 0 + 2 * 0 * 1]);
  assert.deepEqual(Array.from(sumOver(rows, drawer)), [2, 0]);
});

test('oneWayDrawer resamples only its own unit', () => {
  const cells = new Map([[0 * 100000 + 0, 0], [1 * 100000 + 1, 1]]);
  const spk = oneWayDrawer('speakers', {nS: 2, nW: 2, boot: 50, cells, rand: mulberry(1)});
  assert.deepEqual(Array.from(spk.wOf(0, 0)), Array.from(spk.wOf(0, 1)));
  const word = oneWayDrawer('words', {nS: 2, nW: 2, boot: 50, cells, rand: mulberry(2)});
  assert.deepEqual(Array.from(word.wOf(0, 1)), Array.from(word.wOf(1, 1)));
  const cell = oneWayDrawer('cells', {nS: 2, nW: 2, boot: 50, cells, rand: mulberry(3)});
  assert.throws(() => cell.wOf(0, 1), /no cell/);
  const a = Array.from(cell.wOf(0, 0));
  const b = Array.from(cell.wOf(1, 1));
  a.forEach((x, i) => assert.equal(x + b[i], 2));
});

test('ci takes the 2.5% and 97.5% points and ignores what is not finite', () => {
  const v = Array.from({length: 1000}, (_, i) => i);
  assert.deepEqual(ci(v), {lo: 25, hi: 975});
  assert.deepEqual(ci([NaN, 1, 1, Infinity]), {lo: 1, hi: 1});
  assert.equal(ci([NaN]), null);
  assert.deepEqual(Array.from(div(Float64Array.from([1, 2]), Float64Array.from([2, 0]), 100)), [50, NaN]);
  assert.deepEqual(Array.from(sub(Float64Array.from([3]), Float64Array.from([1]))), [2]);
});

test('twoWayInterval adds speakers and words, takes cells away, and stops at zero', () => {
  const spread = k => Float64Array.from(Array.from({length: 1001}, (_, i) => (i - 500) * k));
  const sd = k => {
    const a = spread(k);
    return Math.sqrt(a.reduce((x, y) => x + y * y, 0) / 1000);
  };
  const t = twoWayInterval(10, spread(3), spread(4), spread(0));
  const want = 1.96 * Math.sqrt(sd(3) ** 2 + sd(4) ** 2);
  assert.ok(Math.abs(t.hi - (10 + want)) < 1e-2);
  assert.ok(Math.abs(t.lo - (10 - want)) < 1e-2);
  assert.deepEqual(twoWayInterval(5, spread(0), spread(0), spread(2)), {lo: 5, hi: 5});
});

// ------------------------------------------------------------------- what the reader changed

const seg = over => ({
  surah: 2,
  ayahStart: 5,
  wordStart: 2,
  ayahEnd: 5,
  wordEnd: 6,
  label: 'incorrect',
  phonemeEdits: [],
  ...over,
});

test('editKinds tells vowels from consonants per word and pulls outside edits to the ends', () => {
  const k = editKinds(
    seg({
      phonemeEdits: [
        {class: 'vowel', word: '2:5:3'},
        {class: 'vowelLength', word: '2:5:3'},
        {class: 'vowel', word: '2:5:4'},
        {class: 'consonant', word: '2:5:4'},
        {class: 'consonantDeleted', word: '2:5:5'},
        {class: 'vowel', word: '2:5:1'},
        {class: 'consonant', word: '2:5:9'},
        {class: 'consonant', word: '3:1:1'},
        {class: 'consonant'},
      ],
    }),
  );
  assert.equal(k.get('5:3').vowelOnly, true);
  assert.equal(k.get('5:4').vowelOnly, false);
  assert.equal(k.get('5:4').sub, true);
  assert.equal(k.get('5:5').deleted, true);
  assert.equal(k.get('5:2').vowelOnly, true);
  assert.equal(k.get('5:6').vowelOnly, false);
  assert.equal(k.size, 5);
});

test('othersChanged reads only other speakers of the same text, on incorrect takes', () => {
  const take = (speaker, words, over) => ({speaker, seg: seg(over), errors: new Set(words)});
  const by = readersOfTexts([
    take('a', ['5:3']),
    take('b', ['5:4']),
    take('c', ['5:5'], {label: 'correct'}),
    take('d', ['5:6'], {wordEnd: 7}),
  ]);
  assert.equal(othersChanged(by, seg(), 'a', '5:3'), false);
  assert.equal(othersChanged(by, seg(), 'a', '5:4'), true);
  assert.equal(othersChanged(by, seg(), 'b', '5:3'), true);
  assert.equal(othersChanged(by, seg(), 'a', '5:5'), false);
  assert.equal(othersChanged(by, seg(), 'a', '5:6'), false);
});

test('lengthClass uses the check\'s classes', () => {
  assert.deepEqual([null, 1, 2, 3, 4, 5, 9].map(lengthClass), ['x', 's', 's', 'm', 'm', 'l', 'l']);
});

// ------------------------------------------------------------------- chance

const words = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5'];

test('reachChance counts only all but the last two words', () => {
  const errors = new Set(['w1', 'w5']);
  assert.equal(reachChance({i: 0, words, errors}), 1 / 4);
  // A mark on the last two words keeps its real outcome.
  assert.equal(reachChance({i: 5, words, errors}), 1);
  assert.equal(reachChance({i: 4, words, errors}), 0);
});

test('shuffleChance leaves marks on the last two words as they are', () => {
  const errors = new Set(['w5']);
  const rows = [{text: 't', i: 5, words, errors, isNew: false}];
  const r = shuffleChance(rows, {N: 200, rand: mulberry(1)});
  assert.equal(r.hits, 1);
  assert.equal(r.mean, 1);
  assert.equal(r.p, 1);
});

test('shuffleChance moves labels only among the words marks reach', () => {
  // One label among 4 reachable places: a mark there holds it a quarter of the time.
  const errors = new Set(['w0']);
  const rows = [{text: 't', i: 2, words, errors, isNew: true}];
  const r = shuffleChance(rows, {N: 20000, rand: mulberry(2)});
  assert.equal(r.hits, 0);
  assert.ok(Math.abs(r.mean - 0.25) < 0.02, `${r.mean}`);
  assert.equal(r.newHits, 0);
  assert.ok(Math.abs(r.newMean - 0.25) < 0.02);
  // A label on the last two words never moves into the reach.
  const none = shuffleChance([{text: 't', i: 2, words, errors: new Set(['w4']), isNew: false}], {N: 500, rand: mulberry(3)});
  assert.equal(none.mean, 0);
});

test('shuffleChance uses one shuffle per text, so readers of a text move together', () => {
  const errors = new Set(['w0']);
  const rows = [
    {text: 't', i: 1, words, errors, isNew: false},
    {text: 't', i: 1, words, errors, isNew: false},
  ];
  const r = shuffleChance(rows, {N: 2000, rand: mulberry(4)});
  // Hits are 0 or 2, never 1: the 95% range shows it and the mean stays a half.
  assert.ok(Math.abs(r.mean - 0.5) < 0.05);
  assert.equal(r.lo, 0);
  assert.equal(r.hi, 2);
  const apart = shuffleChance(
    [
      {text: 't', i: 1, words, errors, isNew: false},
      {text: 'u', i: 1, words, errors, isNew: false},
    ],
    {N: 2000, rand: mulberry(5)},
  );
  assert.ok(Math.abs(apart.mean - 0.5) < 0.05);
});

test('shuffleChance can keep labels within a class of places', () => {
  const errors = new Set(['w0']);
  const rows = [{text: 't', i: 0, words, errors, isNew: false}];
  const classOf = () => ['a', 'b', 'b', 'b', 'b', 'b'];
  const r = shuffleChance(rows, {N: 300, rand: mulberry(6), classOf});
  assert.equal(r.mean, 1);
  const mixed = shuffleChance(rows, {N: 4000, rand: mulberry(7), classOf: () => ['a', 'a', 'b', 'b', 'b', 'b']});
  assert.ok(Math.abs(mixed.mean - 0.5) < 0.05);
});

test('shuffleChance P is the share of shuffles at or above what was seen', () => {
  const errors = new Set(['w1']);
  const rows = [{text: 't', i: 1, words, errors, isNew: false}];
  const r = shuffleChance(rows, {N: 20000, rand: mulberry(8)});
  assert.equal(r.hits, 1);
  assert.ok(Math.abs(r.p - 0.25) < 0.02);
});

// ------------------------------------------------------------------- the same word, with and without

test('withinWord compares only words read both ways, within the word', () => {
  const items = [
    {word: 'a', text: 't1', edit: true, y: 1},
    {word: 'a', text: 't1', edit: false, y: 0},
    {word: 'a', text: 't1', edit: false, y: 1},
    {word: 'b', text: 't2', edit: true, y: 0},
    {word: 'b', text: 't2', edit: false, y: 0},
    {word: 'only-with', text: 't3', edit: true, y: 1},
    {word: 'only-without', text: 't4', edit: false, y: 1},
  ];
  const r = withinWord(items, {boot: 200, rand: mulberry(9)});
  assert.equal(r.words, 2);
  assert.equal(r.texts, 2);
  assert.equal(r.withEdit, 1);
  assert.equal(r.withEditOf, 2);
  assert.equal(r.without, 1);
  assert.equal(r.withoutOf, 3);
  // (1 - 0.5 + 0 - 0) / 2 words = 25 points.
  assert.equal(r.difference, 25);
  assert.ok(r.ci.lo <= 25 && r.ci.hi >= 25);
});

// ------------------------------------------------------------------- model runs

test('chainCost counts slices and padded runs, per minute of the take and of the learner part', () => {
  const rows = [
    {
      id: 'a',
      seconds: 60,
      wakes: {S1: {wakes: 3, slices: 2}, S2: {wakes: 9, slices: 8}},
      cfg: {
        'S1.P3': {app: {suspects: 4, checks: [{t: 10, x: 1}, {t: 50, x: 1}, {t: 55, x: 0}]}},
        'N1.P3': {app: {suspects: 1, checks: []}},
        'J.P1': {app: {suspects: 1, checks: [{t: 50, x: 1}]}},
      },
    },
  ];
  const from = () => 30;
  const s = chainCost(rows, 'S1.P3', from);
  assert.equal(s.slices, 2);
  assert.equal(s.extra, 2);
  assert.equal(s.extraLearner, 1);
  assert.equal(s.runsPerMinute, 4);
  // 3 runs on the learner part, in the 30 s it covers.
  assert.equal(s.runsPerLearnerMinute, 6);
  assert.equal(s.atMostPerMinute, 6);
  // No veto wakes the same words as Step 1.
  assert.equal(chainCost(rows, 'N1.P3', from).slices, 2);
  // No judge: only the look at a mark.
  const j = chainCost(rows, 'J.P1', from);
  assert.equal(j.slices, 0);
  assert.equal(j.runs, 1);
});

// ------------------------------------------------------------------- the wrapper around the frozen tools

test('the limits are this job\'s: swap at most 12 GB, free disk at least 15 GB', () => {
  assert.equal(withinLimits({swapGb: 12, freeGb: 15}), true);
  assert.equal(withinLimits({swapGb: 12.01, freeGb: 15}), false);
  assert.equal(withinLimits({swapGb: 1, freeGb: 14.9}), false);
  assert.equal(typeof gate, 'function');
});

test('this job\'s suites are registered in the frozen table and its rows stay under its folder', () => {
  assert.ok(SUITES[suiteOf('one_ar_10')].learnerOnly);
  assert.ok(SUITES.quranmb, 'the frozen suites are still there');
  assert.ok(rowFile('x', 0.48).startsWith(OUT));
  assert.ok(rowFile('x', 0.48).endsWith('x.h48.jsonl'));
  assert.ok(rowFile('x', 0).endsWith('x.h0.jsonl'));
  assert.ok(!OUT.includes('second-look'));
  assert.equal(loadRows('lb_none_0', 12.34).size, 0);
});

test('audioOf returns the audio when its hash matches and stops when it does not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-'));
  try {
    const file = path.join(dir, 'a.f32');
    const x = Float32Array.from({length: 1600}, (_, i) => Math.sin(i / 7) * 0.1);
    fs.writeFileSync(file, Buffer.from(x.buffer));
    const run = md5 => ({
      clip: {
        id: 'q/1_1',
        sourceAudio: file,
        mix: {track: 'none', snr: 0, offset: 0, gain: 0, scale: 1, md5},
      },
    });
    assert.deepEqual(audioOf(run(hashF32(x))), x);
    assert.throws(() => audioOf(run('0'.repeat(32))), /differs from the one the engine heard/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('each copy differs from its frozen original only in paths and imports', () => {
  const pairs = {
    'replay_marks.mjs': 'learners_built_replay.mjs',
    'chain.mjs': 'learners_built_chain.mjs',
    'judge_rows.mjs': 'learners_built_judge_rows.mjs',
    'eval_marks.mjs': 'learners_built_eval_marks.mjs',
  };
  const allowed =
    /^[-+]\s*(import\b|\} from |const BENCH = |`\.out\/|loadModel,$|sliceFrames,$|MIN_FRAMES,$|LEFT,$|FIRST_WITHIN,$)/;
  for (const [from, to] of Object.entries(pairs)) {
    const d = spawnSync('diff', ['-U0', path.join(LOOK, from), path.join(HERE, to)], {encoding: 'utf8'}).stdout;
    const changed = d
      .split('\n')
      .filter(l => /^[-+]/.test(l) && !/^(---|\+\+\+)/.test(l));
    assert.ok(changed.length > 0, from);
    for (const l of changed) assert.match(l, allowed, `${from}: ${l}`);
  }
});

test('jobsOf makes a suite\'s chains wait for both of its holds', () => {
  const j = jobsOf(['a', 'b']);
  assert.deepEqual(j.map(x => x.id), ['a:h48', 'a:h0', 'a:eval', 'b:h48', 'b:h0', 'b:eval']);
  assert.deepEqual(j[2].after, ['a:h48', 'a:h0']);
  assert.deepEqual(j[0].after, []);
  assert.deepEqual(j[0].args.slice(1), ['--suite', 'a', '--hold', '0.48']);
  assert.deepEqual(j[1].args.slice(3), ['--hold', '0']);
});

test('reading tells an interval that leaves out zero from one that does not', () => {
  assert.equal(reading({ci: {lo: 1, hi: 2}}), 'C');
  assert.equal(reading({ci: {lo: -2, hi: -1}}), 'C');
  assert.equal(reading({ci: {lo: -1, hi: 2}, twoWay: {lo: 0.1, hi: 1}}), 'T');
  assert.equal(reading({ci: {lo: -1, hi: 2}, twoWay: {lo: -0.1, hi: 1}}), 'I');
  assert.equal(reading({ci: {lo: 0, hi: 0}}), 'I');
  assert.equal(reading(undefined), '-');
});

test('stepsTable sums a pooled set over its conditions and false over both labels', () => {
  const cell = (kept, of) => ({kept, of});
  const chain = (h, fi, fc) => ({hit: h, near: cell(0, 0), 'false-incorrect': fi, 'false-correct': fc});
  const all = {'S1.none': 0, 'N1.P3': 0, 'J.P2': 0, 'S1.P3': 0, 'S1h0.none': 0, 'S1h0.P3': 0};
  const cond = (a, b) => Object.fromEntries(Object.keys(all).map(k => [k, chain(cell(a, 10), cell(b, 10), cell(1, 2))]));
  const T = {meta: {conditions: ['none_0', 'x_10', 'y_5']}, allChains: {none_0: cond(9, 9), x_10: cond(1, 2), y_5: cond(3, 4)}};
  const text = stepsTable(T, ['six voices', '10 dB', 'none_0']);
  assert.match(text, /\| six voices \| hits \| 4\/20 /);
  assert.match(text, /\| six voices \| false \| 8\/24 /);
  assert.match(text, /\| 10 dB \| hits \| 1\/10 /);
  assert.match(text, /\| none:0 \| false \| 10\/12 /);
});

// ------------------------------------------------------------------- the results, once they exist

const read = f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));

test('the parity gate held: every chain on every take, and every row', {skip: !fs.existsSync(path.join(OUT, 'parity.lb_parity.json'))}, () => {
  const p = read('parity.lb_parity.json');
  assert.equal(p.takes, 554);
  assert.equal(p.chains, 45);
  assert.equal(p.takesDiffering, 0);
  assert.equal(p.chainsDiffering, 0);
  assert.equal(p.otherFieldsDiffering, 0);
  for (const tag of ['h48', 'h0']) {
    assert.equal(p.rows[tag].differ, 0);
    assert.equal(p.rows[tag].onlyFrozen, 0);
    assert.equal(p.rows[tag].onlyMine, 0);
  }
  assert.equal(p.mineAgainstFrozenOnList.cells, 0);
  assert.equal(p.mineAgainstRuleKept.cells, 0);
  assert.equal(p.tableCopyAgainstRule.cells, 0);
});

test('the tables reproduce what they copy', {skip: !fs.existsSync(path.join(OUT, 'tables.json'))}, () => {
  const T = read('tables.json');
  if (T.meta.boot !== 2000) return;
  assert.equal(T.checks.olderAgainstReport.differ, 0);
  assert.equal(T.checks.editKinds.differ, 0);
  assert.equal(T.checks.cleanBase.same, T.checks.cleanBase.baseline);
  for (const c of T.meta.conditions) {
    assert.equal(T.checks.rowsAgainstRuleD[c].sliceDiffer, 0, c);
    assert.equal(T.checks.rowsAgainstRuleD[c].scoreDiffer, 0, c);
  }
  assert.deepEqual(T.checks.reproduceCheck.outside, []);
  assert.equal(T.checks.stopFlags.takesDiffering, 0);
  for (const c of T.meta.conditions) {
    const b = T.checks.baseAgainstRuleA[c];
    assert.deepEqual([b.onlyA, b.onlyJ, b.labelDiffer, b.ruleA === b.jNone], [{}, {}, 0, true], c);
    assert.deepEqual(Object.keys(T.checks.rowsAgainstRuleD[c].missingBy).filter(k => k !== 'lead'), [], c);
  }
  for (const [c, m] of Object.entries(read('mix_check.json'))) assert.equal(m.same, m.takes, c);
  assert.deepEqual(read('frozen_check.end.json').differ, []);
  // Table I of the independent check, on rule C.
  const part = x => `${x.kept}/${x.of}`;
  const want = {
    none_0: ['41/66', '5/21', '0/65'],
    '10 dB': ['89/148', '21/50', '24/133'],
    '5 dB': ['79/108', '24/39', '49/152'],
    'six voices': ['168/256', '45/89', '73/285'],
  };
  for (const [set, [hits, others, nobody]] of Object.entries(want)) {
    if (!T.split[set]) continue;
    const s = T.split[set].C;
    assert.equal(`${s.hitConsonant.kept + s.hitVowels.kept}/${s.hitConsonant.of + s.hitVowels.of}`, hits, set);
    assert.equal(part(s.falseOthersChanged), others, set);
    assert.equal(part(s.falseNobodyChanged), nobody, set);
  }
});
