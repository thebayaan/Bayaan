/* eslint-env node, es2020 */
// Tests the junction check's alignment and decision on small made-up posteriors.
//
//   node --test natural/junction/test_check.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {BENCH, encode, forcedLocal, junctionTest, loadCorpus} from './llr.mjs';

const CLASSES = 251;
const BLANK = 250;

/** Frames where each listed token is near certain, in order, with blanks between. */
function posteriors(tokens, {lead = 3, gap = 2, tail = 3} = {}) {
  const frames = [];
  const push = id => {
    const row = new Float32Array(CLASSES).fill(-12);
    row[id] = -0.01;
    frames.push(row);
  };
  for (let i = 0; i < lead; i++) push(BLANK);
  for (const id of tokens) {
    push(id);
    for (let i = 0; i < gap; i++) push(BLANK);
  }
  for (let i = 0; i < tail; i++) push(BLANK);
  return {
    firstFrame: 0,
    lastFrame: frames.length,
    has: (a, b) => a >= 0 && b <= frames.length && a <= b,
    logp: (t, id) => frames[t][id],
    bestLogp: t => Math.max(...frames[t]),
    argmax: t => frames[t].indexOf(Math.max(...frames[t])),
    length: frames.length,
  };
}

test('a local fit finds the hypothesis anywhere and costs nothing outside it', () => {
  const a = 10;
  const b = 20;
  const c = 30;
  const post = posteriors([5, 6, a, b, c, 7, 8]);
  assert.ok(forcedLocal(post, [a, b, c], 0, post.length) > -0.2);
});

test('a local fit charges a token that is not there', () => {
  const post = posteriors([10, 20, 30]);
  const got = forcedLocal(post, [10, 99, 30], 0, post.length);
  assert.ok(got < -5, String(got));
});

test('a local fit keeps order', () => {
  const post = posteriors([10, 20, 30]);
  const got = forcedLocal(post, [30, 10], 0, post.length);
  assert.ok(got < -5, String(got));
});

const corpus = loadCorpus();
// An ayah's last word and the words around it, by the engine's numbers.
const L = corpus.ayahFirstWord(2, 158) + corpus.ayahWordCount(2, 158) - 1;
const ids = g => encode(corpus.wordPhonemes(g));

test('the word numbers are the ones the check is told', () => {
  assert.equal(corpus.wordSurah[L], 2);
  assert.equal(corpus.wordAyah[L], 158);
  assert.equal(corpus.wordInAyah[L], corpus.ayahWordCount(2, 158) - 1);
  assert.equal(corpus.wordAyah[L + 1], 159);
  assert.equal(corpus.wordInAyah[L + 1], 0);
});

test('llr is high when the last word was said', () => {
  const post = posteriors([...ids(L - 1), ...ids(L), ...ids(L + 1)]);
  const got = junctionTest(corpus, post, L - 1, L, 0, post.length);
  assert.ok(got.llr > 3, String(got.llr));
});

test('llr is low and the other hypothesis fits when it was left out', () => {
  const post = posteriors([...ids(L - 1), ...ids(L + 1)]);
  const got = junctionTest(corpus, post, L - 1, L, 0, post.length);
  assert.ok(got.llr < -5, String(got.llr));
  assert.ok(got.s0 > -1, String(got.s0));
});

test('the other hypothesis does not fit while the last word is being said', () => {
  const half = ids(L).slice(0, Math.ceil(ids(L).length / 2));
  const post = posteriors([...ids(L - 1), ...half]);
  const got = junctionTest(corpus, post, L - 1, L, 0, post.length);
  assert.ok(got.s0 < -4, String(got.s0));
});

test('h1 is left out when the caller does not need it', () => {
  const post = posteriors([...ids(L - 1), ...ids(L), ...ids(L + 1)]);
  const got = junctionTest(corpus, post, L - 1, L, 0, post.length, () => false);
  assert.equal(got.llr, null);
});

test('bench root is where the tools expect it', () => {
  assert.ok(BENCH.endsWith('recitation-bench'));
});
