import {BLANK, WORD} from '../../secondLook/ctc';
import {corruptRow} from '../../secondLook/corruptOutput';
import {tokensOf} from '../../secondLook/judge';
import {insertionScore, skipGain} from '../insertSkip';

const VOCAB = 31;

/**
 * Log-probabilities for words said one after the other: each letter two frames,
 * a blank after each letter, a word separator between words, silence around.
 */
function said(words: string[]): {logp: Float32Array; frames: number} {
  const path: number[] = [BLANK, BLANK, BLANK];
  words.forEach((w, i) => {
    if (i > 0) path.push(WORD, BLANK);
    for (const t of tokensOf(w)) path.push(t, t, BLANK);
  });
  path.push(BLANK, BLANK, BLANK);
  const logp = new Float32Array(path.length * VOCAB).fill(-20);
  path.forEach((tok, t) => {
    logp[t * VOCAB + tok] = -0.01;
  });
  return {logp, frames: path.length};
}

describe('insertionScore', () => {
  it('gains nothing where the two words follow each other', () => {
    const {logp, frames} = said(['بت', 'ثج']);
    expect(
      insertionScore(logp, frames, ['بت'], ['ثج']).gain,
    ).toBeLessThanOrEqual(1);
  });

  it('gains a lot where another word stands between them, which is no repeat', () => {
    const {logp, frames} = said(['بت', 'خدر', 'ثج']);
    const score = insertionScore(logp, frames, ['بت'], ['ثج']);
    expect(score.gain).toBeGreaterThanOrEqual(15);
    expect(score.repeat).toBeLessThan(-15);
  });

  it('reads a repeat of the last word as a repeat', () => {
    const {logp, frames} = said(['سش', 'بت', 'بت', 'ثج']);
    const score = insertionScore(logp, frames, ['سش', 'بت'], ['ثج']);
    expect(score.gain).toBeGreaterThanOrEqual(15);
    expect(score.repeat).toBeGreaterThan(-1);
  });

  it('reads a repeat of the last two words as a repeat', () => {
    const {logp, frames} = said(['سش', 'بت', 'سش', 'بت', 'ثج']);
    const score = insertionScore(logp, frames, ['سش', 'بت'], ['ثج']);
    expect(score.repeat).toBeGreaterThan(-1);
  });
});

describe('skipGain', () => {
  it('is high when the reader went straight on to later words', () => {
    const {logp, frames} = said(['بت', 'سش', 'صض']);
    expect(
      skipGain(logp, frames, ['بت'], ['ثج', 'حخ'], ['سش', 'صض']),
    ).toBeGreaterThan(10);
  });

  it('is low when the words that should come next were said', () => {
    const {logp, frames} = said(['بت', 'ثج', 'حخ']);
    expect(
      skipGain(logp, frames, ['بت'], ['ثج', 'حخ'], ['سش', 'صض']),
    ).toBeLessThan(-10);
  });
});

describe('corruptRow', () => {
  it('finds a row with a value far below any log-probability', () => {
    const {logp, frames} = said(['بت']);
    expect(corruptRow(logp, frames)).toBe(-1);
    logp[3 * VOCAB + 5] = -4e5;
    expect(corruptRow(logp, frames)).toBe(3);
  });

  it('counts a NaN as corrupt', () => {
    const {logp, frames} = said(['بت']);
    logp[2 * VOCAB] = NaN;
    expect(corruptRow(logp, frames)).toBe(2);
  });
});
