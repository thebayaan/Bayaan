/* eslint-env es2020 */
// The second judge's verdict on one word, from one slice's log-probabilities and
// the official text. Plain JavaScript with no Node or browser API.
import {relativeTo, prepare, scoreWord, scoreNothing, WORD} from './ctc.mjs';

const ALPHABET = 'ءابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const ID = new Map([...ALPHABET].map((c, i) => [c, i + 1]));
/** An ayah's first word must begin within this many model frames of the slice's
 *  start: 2 s, which covers how far the slice's start can miss the ayah's. */
export const FIRST_WITHIN = 50;

export function tokensOf(letters) {
  const out = [];
  for (const c of letters) {
    const id = ID.get(c);
    if (id === undefined) throw new Error(`not in the alphabet: ${c}`);
    out.push(id);
  }
  return out;
}

/**
 * @param {Float32Array} logp [frames, 31]
 * @param {number} frames
 * @param {string[]} words the ayah's words as letters
 * @param {number} j the word in question
 * @param {{mut: string[], near: string[]}} alts alternatives, as letters
 * @param {{leftWords: number, rightWords: number, top: number, firstWithin: number}} opts
 */
export function judgeWord(logp, frames, words, j, alts, opts) {
  const {leftWords = 2, rightWords = 1, top = 3, firstWithin = FIRST_WITHIN} = opts ?? {};
  const rel = relativeTo(logp, frames);
  const left = [];
  for (let i = Math.max(0, j - leftWords); i < j; i++) {
    left.push(...tokensOf(words[i]), WORD);
  }
  const rightOf = n => {
    const out = [];
    for (let i = j + 1; i <= Math.min(words.length - 1, j + n); i++) {
      out.push(WORD, ...tokensOf(words[i]));
    }
    return out;
  };
  const place = {firstWithin};
  const p = prepare(rel, frames, left, rightOf(rightWords), place);
  // 'No word here' needs the next word to stand right after the left context.
  const pNothing = rightWords > 0 ? p : prepare(rel, frames, left, rightOf(1), place);
  const expected = scoreWord(p, tokensOf(words[j]));
  const best = list => {
    const scored = [];
    for (const a of list) scored.push([a, scoreWord(p, tokensOf(a))]);
    scored.sort((x, y) => y[1] - x[1]);
    return scored.slice(0, top).map(([a, s]) => ({a, s: +s.toFixed(3)}));
  };
  return {
    expected: +expected.toFixed(3),
    nothing: +scoreNothing(pNothing).toFixed(3),
    mut: best(alts.mut ?? []),
    near: best(alts.near ?? []),
    extra: alts.extra ? best(alts.extra) : undefined,
  };
}
