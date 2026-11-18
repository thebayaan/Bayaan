// The selection rule, fixed before any candidate's results were read.
//   node --test scripts/second-look/tests/test_select.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {bestOf, chooseWinner, failures} from '../select.mjs';

const cand = (slips, pool, w1, voices) => ({slips, pool, w1, voices});
const w1 = (interior, last, first, close) => ({interior, last, first, close});
const base = {
  P1: cand(20, 4, w1(70, 80, 60, 50), {one_ar_10: 10, crowd_5: 20}),
  P2: cand(40, 5, w1(70, 79, 59, 50), {one_ar_10: 11, crowd_5: 21}),
  P3: cand(38, 6, w1(70, 79, 59, 50), {one_ar_10: 11, crowd_5: 22}),
  P4: cand(38, 6, w1(70, 80, 60, 50), {one_ar_10: 11, crowd_5: 22}),
};

test('each measure has its own best across the candidates', () => {
  const best = bestOf(base);
  assert.equal(best.slips, 40);
  assert.equal(best.pool, 4);
  assert.deepEqual(best.w1, {interior: 70, last: 80, first: 60, close: 50});
  assert.deepEqual(best.voices, {one_ar_10: 10, crowd_5: 20});
});

test('the limits are inclusive: exactly at the limit passes', () => {
  const best = bestOf(base);
  assert.deepEqual(failures(base.P4, best), []);
  assert.deepEqual(
    failures(
      cand(37, 6, w1(69, 79, 59, 49), {one_ar_10: 11, crowd_5: 22}),
      best,
    ),
    [],
  );
});

test('past any one limit fails, and says which', () => {
  const best = bestOf(base);
  assert.deepEqual(
    failures(
      cand(36, 6, w1(70, 80, 60, 50), {one_ar_10: 11, crowd_5: 22}),
      best,
    ),
    ['slips 36 against 40'],
  );
  assert.deepEqual(
    failures(
      cand(40, 7, w1(70, 80, 60, 50), {one_ar_10: 11, crowd_5: 22}),
      best,
    ),
    ['pool 7 against 4'],
  );
  assert.deepEqual(
    failures(
      cand(40, 4, w1(70, 78.9, 60, 50), {one_ar_10: 11, crowd_5: 22}),
      best,
    ),
    ['W1 last 78.9 against 80'],
  );
  assert.deepEqual(
    failures(
      cand(40, 4, w1(70, 80, 60, 50), {one_ar_10: 11.1, crowd_5: 22}),
      best,
    ),
    ['voices one_ar_10 11.1 against 10'],
  );
});

test('the winner is the first in the order that passes: P4, then P3, then P2', () => {
  assert.equal(chooseWinner(base).winner, 'P4');
  const noP4 = {...base, P4: {...base.P4, slips: 30}};
  assert.equal(chooseWinner(noP4).winner, 'P3');
  const noP3 = {...noP4, P3: {...base.P3, w1: w1(60, 80, 60, 50)}};
  assert.equal(chooseWinner(noP3).winner, 'P2');
  const none = {...noP3, P2: {...base.P2, pool: 9}};
  assert.equal(chooseWinner(none).winner, null);
});

test('P1 sets bests but is not itself a choice', () => {
  const only = {
    P1: cand(40, 1, w1(70, 80, 60, 50), {one_ar_10: 10}),
    P2: cand(30, 1, w1(70, 80, 60, 50), {one_ar_10: 10}),
    P3: cand(30, 1, w1(70, 80, 60, 50), {one_ar_10: 10}),
    P4: cand(30, 1, w1(70, 80, 60, 50), {one_ar_10: 10}),
  };
  assert.equal(chooseWinner(only).winner, null);
});

test('hold 0 is judged by the same limits against the same bests', () => {
  const {best} = chooseWinner(base);
  assert.deepEqual(failures(base.P4, best), []);
  assert.deepEqual(
    failures(
      cand(38, 7, w1(70, 80, 60, 50), {one_ar_10: 11, crowd_5: 22}),
      best,
    ),
    ['pool 7 against 4'],
  );
});

test('when none stands, the fewest limits missed picks, and the order breaks a tie', () => {
  const none = {
    P1: cand(40, 1, w1(70, 80, 60, 50), {a: 10, b: 10}),
    P2: cand(30, 1, w1(70, 80, 60, 50), {a: 20, b: 20}),
    P3: cand(38, 1, w1(70, 80, 60, 50), {a: 20, b: 10}),
    P4: cand(38, 1, w1(70, 80, 60, 50), {a: 20, b: 20}),
  };
  const r = chooseWinner(none);
  assert.equal(r.winner, null);
  assert.equal(r.closest, 'P3');
  const tie = {...none, P4: {...none.P3}};
  assert.equal(chooseWinner(tie).closest, 'P4');
});

test('the limit on voices can be read against what today shows instead of the best', () => {
  const best = bestOf(base);
  const c = cand(40, 4, w1(70, 80, 60, 50), {one_ar_10: 12, crowd_5: 25});
  assert.equal(failures(c, best).length, 2);
  assert.deepEqual(failures(c, best, {one_ar_10: 30, crowd_5: 40}), [
    'voices crowd_5 25 against 20',
  ]);
});
