/* eslint-env node, es2020 */
//   node --test judge/test_policy.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPolicy, answer, woken, DEFAULTS} from './policy.mjs';

const P = {...DEFAULTS, mut: 8, near: 12, fit: 2, altFit: 1};
const row = (expected, mut, near = null, nothing = -100) => ({
  r: {
    expected,
    nothing,
    mut: mut === null ? [] : [{a: 'x', s: mut}],
    near: near === null ? [] : [{a: 'y', s: near}],
  },
});
const count = () => 5;
const run = (changes, flush) => ({
  summary: {seconds: 10},
  vchanges: changes,
  ...(flush ? {flush: {verdicts: flush}} : {}),
});

test('answer: an alternative must beat the word by its own margin', () => {
  assert.equal(answer(row(-10, -1), P), 'wrong');
  assert.equal(answer(row(-8, -0.5), P), 'neither');
  assert.equal(answer(row(-1, -3), P), 'fits');
  assert.equal(answer(row(-20, null, -1), P), 'wrong');
  assert.equal(answer(row(-12, null, -1), P), 'neither');
});

test('answer: an alternative that does not fit the audio itself is no answer', () => {
  // Far ahead of the expected word, yet nothing like what was said.
  assert.equal(answer(row(-40, -7), P), 'neither');
  assert.equal(answer(row(-40, -1), P), 'wrong');
  assert.equal(answer(row(-40, null, -2), P), 'neither');
  assert.equal(answer(row(-40, -2), {...P, altFit: 3}), 'wrong');
});

test('a skipped word with another word standing there is a wrong word', () => {
  const rows = new Map([['1:1:2|5|live', row(-20, -0.5)]]);
  const out = applyPolicy(run([{id: '1:1:2', t: 5, to: 'skipped', d: {gop: -9}}]), rows, P, count);
  assert.equal(out.run.vchanges[0].to, 'wrong');
  assert.equal(out.run.vchanges[0].d.judged, true);
});

test('an unsure word the judge calls wrong becomes a confirmed slip', () => {
  const rows = new Map([['1:1:2|5|live', row(-10, -1)]]);
  const out = applyPolicy(run([{id: '1:1:2', t: 5, to: 'unsure', d: {distance: 0.2}}]), rows, P, count);
  assert.equal(out.run.vchanges[0].to, 'wrong');
  assert.equal(out.run.vchanges[0].d.judged, true);
  assert.equal(out.woke, 1);
});

test('an unsure word the judge lets pass stays as it was', () => {
  const rows = new Map([['1:1:2|5|live', row(-3, -2)]]);
  const c = {id: '1:1:2', t: 5, to: 'unsure', d: {distance: 0.2}};
  const out = applyPolicy(run([c]), rows, P, count);
  assert.equal(out.run.vchanges[0], c);
});

test('an ok word wakes the judge only under the gop cut', () => {
  assert.equal(woken('ok', {gop: -2.9}, 'interior', P), false);
  assert.equal(woken('ok', {gop: -3}, 'interior', P), true);
  assert.equal(woken('ok', {distance: 0}, 'first', P), false);
  assert.equal(woken('ok', {distance: 0.1}, 'first', P), true);
  assert.equal(woken('ok', {gop: -9}, 'interior', {...P, wakeOkGop: null}), false);
});

test('edge verdicts: a confirmed wrong word passes, others stay', () => {
  const rows = new Map([
    ['1:1:4|5|live', row(-30, -1)],
    ['1:1:3|6|live', row(-1, -9)],
  ]);
  const out = applyPolicy(
    run([
      {id: '1:1:4', t: 5, to: 'wrong', d: {}},
      {id: '1:1:3', t: 6, to: 'wrong', d: {}},
    ]),
    rows,
    P,
    count,
  );
  assert.equal(out.run.vchanges[0].d.judged, true);
  assert.equal(out.run.vchanges[1].d, out.run.vchanges[1].d);
  assert.equal(out.run.vchanges[1].to, 'wrong');
  assert.equal(out.run.vchanges[1].judge, undefined);
});

test('veto and confirm take back a wrong word', () => {
  const rows = new Map([['1:1:2|5|live', row(-1, -9)]]);
  const c = [{id: '1:1:2', t: 5, to: 'wrong', d: {}}];
  assert.equal(applyPolicy(run(c), rows, {...P, vetoWrong: true}, count).run.vchanges[0].to, 'unsure');
  assert.equal(applyPolicy(run(c), rows, {...P, requireConfirm: true}, count).run.vchanges[0].to, 'unsure');
  assert.equal(applyPolicy(run(c), rows, P, count).run.vchanges[0].to, 'wrong');
});

test('flush verdicts are read at the end of the audio, only newly judged ones', () => {
  const rows = new Map([
    ['1:1:4|10|flush', row(-30, -1)],
    ['1:1:3|10|flush', row(-30, -1)],
  ]);
  const out = applyPolicy(
    run([], [
      {id: '1:1:4', state: 'unsure', newly: true, d: {distance: 0.3}},
      {id: '1:1:3', state: 'unsure', newly: false, d: {distance: 0.3}},
    ]),
    rows,
    P,
    count,
  );
  assert.equal(out.run.flush.verdicts[0].state, 'wrong');
  assert.equal(out.run.flush.verdicts[1].state, 'unsure');
});

test('stop-time and pending changes are never touched', () => {
  const rows = new Map([['1:1:2|5|live', row(-30, -1)]]);
  const c = [
    {id: '1:1:2', t: 5, to: 'pending'},
    {id: '1:1:2', t: 5, to: 'unsure', stop: true, d: {}},
  ];
  const out = applyPolicy(run(c), rows, P, count);
  assert.equal(out.run.vchanges[0], c[0]);
  assert.equal(out.run.vchanges[1], c[1]);
});

test('no word here: a wrong or skipped word the judge hears as absent is a skip', () => {
  const rows = new Map([
    ['1:1:0|5|live', row(-20, null, null, -0.5)],
    ['1:1:2|6|live', row(-20, null, null, -0.5)],
  ]);
  const Q = {...P, absent: 8};
  const out = applyPolicy(
    run([
      {id: '1:1:0', t: 5, to: 'wrong', d: {}},
      {id: '1:1:2', t: 6, to: 'unsure', d: {}},
    ]),
    rows,
    Q,
    count,
  );
  assert.equal(out.run.vchanges[0].to, 'skipped');
  assert.equal(out.run.vchanges[0].d.judged, true);
  // Unsure stays: a skip needs the engine to have called the word bad.
  assert.equal(out.run.vchanges[1].to, 'unsure');
});

test('veto of a skipped word needs the expected word to fit', () => {
  const rows = new Map([
    ['1:1:2|5|live', row(0, null, null, 0)],
    ['1:1:3|6|live', row(-9, null, null, -1)],
  ]);
  const Q = {...P, vetoSkipped: true};
  const out = applyPolicy(
    run([
      {id: '1:1:2', t: 5, to: 'skipped', d: {}},
      {id: '1:1:3', t: 6, to: 'skipped', d: {}},
    ]),
    rows,
    Q,
    count,
  );
  assert.equal(out.run.vchanges[0].to, 'unsure');
  assert.equal(out.run.vchanges[1].to, 'skipped');
});
