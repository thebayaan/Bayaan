// The cancel step's rule on made-up posteriors. Real scoring code, no model.
//   node --test scripts/second-look/tests/test_rule.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANCEL,
  cancelAnswer,
  firstPass,
  innerGap,
  needsPaddedLook,
  paddedCut,
  shippedAnswer,
} from '../rule.mjs';
import {tokensOf} from '../../recitation-bench/judge/judge.mjs';

const VOCAB = 31;
const BLANK = 0;
const WORD = 30;

/** Frames that spell these tokens clearly: each token 3 frames, a blank between. */
function spell(tokens, {head = 2, tail = 2} = {}) {
  const seq = [];
  for (let i = 0; i < head; i++) seq.push(BLANK);
  for (const t of tokens) {
    seq.push(t, t, t, BLANK);
  }
  for (let i = 0; i < tail; i++) seq.push(BLANK);
  const logp = new Float32Array(seq.length * VOCAB).fill(-12);
  seq.forEach((t, i) => {
    logp[i * VOCAB + t] = -0.001;
  });
  return {logp, frames: seq.length};
}

const word = 'جعلنا';
const tokens = tokensOf(word);
const other = tokensOf('ب')[0];

test('the frozen constants are the ones measured, and may not be tuned here', () => {
  assert.equal(CANCEL.keepFirstPerLetter, -6);
  assert.equal(CANCEL.keepGap, -3.34);
  assert.equal(CANCEL.marginSeconds, 0.3);
  assert.equal(CANCEL.silenceSeconds, 1);
});

test('a word said as written: no spelling beats it', () => {
  const {logp, frames} = spell(tokens);
  const gap = innerGap(logp, frames, tokens);
  assert.ok(gap > 10, `gap ${gap}`);
  assert.equal(cancelAnswer({first: -1, gap}), 'cancel');
});

test('an inner letter changed: that spelling wins by more than the bar', () => {
  const said = [...tokens];
  said[2] = other;
  const {logp, frames} = spell(said);
  const gap = innerGap(logp, frames, tokens);
  assert.ok(gap <= CANCEL.keepGap, `gap ${gap}`);
  assert.equal(cancelAnswer({first: -1, gap}), 'keep');
});

test('only inner letters count: a changed first or last letter does not keep the mark', () => {
  for (const at of [0, tokens.length - 1]) {
    const said = [...tokens];
    said[at] = other;
    const {logp, frames} = spell(said);
    const gap = innerGap(logp, frames, tokens);
    assert.ok(gap > CANCEL.keepGap, `letter ${at}: gap ${gap}`);
  }
});

test('a word under three letters has no inner letter, so no padded look is run', () => {
  const short = tokensOf('من');
  const {logp, frames} = spell(short);
  assert.equal(innerGap(logp, frames, short), null);
  assert.equal(needsPaddedLook(-1, short.length), false);
  assert.equal(needsPaddedLook(-1, 3), true);
  assert.equal(cancelAnswer({first: -1, gap: null}), 'cancel');
  assert.equal(cancelAnswer({first: -6.5, gap: null}), 'keep');
});

test('at or below -6 per letter the mark stays with no padded look', () => {
  assert.equal(needsPaddedLook(-6, 5), false);
  assert.equal(needsPaddedLook(-5.99, 5), true);
  assert.equal(cancelAnswer({first: -6, gap: null}), 'keep');
  assert.equal(cancelAnswer({first: -5.99, gap: -3.34}), 'keep');
  assert.equal(cancelAnswer({first: -5.99, gap: -3.33}), 'cancel');
});

test('any failure shows the mark', () => {
  assert.equal(cancelAnswer({first: null, gap: null}), 'keep');
  assert.equal(shippedAnswer(null), 'keep');
});

test("the judge's positive answer skips the cancel step only when asked", () => {
  assert.equal(
    cancelAnswer({first: -1, gap: 5, identified: true, skipIdentified: true}),
    'keep',
  );
  assert.equal(
    cancelAnswer({first: -1, gap: 5, identified: true, skipIdentified: false}),
    'cancel',
  );
  assert.equal(
    cancelAnswer({first: -1, gap: 5, identified: false, skipIdentified: true}),
    'cancel',
  );
});

test('the rule now in the app cancels above -2 per letter, strictly', () => {
  assert.equal(shippedAnswer(-1.99), 'cancel');
  assert.equal(shippedAnswer(-2), 'keep');
  assert.equal(shippedAnswer(-3), 'keep');
});

test('the padded cut: the word +-0.3 s with 1 s of digital silence each side', () => {
  const SR = 16000;
  const audio = new Float32Array(10 * SR).fill(0.5);
  const p = paddedCut(audio, 2, 3, 10 * SR);
  assert.equal(p.length, Math.ceil(3.3 * SR) - Math.floor(1.7 * SR) + 2 * SR);
  assert.equal(p[SR - 1], 0);
  assert.equal(p[SR], 0.5);
  assert.equal(p[p.length - SR - 1], 0.5);
  assert.equal(p[p.length - SR], 0);
});

test('the padded cut stops at what has been heard and at the audio ends', () => {
  const SR = 16000;
  const audio = new Float32Array(10 * SR).fill(0.5);
  const held = paddedCut(audio, 2, 3, 3 * SR);
  assert.equal(held.length, 3 * SR - Math.floor(1.7 * SR) + 2 * SR);
  const start = paddedCut(audio, 0.1, 1, 10 * SR);
  assert.equal(start.length, Math.ceil(1.3 * SR) + 2 * SR);
  assert.equal(paddedCut(audio, 2, 2.1, 1.75 * SR), null);
});

test('the first pass finds the word in its context and in its ayah', () => {
  const left = tokensOf('قال');
  const seq = [...left, WORD, ...tokens, WORD, ...tokensOf('رب')];
  const {logp, frames} = spell(seq);
  const words = ['قال', word, 'رب'];
  const a = firstPass(logp, frames, words, 1, {leftWords: 2, rightWords: 1});
  assert.ok(a.expected > -0.1, `expected ${a.expected}`);
  assert.equal(a.perLetter, a.expected / tokens.length);
  // Head 2 frames, 3 left letters and the separator at 4 frames each.
  assert.equal(a.startFrame, 2 + 4 * 4);
  assert.equal(a.endFrame, 2 + 4 * 4 + 4 * tokens.length - 1 - 1);
  const b = firstPass(logp, frames, words, 1, {leftWords: 2, rightWords: 0});
  assert.ok(b.expected > -0.1, `expected ${b.expected}`);
});

test("the first pass keeps an ayah's first word near the slice's start when told to", () => {
  // 80 frames of other speech before the word: blanks there would cost nothing.
  const speech = Array.from({length: 20}, () => other);
  const {logp, frames} = spell([...speech, WORD, ...tokens]);
  const words = [word, 'رب'];
  const free = firstPass(logp, frames, words, 0, {leftWords: 2, rightWords: 0});
  const held = firstPass(logp, frames, words, 0, {
    leftWords: 2,
    rightWords: 0,
    firstWithin: 50,
  });
  assert.ok(free.expected > -0.1, `free ${free.expected}`);
  assert.ok(held.expected < -5, `held ${held.expected}`);
});
