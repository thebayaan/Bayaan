// What each candidate does with a mark that falls due, and what it costs in model runs.
//   node --test scripts/second-look/tests/test_cancel.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIGS, decideCancel} from '../cancel.mjs';
import {liveWakes} from '../chain.mjs';

const clean = {perLetter: -1, gap: 5, padded: true};
const slip = {perLetter: -1, gap: -4, padded: true};
const far = {perLetter: -7, gap: null, padded: false};
const mid = {perLetter: -3, gap: 5, padded: true};
const q = {kind: 'wrong'};
const go = (cancel, over = {}) =>
  decideCancel(cancel, q, {junction: false, identified: false, ...over});

test('no cancel step: keep, no runs', () => {
  assert.deepEqual(go('none'), {ans: 'keep', x: 0, need: null});
});

test('P1, the rule now in the app: one run, cancelled above -2 per letter', () => {
  assert.deepEqual(go('P1'), {ans: 'keep', x: 0, need: 'ship'});
  assert.deepEqual(go('P1', {ship: clean}), {ans: 'cancel', x: 1, need: null});
  assert.deepEqual(go('P1', {ship: mid}), {ans: 'keep', x: 1, need: null});
});

test('P2, the letter-slip rule on its own slice: its first pass, then a padded run', () => {
  assert.deepEqual(go('P2'), {ans: 'keep', x: 0, need: 'ship'});
  assert.deepEqual(go('P2', {ship: clean}), {ans: 'cancel', x: 2, need: null});
  assert.deepEqual(go('P2', {ship: slip}), {ans: 'keep', x: 2, need: null});
  assert.deepEqual(go('P2', {ship: far}), {ans: 'keep', x: 1, need: null});
});

test("P3, on the judge's own first pass: a padded run at most", () => {
  assert.deepEqual(go('P3'), {ans: 'keep', x: 0, need: 'judge'});
  assert.deepEqual(go('P3', {judge: clean}), {ans: 'cancel', x: 1, need: null});
  assert.deepEqual(go('P3', {judge: slip}), {ans: 'keep', x: 1, need: null});
  assert.deepEqual(go('P3', {judge: far}), {ans: 'keep', x: 0, need: null});
});

test('P4 skips the cancel step on a word the judge identified', () => {
  assert.deepEqual(go('P4', {identified: true}), {
    ans: 'keep',
    x: 0,
    need: null,
  });
  assert.deepEqual(go('P4', {judge: clean}), {ans: 'cancel', x: 1, need: null});
  assert.deepEqual(go('P4', {identified: true, judge: clean}), {
    ans: 'keep',
    x: 0,
    need: null,
  });
});

test('junction marks pass every candidate with no run', () => {
  for (const c of ['P1', 'P2', 'P3', 'P4', 'P2s', 'P3s', 'P4s']) {
    assert.deepEqual(go(c, {junction: true, ship: clean, judge: clean}), {
      ans: 'keep',
      x: 0,
      need: null,
    });
  }
});

test('the phone switch: skipped marks only leaves other marks alone, with no padded run', () => {
  for (const c of ['P2s', 'P3s', 'P4s']) {
    assert.deepEqual(go(c, {ship: clean, judge: clean}), {
      ans: 'keep',
      x: 0,
      need: null,
    });
    const missed = decideCancel(
      c,
      {kind: 'missed'},
      {junction: false, identified: false, ship: clean, judge: clean},
    );
    assert.equal(missed.ans, 'cancel');
  }
  const identified = decideCancel(
    'P4s',
    {kind: 'missed'},
    {junction: false, identified: true, judge: clean},
  );
  assert.equal(identified.ans, 'keep');
});

test('a failure shows the mark and costs what ran', () => {
  const failed = {failed: 'short'};
  assert.deepEqual(go('P1', {ship: failed}), {ans: 'keep', x: 0, need: null});
  assert.deepEqual(go('P2', {ship: failed}), {ans: 'keep', x: 0, need: null});
  assert.deepEqual(go('P3', {judge: failed}), {ans: 'keep', x: 0, need: null});
});

test('the configs cover each step and hold', () => {
  const names = CONFIGS.map(c => c.name);
  for (const j of ['S1', 'S1h0', 'S2', 'S2h0']) {
    for (const c of ['none', 'P1', 'P2', 'P3', 'P4', 'P2s', 'P3s', 'P4s'])
      assert.ok(names.includes(`${j}.${c}`), `${j}.${c}`);
  }
  for (const c of ['J.none', 'J.P1', 'J.P2']) assert.ok(names.includes(c), c);
  for (const j of ['N1', 'N2']) {
    for (const c of ['none', 'P1', 'P2', 'P3', 'P4'])
      assert.ok(names.includes(`${j}.${c}`), `${j}.${c}`);
  }
});

test('live wakes: after the filters, one slice shared by words of the same chunk counts once', () => {
  const log = [{t: 1, type: 'word_progress', key: '2:255', w: 0, n: 50}];
  const run = {
    clip: {id: 'x', truth: {}},
    summary: {seconds: 30},
    log,
    flags: [],
    vchanges: [
      {t: 2, id: '2:255:3', to: 'wrong', d: {gop: -8}},
      {t: 2, id: '2:255:4', to: 'skipped', d: {gop: -8}},
      {t: 3, id: '2:255:5', to: 'unsure', d: {distance: 0.4}},
      {t: 4, id: '2:255:6', to: 'ok', d: {gop: 0, distance: 0}},
    ],
  };
  const row = (t, w, slice) => [
    `2:255:${w}|${t}|live`,
    {run: 'x', id: `2:255:${w}`, t, src: 'live', slice, r: {}},
  ];
  const rows = new Map([
    row(2, 3, [0, 2.48]),
    row(2, 4, [0, 2.48]),
    row(3, 5, [0, 3.48]),
    row(4, 6, [0, 4.48]),
  ]);
  const count = () => 50;
  assert.deepEqual(liveWakes(run, rows, 'S1', count), {wakes: 2, slices: 1});
  assert.deepEqual(liveWakes(run, rows, 'S2', count), {wakes: 3, slices: 2});
});
