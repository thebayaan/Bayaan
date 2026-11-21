// How a run goes through the corrected chain and the cancel step, on made-up runs, with the
// frozen copy of the mark rules and the judge's real policy code.
//   node --test scripts/second-look/tests/test_chain.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POLICIES,
  correctedRun,
  identified,
  junctionMark,
  keptWakes,
  quiet,
} from '../chain.mjs';
import {replay} from '../replay_marks.mjs';

const count = () => 50;
const log = [{t: 1, type: 'word_progress', key: '2:255', w: 0, n: 50}];
const make = vchanges => ({
  clip: {id: 'x', truth: {}},
  summary: {seconds: 30},
  log,
  vchanges,
  flags: [],
});
const v = (t, w, to, d = {gop: -8, distance: 0.5}, from = null) => ({
  t,
  id: `2:255:${w}`,
  from,
  to,
  d,
});
const row = (t, w, r, src = 'live') => [
  `2:255:${w}|${t}|${src}`,
  {run: 'x', id: `2:255:${w}`, t, src, slice: [t - 8, t + 0.48], r},
];
const says = {
  wrong: {expected: -9, nothing: -20, mut: [{a: 'a', s: -0.5}], near: []},
  absent: {expected: -15, nothing: -0.5, mut: [], near: []},
  fits: {expected: -1, nothing: -20, mut: [], near: []},
  neither: {expected: -5, nothing: -20, mut: [], near: []},
};

test('the Step policies are the frozen constants', () => {
  for (const P of [POLICIES.S1, POLICIES.S2]) {
    assert.equal(P.mut, 3);
    assert.equal(P.altFit, 1);
    assert.equal(P.fit, 2);
    assert.equal(P.absent, 10);
    assert.equal(P.passLock, false);
  }
  assert.equal(POLICIES.S1.wakeUnsure, false);
  assert.equal(POLICIES.S1.wakeOkGop, null);
  assert.equal(POLICIES.S2.wakeUnsure, true);
  assert.equal(POLICIES.S2.wakeOkGop, -1.5);
});

test('with no cancel step the replay gives the mark and its latest bad verdict', () => {
  const run = make([v(2, 3, 'wrong'), v(2.48, 4, 'ok', {gop: 0, distance: 0})]);
  const {visible} = replay(run, {mode: 'app', wordCount: count});
  const m = visible.get('2:255:3');
  assert.equal(m.shownAt, 2.5);
  assert.equal(m.lastBadAt, 2);
});

test('the cancel step at show time: the mark goes to noted, and is asked with t and due', () => {
  const run = make([v(2, 3, 'wrong'), v(2.48, 4, 'ok', {gop: 0, distance: 0})]);
  const asked = [];
  const {visible, book} = replay(run, {
    mode: 'app',
    wordCount: count,
    decide: q => {
      asked.push(q);
      return 'cancel';
    },
  });
  assert.equal(visible.has('2:255:3'), false);
  assert.equal(book.get('2:255:3').status, 'noted');
  assert.deepEqual(
    asked.map(q => [q.id, q.t, q.due]),
    [['2:255:3', 2, 2.5]],
  );
});

test('a cancelled word that goes bad again is asked again and may show', () => {
  const run = make([
    v(2, 3, 'wrong'),
    v(2.48, 4, 'ok', {gop: 0, distance: 0}),
    v(6, 3, 'wrong', {gop: -8, distance: 0.5}, 'wrong'),
    v(6.48, 5, 'ok', {gop: 0, distance: 0}),
  ]);
  const asked = [];
  const {visible} = replay(run, {
    mode: 'app',
    wordCount: count,
    decide: q => {
      asked.push(q.t);
      return q.t === 2 ? 'cancel' : 'keep';
    },
  });
  assert.deepEqual(asked, [2, 6]);
  assert.equal(visible.get('2:255:3').lastBadAt, 6);
  assert.equal(visible.get('2:255:3').since, 6);
});

test("the junction's 'said' acts only on a skipped verdict and is not a new verdict", () => {
  const run = make([
    v(2, 49, 'wrong', {distance: 0.5}),
    v(2.48, 49, 'wrong', {distance: 0.5, junctionMissing: false}, 'wrong'),
    v(2.96, 49, 'skipped', {distance: 1, junctionMissing: false}, 'wrong'),
    v(3.44, 48, 'wrong', {gop: -8, junctionMissing: false}, 'ok'),
  ]);
  const q = quiet(run).vchanges;
  assert.equal(q.length, 3);
  assert.deepEqual(
    q.map(c => [c.t, c.to, c.d.junctionMissing]),
    [
      [2, 'wrong', undefined],
      [2.96, 'skipped', false],
      [3.44, 'wrong', undefined],
    ],
  );
});

test("'said' does not cancel a changed last word the judge called wrong", () => {
  const run = make([
    v(2, 49, 'wrong', {distance: 0.5}),
    v(2.48, 49, 'wrong', {distance: 0.5, junctionMissing: false}, 'wrong'),
    {t: 2.96, id: '2:256:0', from: null, to: 'ok', d: {gop: 0, distance: 0}},
  ]);
  const rows = new Map([row(2, 49, says.wrong)]);
  const {run: out} = correctedRun(run, rows, 'S1', count);
  assert.equal(
    replay(out, {mode: 'app', wordCount: count}).visible.has('2:255:49'),
    true,
  );
});

test("the judge's answer counts from its verdict's time, so the next word's ok is credited", () => {
  const run = make([
    v(2, 49, 'wrong', {distance: 0.5}),
    {t: 2.48, id: '2:256:0', from: null, to: 'ok', d: {gop: 0, distance: 0}},
  ]);
  const rows = new Map([row(2, 49, says.wrong)]);
  const {run: out} = correctedRun(run, rows, 'S1', count);
  const m = replay(out, {mode: 'app', wordCount: count}).visible.get(
    '2:255:49',
  );
  assert.equal(m.since, 2);
  assert.equal(m.shownAt, 2.5);
});

test("a junction mark passes the judge's veto and the cancel step", () => {
  const fire = v(
    5,
    49,
    'skipped',
    {distance: 1, junctionMissing: true},
    'wrong',
  );
  const run = make([fire]);
  const rows = new Map([row(5, 49, says.fits)]);
  const {run: out, woke} = correctedRun(run, rows, 'S1', count);
  assert.equal(woke, 0);
  const asked = [];
  const {visible} = replay(out, {
    mode: 'app',
    wordCount: count,
    decide: q => {
      asked.push(q.id);
      return junctionMark(out, q.id, q.due) ? 'keep' : 'cancel';
    },
  });
  assert.equal(visible.get('2:255:49').kind, 'missed');
  assert.equal(junctionMark(out, '2:255:49', 5.1), true);
  assert.equal(junctionMark(out, '2:255:48', 5.1), false);
});

test('verdicts the filters drop never wake the judge and are not rewritten', () => {
  const lockLog = [
    {t: 1, type: 'word_progress', key: '2:255', w: 0, n: 50},
    {t: 2, type: 'debug', event: 'located', at: '2:255:3'},
  ];
  const burst = [];
  for (let i = 0; i < 12; i++)
    burst.push({
      t: 8,
      id: `${3 + (i % 3)}:1:${i}`,
      from: null,
      to: 'wrong',
      d: {gop: -8},
    });
  const run = {
    ...make([v(2, 3, 'wrong'), ...burst, v(9, 7, 'wrong')]),
    log: lockLog,
  };
  const rows = new Map([
    row(2, 3, says.fits),
    ...burst.map(c => [
      `${c.id}|8|live`,
      {run: 'x', id: c.id, t: 8, src: 'live', slice: [0, 8], r: says.fits},
    ]),
    row(9, 7, says.fits),
  ]);
  const kept = keptWakes(run);
  assert.equal(kept.has('2:255:3|2'), false);
  assert.equal(kept.has('3:1:0|8'), false);
  assert.equal(kept.has('2:255:7|9'), true);
  const {run: out, woke, changed} = correctedRun(run, rows, 'S1', count);
  assert.equal(woke, 1);
  assert.deepEqual(
    changed.map(c => c.id),
    ['2:255:7'],
  );
  assert.equal(out.vchanges[0].to, 'wrong');
});

test('Step 1 wakes on wrong and skipped, Step 2 also on unsure and on a low-gop or no-gop ok', () => {
  const run = make([
    v(2, 3, 'unsure', {distance: 0.3}),
    v(3, 4, 'ok', {gop: -1.5, distance: 0}),
    v(4, 5, 'ok', {gop: -1.4, distance: 0}),
    v(5, 0, 'ok', {gop: null, distance: 0.1}),
    v(6, 6, 'wrong'),
  ]);
  const rows = new Map([
    row(2, 3, says.neither),
    row(3, 4, says.neither),
    row(4, 5, says.neither),
    row(5, 0, says.neither),
    row(6, 6, says.neither),
  ]);
  assert.equal(correctedRun(run, rows, 'S1', count).woke, 1);
  assert.equal(correctedRun(run, rows, 'S2', count).woke, 4);
});

test('an answer of wrong or absent since the word became a suspect counts as identified', () => {
  const run = make([
    v(2, 3, 'wrong'),
    v(2.48, 3, 'wrong', {gop: -8}, 'wrong'),
    v(3, 7, 'wrong'),
    v(4, 9, 'wrong'),
    v(5, 11, 'wrong'),
  ]);
  const rows = new Map([
    row(2, 3, says.wrong),
    row(2.48, 3, says.neither),
    row(3, 7, says.neither),
    row(4, 9, says.absent),
    row(5, 11, says.fits),
  ]);
  const {run: out} = correctedRun(run, rows, 'S1', count);
  assert.equal(identified(out, '2:255:3', 2, 3), true);
  assert.equal(identified(out, '2:255:7', 3, 4), false);
  assert.equal(identified(out, '2:255:9', 4, 5), true);
  assert.equal(identified(out, '2:255:11', 5, 6), false);
  assert.equal(identified(out, '2:255:3', 2.2, 3), false);
});

test('without the veto a word the judge says fits stays a suspect; with it, it does not', () => {
  const run = make([v(2, 3, 'wrong'), v(2.48, 4, 'ok', {gop: 0, distance: 0})]);
  const rows = new Map([row(2, 3, says.fits)]);
  const seen = step =>
    replay(correctedRun(run, rows, step, count).run, {
      mode: 'app',
      wordCount: count,
    }).visible.has('2:255:3');
  assert.equal(seen('S1'), false);
  assert.equal(seen('N1'), true);
  assert.equal(seen('N2'), true);
});

test('the replay counts suspects, shown or not: they are what an early padded look would run on', () => {
  const run = make([
    v(2, 3, 'wrong'),
    v(2.48, 4, 'ok', {gop: 0, distance: 0}),
    v(8, 20, 'wrong'),
    v(8.48, 20, 'wrong', {gop: -8, distance: 0.5}, 'wrong'),
  ]);
  const {suspects, visible} = replay(run, {mode: 'app', wordCount: count});
  assert.equal(suspects, 2);
  assert.equal(visible.size, 1);
});
