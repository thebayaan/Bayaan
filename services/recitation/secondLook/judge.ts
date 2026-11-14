// The second judge's verdict on one word, from one slice's log-probabilities and
// the ayah's letters. Ported from scripts/recitation-bench/judge/judge.mjs, with the
// answer from judge/policy.mjs and the padded look's gap from
// scripts/second-look/rule.mjs.
//
// An earlier version of this port left out firstWithin and the no-word score, because
// the slice it scored then started 4.6 s before the verdict wherever the ayah started,
// and only the expected word's score was read. The frozen rule changes both reasons:
// its slice starts near the ayah's start, which is what firstWithin assumes, and its
// answer 'absent' is the no-word score. So both are in. Near words stay off, as frozen.
//
// Hypotheses here are lists of numbers inside the computation. They are never shown,
// logged as text or stored.
import followerConstants from '../followerConstants.npl.json';
import type {JudgeAnswer} from '../wordMarks';
import {JUDGE} from './config';
import {
  prepare,
  relativeTo,
  scoreNothing,
  scoreWord,
  WORD,
  wordSpan,
} from './ctc';

const {keepFirstPerLetter, keepGap} = followerConstants.cancel;
const {altMargin} = followerConstants.secondJudge;

export const ALPHABET = 'ءابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const ID = new Map([...ALPHABET].map((c, i) => [c, i + 1]));
const LETTER_IDS = [...ID.values()];

export function tokensOf(letters: string): number[] {
  const out: number[] = [];
  for (const c of letters) {
    const id = ID.get(c);
    if (id === undefined) throw new Error('not in the alphabet');
    out.push(id);
  }
  return out;
}

export interface JudgeOptions {
  leftWords?: number;
  rightWords?: number;
  top?: number;
  firstWithin?: number;
}

export interface ScoredAlternative {
  a: string;
  s: number;
}

export interface WordJudgement {
  /** The expected word's score, to three decimals, as the answer reads it. */
  expected: number;
  /** The score with no word here at all, to three decimals. */
  nothing: number;
  /** The best alternatives, best first. */
  mut: ScoredAlternative[];
  /** The expected word's score in full. */
  exact: number;
  /** That score over the word's letters. */
  perLetter: number;
  /** Where the word sits on the slice: -1 when no path holds it. */
  startFrame: number;
  endFrame: number;
}

const toThree = (v: number) => +v.toFixed(3);

/**
 * @param logp - [frames, 31]
 * @param words - The ayah's words as letters
 * @param j - The word in question
 * @param alternatives - Its mutashabih alternatives, as letters
 */
export function judgeWord(
  logp: Float32Array,
  frames: number,
  words: readonly string[],
  j: number,
  alternatives: readonly string[],
  opts?: JudgeOptions,
): WordJudgement {
  const {
    leftWords = JUDGE.leftWords,
    rightWords = JUDGE.rightWords,
    top = 3,
    firstWithin = JUDGE.firstWithinFrames,
  } = opts ?? {};
  const rel = relativeTo(logp, frames);
  const left: number[] = [];
  for (let i = Math.max(0, j - leftWords); i < j; i++) {
    left.push(...tokensOf(words[i]), WORD);
  }
  const rightOf = (n: number) => {
    const out: number[] = [];
    for (let i = j + 1; i <= Math.min(words.length - 1, j + n); i++) {
      out.push(WORD, ...tokensOf(words[i]));
    }
    return out;
  };
  const p = prepare(rel, frames, left, rightOf(rightWords), firstWithin);
  // 'No word here' needs the next word to stand right after the left context.
  const pNothing =
    rightWords > 0 ? p : prepare(rel, frames, left, rightOf(1), firstWithin);
  const tokens = tokensOf(words[j]);
  const exact = scoreWord(p, tokens);
  const span = wordSpan(p, tokens);
  const scored = alternatives.map(a => ({a, s: scoreWord(p, tokensOf(a))}));
  scored.sort((x, y) => y.s - x.s);
  return {
    expected: toThree(exact),
    nothing: toThree(scoreNothing(pNothing)),
    mut: scored.slice(0, top).map(({a, s}) => ({a, s: toThree(s)})),
    exact,
    perLetter: exact / tokens.length,
    startFrame: span?.startFrame ?? -1,
    endFrame: span?.endFrame ?? -1,
  };
}

/**
 * 'wrong': another word was said. 'absent': no word was said here. 'fits': the
 * expected word was. Otherwise 'neither'.
 */
export function judgeAnswer(
  r: Pick<WordJudgement, 'expected' | 'nothing' | 'mut'>,
): JudgeAnswer {
  const best = r.mut[0];
  if (best && best.s - r.expected >= altMargin && best.s >= -JUDGE.altFit) {
    return 'wrong';
  }
  if (
    r.nothing - r.expected >= JUDGE.absentMargin &&
    r.nothing >= -JUDGE.altFit
  ) {
    return 'absent';
  }
  if (r.expected >= -JUDGE.fit) return 'fits';
  return 'neither';
}

/** So low on the first pass that the mark stays, with no padded look. */
export function scoresFarTooLow(perLetter: number): boolean {
  return perLetter <= keepFirstPerLetter;
}

/**
 * The cancel step on a word about to be marked: 'keep' if the word scores far too low
 * or a changed spelling beat it by enough, otherwise 'cancel'. Any failure keeps it.
 * @param first - The expected word's score per letter, or null with no first pass
 * @param gap - What innerGap said on the padded look, or null with none
 */
export function cancelAnswer(
  first: number | null,
  gap: number | null,
): 'keep' | 'cancel' {
  if (first === null || scoresFarTooLow(first)) return 'keep';
  return gap !== null && gap <= keepGap ? 'keep' : 'cancel';
}

/**
 * How far the best spelling with one inner letter changed beats the written word,
 * on the padded look: the word alone with free frames round it. Lower means that
 * spelling won by more. Null with no inner letter.
 */
export function innerGap(
  logp: Float32Array,
  frames: number,
  tokens: readonly number[],
): number | null {
  if (tokens.length < 3) return null;
  const rel = relativeTo(logp, frames);
  const free = new Float64Array(frames + 1);
  const p = {rel, frames, exitL: free, exitR: free, exitRest: free};
  const written = scoreWord(p, tokens);
  const spelling = [...tokens];
  let best = Infinity;
  for (let i = 1; i < tokens.length - 1; i++) {
    for (const letter of LETTER_IDS) {
      if (letter === tokens[i]) continue;
      spelling[i] = letter;
      const gap = written - scoreWord(p, spelling);
      if (gap < best) best = gap;
    }
    spelling[i] = tokens[i];
  }
  return best;
}
