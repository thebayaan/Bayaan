/* eslint-env node, es2020 */
// Scoring on made-up posteriors, where the right answer can be worked out by hand.
//   node --test judge/test_ctc.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeTo, prepare, scoreWord, scoreNothing, alignWords, BLANK, WORD} from './ctc.mjs';
import {tokensOf, judgeWord} from './judge.mjs';

const VOCAB = 31;
const SURE = Math.log(0.97);
const REST = Math.log(0.03 / 30);

/** Posteriors that say exactly these tokens, each for `hold` frames, with blanks. */
function say(tokens, hold = 2, gap = 1, pad = 2) {
  const seq = [];
  for (let i = 0; i < pad; i++) seq.push(BLANK);
  for (const t of tokens) {
    for (let i = 0; i < hold; i++) seq.push(t);
    for (let i = 0; i < gap; i++) seq.push(BLANK);
  }
  for (let i = 0; i < pad; i++) seq.push(BLANK);
  const logp = new Float32Array(seq.length * VOCAB).fill(REST);
  seq.forEach((k, t) => {
    logp[t * VOCAB + k] = SURE;
  });
  return {logp, frames: seq.length};
}

const join = words => {
  const out = [];
  words.forEach((w, i) => {
    if (i) out.push(WORD);
    out.push(...tokensOf(w));
  });
  return out;
};

function scoresOf(said, words, j, candidates) {
  const {logp, frames} = say(join(said));
  const rel = relativeTo(logp, frames);
  const left = [];
  for (const w of words.slice(Math.max(0, j - 2), j)) left.push(...tokensOf(w), WORD);
  const right = [];
  for (const w of words.slice(j + 1, j + 2)) right.push(WORD, ...tokensOf(w));
  const p = prepare(rel, frames, left, right);
  return candidates.map(c => scoreWord(p, tokensOf(c)));
}

test('the word said scores 0 and another word scores lower', () => {
  const [exp, alt] = scoresOf(['قال', 'نوح', 'رب'], ['قال', 'نوح', 'رب'], 1, ['نوح', 'لوط']);
  assert.ok(Math.abs(exp) < 1e-5, `${exp}`);
  assert.ok(alt < -5, `${alt}`);
});

test('a wrong word: the said alternative beats the expected word', () => {
  const [exp, alt] = scoresOf(['قال', 'لوط', 'رب'], ['قال', 'نوح', 'رب'], 1, ['نوح', 'لوط']);
  assert.ok(Math.abs(alt) < 1e-5, `${alt}`);
  assert.ok(exp < -5, `${exp}`);
});

test('a prefix is not free at the start of the text', () => {
  // Said فانك at the start of an ayah, expected انك: ف has no place to go.
  const [exp, alt] = scoresOf(['فانك', 'لمن'], ['انك', 'لمن'], 0, ['انك', 'فانك']);
  assert.ok(Math.abs(alt) < 1e-5, `${alt}`);
  assert.ok(exp < alt - 3, `${exp} ${alt}`);
});

test('a suffix is not free at the end of the text', () => {
  // Said عليهما last, expected عليه: ما has no place to go.
  const [exp, alt] = scoresOf(['سلم', 'عليهما'], ['سلم', 'عليه'], 1, ['عليه', 'عليهما']);
  assert.ok(Math.abs(alt) < 1e-5, `${alt}`);
  assert.ok(exp < alt - 3, `${exp} ${alt}`);
});

test('frames outside the text are free', () => {
  const [exp] = scoresOf(['من', 'قبل', 'قال', 'نوح', 'رب', 'انه', 'كان'], ['قال', 'نوح', 'رب'], 1, ['نوح']);
  assert.ok(Math.abs(exp) < 1e-5, `${exp}`);
});

test('the slice may cut the context on both sides', () => {
  // Starts inside قال and ends inside رب.
  const full = join(['قال', 'نوح', 'رب']);
  const {logp, frames} = say(full, 2, 1, 0);
  const VOC = VOCAB;
  const from = 6;
  const to = frames - 3;
  const cut = logp.slice(from * VOC, to * VOC);
  const rel = relativeTo(cut, to - from);
  const left = [...tokensOf('قال'), WORD];
  const right = [WORD, ...tokensOf('رب')];
  const p = prepare(rel, to - from, left, right);
  const s = scoreWord(p, tokensOf('نوح'));
  assert.ok(Math.abs(s) < 1e-5, `${s}`);
  assert.ok(scoreWord(p, tokensOf('لوط')) < -5);
});

test('a word left out: nothing here beats the expected word', () => {
  const {logp, frames} = say(join(['قال', 'رب']));
  const rel = relativeTo(logp, frames);
  const left = [...tokensOf('قال'), WORD];
  const right = [WORD, ...tokensOf('رب')];
  const p = prepare(rel, frames, left, right);
  assert.ok(Math.abs(scoreNothing(p)) < 1e-5, `${scoreNothing(p)}`);
  assert.ok(scoreWord(p, tokensOf('نوح')) < -5);
});

test('a doubled letter across a repeat needs its blank', () => {
  const tokens = tokensOf('ابب');
  const {logp, frames} = say(tokens, 2, 1, 1);
  const rel = relativeTo(logp, frames);
  const p = prepare(rel, frames, [], []);
  assert.ok(Math.abs(scoreWord(p, tokens)) < 1e-5);
  // One ب only: the second burst has no token to go to.
  assert.ok(scoreWord(p, tokensOf('اب')) < -3);
});

test('alignment gives each word its frames', () => {
  const {logp, frames} = say(join(['قال', 'رب']), 2, 1, 2);
  const rel = relativeTo(logp, frames);
  const out = alignWords(rel, frames, [tokensOf('قال'), tokensOf('رب')]);
  assert.equal(out[0].start, 2);
  // Three letters of 2+1 frames: last token frame is 2 + 3*2 + 1 = 9.
  assert.equal(out[0].end, 9);
  assert.equal(out[1].start, 14);
  assert.equal(out[1].end, 18);
  assert.ok(Math.abs(out.score) < 1e-5);
});

test('judgeWord names the best alternative', () => {
  const {logp, frames} = say(join(['قال', 'لوط', 'رب']));
  const r = judgeWord(logp, frames, ['قال', 'نوح', 'رب'], 1, {mut: ['لوط', 'هود'], near: ['نوح']}, {});
  assert.equal(r.mut[0].a, 'لوط');
  assert.ok(r.mut[0].s > r.expected + 5);
});

test('an ayah\'s first word must come early in the slice', () => {
  // The word is said only well into the slice, after another word.
  const {logp, frames} = say(join(['لكنا', 'عباد', 'الا', 'نوح']), 3, 1, 2);
  const words = ['الا', 'عباد'];
  const free = judgeWord(logp, frames, words, 0, {mut: [], near: []}, {rightWords: 0, firstWithin: frames});
  const near = judgeWord(logp, frames, words, 0, {mut: [], near: []}, {rightWords: 0, firstWithin: 4});
  assert.ok(Math.abs(free.expected) < 1e-3, `${free.expected}`);
  assert.ok(near.expected < -5, `${near.expected}`);
});

test('no word here: said, it loses; left out, it wins, with no right context asked', () => {
  const words = ['قال', 'نوح', 'رب', 'انه'];
  const said = say(join(['قال', 'نوح', 'رب', 'انه']));
  const out = say(join(['قال', 'رب', 'انه']));
  const opts = {leftWords: 1, rightWords: 0};
  const a = judgeWord(said.logp, said.frames, words, 1, {mut: [], near: []}, opts);
  const b = judgeWord(out.logp, out.frames, words, 1, {mut: [], near: []}, opts);
  assert.ok(Math.abs(a.expected) < 1e-3 && a.nothing < -5, JSON.stringify(a));
  assert.ok(Math.abs(b.nothing) < 1e-3 && b.expected < -5, JSON.stringify(b));
});

test('no word at the end of the text: only blanks may follow', () => {
  const words = ['قال', 'نوح'];
  const said = say(join(['قال', 'نوح']));
  const a = judgeWord(said.logp, said.frames, words, 1, {mut: [], near: []}, {leftWords: 1, rightWords: 0});
  assert.ok(a.nothing < -5, JSON.stringify(a));
});
