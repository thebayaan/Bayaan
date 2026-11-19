import type {JudgeAnswer} from '../wordMarks';
import {corruptRow} from '../secondLook/corruptOutput';
import {
  cancelAnswer,
  innerGap,
  judgeAnswer,
  judgeWord,
  scoresFarTooLow,
  tokensOf,
} from '../secondLook/judge';
import {JUDGE} from '../secondLook/config';
import {
  heardAtHold,
  judgeSlice,
  MIN_MEL_FRAMES,
  MODEL_FRAME_SECONDS,
  paddedRange,
  withSilence,
  type SlicePlaces,
} from '../secondLook/slice';
import followerConstants from '../followerConstants.npl.json';
import v1Constants from './constants.json';
import {insertionScore, skipGain} from './insertSkip';
import type {V1Mark, V1Timeline} from './types';

// The app's own check on a mistake Tilawa 1.0 has confirmed, before it shows.
//
// - A wrong or left-out word: the second judge on the word's slice, then the cancel
//   step, as the 14 November bench ran it on Tilawa's marks (the step 2 rule): a
//   word the judge hears as written is cancelled (on an ayah's first or last word
//   only when it was left out), a word it hears as another word or as no word
//   stays, and the cancel step decides the rest.
// - An added word: the insertion question (insertSkip), at the gap on either side
//   of the word Tilawa names.
// - A skipped passage: the skip question, from the last words read to where the
//   reader went on.
//
// Any failure keeps the mark: a check that cannot answer must never hide one.

const SAMPLE_RATE = 16000;
const {holdSeconds} = followerConstants.secondJudge;
const LEAST_LETTERS = 3;

export interface CheckContext {
  /** Where the follower put words: the slice reads them. */
  places: SlicePlaces;
  timeline: V1Timeline;
  /** Samples of the take heard so far. */
  heard: () => number;
  /** The take's samples [start, end), as many as are still kept. */
  samples: (start: number, end: number) => Float32Array;
  /** The second model's input features for a wave. */
  features: (
    wave: Float32Array,
  ) => Promise<{data: Float32Array; frames: number}>;
  /** The second model. */
  run: (
    features: Float32Array,
    frames: number,
  ) => Promise<{logp: Float32Array; frames: number}>;
  /** An ayah's words as the second model writes them, or null. */
  letters: (surah: number, ayah: number) => readonly string[] | null;
  alternatives: (
    surah: number,
    ayah: number,
    word: number,
  ) => readonly string[];
}

export interface CheckDetail {
  say?: JudgeAnswer;
  perLetter?: number;
  gap?: number | null;
  insertionGain?: number;
  repeat?: number;
  skipGain?: number;
  slice?: [number, number];
}

export type V1CheckAnswer =
  | {
      outcome: 'kept' | 'cancelled';
      why: string;
      detail: CheckDetail;
      /** A skipped passage: the word the reader went on with. */
      resumedAt?: {surah: number; ayah: number; word: number};
      ms: number;
    }
  | {outcome: 'failed'; reason: string; detail: CheckDetail; ms: number};

class CheckFailure extends Error {}

type Place = {surah: number; ayah: number; word: number};

const before = (a: Place, b: Place) =>
  a.surah !== b.surah
    ? a.surah < b.surah
    : a.ayah !== b.ayah
    ? a.ayah < b.ayah
    : a.word < b.word;

/** Letters of `count` words from `from` on (ahead) or ending at it (back), across ayat. */
function wordsAround(
  ctx: CheckContext,
  from: Place,
  count: number,
  direction: 'ahead' | 'back',
): string[] {
  const out: string[] = [];
  let {surah, ayah, word} = from;
  let letters = ctx.letters(surah, ayah);
  while (out.length < count && letters) {
    if (word >= 0 && word < letters.length) {
      if (direction === 'ahead') out.push(letters[word]);
      else out.unshift(letters[word]);
      word += direction === 'ahead' ? 1 : -1;
      continue;
    }
    ayah += direction === 'ahead' ? 1 : -1;
    if (ayah < 1) break;
    letters = ctx.letters(surah, ayah);
    word = direction === 'ahead' ? 0 : (letters?.length ?? 0) - 1;
  }
  return out;
}

/** The word just before this one in reading order, across an ayah's start. */
function previousPlace(ctx: CheckContext, at: Place): Place | null {
  if (at.word > 0) return {...at, word: at.word - 1};
  if (at.ayah <= 1) return null;
  const letters = ctx.letters(at.surah, at.ayah - 1);
  return letters
    ? {surah: at.surah, ayah: at.ayah - 1, word: letters.length - 1}
    : null;
}

async function modelOn(
  ctx: CheckContext,
  start: number,
  end: number,
  silence = false,
): Promise<{logp: Float32Array; frames: number}> {
  const cut = ctx.samples(start, end);
  const wave = silence ? withSilence(cut) : cut;
  const features = await ctx.features(wave);
  if (features.frames < MIN_MEL_FRAMES) {
    throw new CheckFailure('too little of the slice');
  }
  const out = await ctx.run(features.data, features.frames);
  const row = corruptRow(out.logp, out.frames);
  if (row >= 0) throw new CheckFailure(`corrupted model output, row ${row}`);
  return out;
}

async function checkWordMark(
  mark: V1Mark,
  ctx: CheckContext,
  detail: CheckDetail,
): Promise<{outcome: 'kept' | 'cancelled'; why: string}> {
  const letters = ctx.letters(mark.surah, mark.ayah);
  if (!letters?.[mark.word]) throw new CheckFailure('no letters for this word');
  const t = mark.audioTime;
  const {start, end} = judgeSlice(
    ctx.places,
    mark.surah,
    mark.ayah,
    t,
    ctx.heard(),
  );
  detail.slice = [start / SAMPLE_RATE, end / SAMPLE_RATE];
  const out = await modelOn(ctx, start, end);
  const judged = judgeWord(
    out.logp,
    out.frames,
    letters,
    mark.word,
    ctx.alternatives(mark.surah, mark.ayah, mark.word),
  );
  const say = judgeAnswer(judged);
  detail.say = say;
  detail.perLetter = judged.perLetter;
  const interior = mark.word > 0 && mark.word < letters.length - 1;
  if (say === 'fits' && (mark.errorClass === 'omitted_word' || interior)) {
    return {outcome: 'cancelled', why: 'the written word fits'};
  }
  if (say === 'wrong' || say === 'absent') {
    return {
      outcome: 'kept',
      why: `the judge heard ${say === 'wrong' ? 'another word' : 'no word'}`,
    };
  }
  if (judged.startFrame < 0) throw new CheckFailure('no path');
  if (scoresFarTooLow(judged.perLetter)) {
    return {outcome: 'kept', why: 'scores far too low'};
  }
  if (letters[mark.word].length < LEAST_LETTERS) {
    return {outcome: 'cancelled', why: 'no inner letter'};
  }
  const sliceStart = start / SAMPLE_RATE;
  const range = paddedRange(
    sliceStart + judged.startFrame * MODEL_FRAME_SECONDS,
    sliceStart + (judged.endFrame + 1) * MODEL_FRAME_SECONDS,
    heardAtHold(t),
    ctx.heard(),
  );
  if (!range) throw new CheckFailure('too little to cut');
  const padded = await modelOn(ctx, range.start, range.end, true);
  const gap = innerGap(
    padded.logp,
    padded.frames,
    tokensOf(letters[mark.word]),
  );
  detail.gap = gap;
  return cancelAnswer(judged.perLetter, gap) === 'keep'
    ? {outcome: 'kept', why: 'a spelling beats it'}
    : {outcome: 'cancelled', why: 'no spelling beats it'};
}

async function checkAddedMark(
  mark: V1Mark,
  ctx: CheckContext,
  detail: CheckDetail,
): Promise<{outcome: 'kept' | 'cancelled'; why: string}> {
  const {keepGain, repeatSlack, contextWords} = v1Constants.added;
  const letters = ctx.letters(mark.surah, mark.ayah);
  if (!letters?.[mark.word]) throw new CheckFailure('no letters for this word');
  const {start, end} = judgeSlice(
    ctx.places,
    mark.surah,
    mark.ayah,
    mark.audioTime,
    ctx.heard(),
  );
  detail.slice = [start / SAMPLE_RATE, end / SAMPLE_RATE];
  const out = await modelOn(ctx, start, end);
  // The gap before the word Tilawa names, and the one after it.
  let best: {gain: number; repeat: number} | null = null;
  for (const right of [
    {...mark},
    {surah: mark.surah, ayah: mark.ayah, word: mark.word + 1},
  ]) {
    const leftEnd = previousPlace(ctx, right);
    if (!leftEnd) continue;
    const left = wordsAround(ctx, leftEnd, contextWords, 'back');
    const after = wordsAround(ctx, right, contextWords, 'ahead');
    if (left.length === 0 || after.length === 0) continue;
    const score = insertionScore(out.logp, out.frames, left, after);
    if (!best || score.gain > best.gain) best = score;
  }
  if (!best) throw new CheckFailure('no words around the gap');
  detail.insertionGain = best.gain;
  detail.repeat = best.repeat;
  if (best.gain < keepGain) {
    return {outcome: 'cancelled', why: 'nothing extra was said'};
  }
  if (best.repeat >= -repeatSlack) {
    return {outcome: 'cancelled', why: 'a repeat, not an added word'};
  }
  return {outcome: 'kept', why: 'an extra word was said'};
}

/** The place the reader went on with after skipping from before `at`. */
function resumePlace(
  timeline: V1Timeline,
  at: Place,
  until: number,
): {place: Place; time: number; leftTime: number} | null {
  const path = timeline.path;
  let found: {place: Place; time: number; leftTime: number} | null = null;
  for (let i = 1; i < path.length; i++) {
    const [time, place] = path[i];
    if (time > until) break;
    const [leftTime, prev] = path[i - 1];
    if (before(prev, at) && before(at, place)) {
      found = {place, time, leftTime};
    }
  }
  return found;
}

async function checkSkippedMark(
  mark: V1Mark,
  ctx: CheckContext,
  detail: CheckDetail,
): Promise<{
  outcome: 'kept' | 'cancelled';
  why: string;
  resumedAt?: Place;
}> {
  const {keepGain, beforeSeconds, contextWords} = v1Constants.skipped;
  const at: Place = {surah: mark.surah, ayah: mark.ayah, word: mark.word};
  const resumed = resumePlace(ctx.timeline, at, mark.audioTime + holdSeconds);
  if (!resumed) throw new CheckFailure('no place the reader went on with');
  const leftEnd = previousPlace(ctx, at);
  if (!leftEnd) throw new CheckFailure('nothing read before the skip');
  const left = wordsAround(ctx, leftEnd, contextWords, 'back');
  const said = wordsAround(ctx, at, contextWords, 'ahead');
  const went = wordsAround(ctx, resumed.place, contextWords, 'ahead');
  if (!left.length || !said.length || !went.length) {
    throw new CheckFailure('no letters around the skip');
  }
  const resumedTo =
    ctx.timeline.words.get(
      `${resumed.place.surah}:${resumed.place.ayah}:${resumed.place.word}`,
    )?.to ?? resumed.time;
  const end = Math.min(
    ctx.heard(),
    Math.round(
      (Math.max(resumedTo, mark.audioTime) + holdSeconds) * SAMPLE_RATE,
    ),
  );
  const start = Math.max(
    0,
    Math.round((resumed.leftTime - beforeSeconds) * SAMPLE_RATE),
    end - Math.round(JUDGE.sliceSeconds * SAMPLE_RATE),
  );
  detail.slice = [start / SAMPLE_RATE, end / SAMPLE_RATE];
  const out = await modelOn(ctx, start, end);
  const gain = skipGain(out.logp, out.frames, left, said, went);
  detail.skipGain = gain;
  return gain >= keepGain
    ? {
        outcome: 'kept',
        why: 'the reader went straight on',
        resumedAt: resumed.place,
      }
    : {outcome: 'cancelled', why: 'the skipped words were said'};
}

/**
 * The check on one confirmed mistake. Never throws: a failure is an answer, and the
 * mark then shows.
 */
export async function checkV1Mark(
  mark: V1Mark,
  ctx: CheckContext,
): Promise<V1CheckAnswer> {
  const startedAt = Date.now();
  const detail: CheckDetail = {};
  try {
    const answer =
      mark.errorClass === 'added_word'
        ? await checkAddedMark(mark, ctx, detail)
        : mark.errorClass === 'skipped_passage'
        ? await checkSkippedMark(mark, ctx, detail)
        : await checkWordMark(mark, ctx, detail);
    return {...answer, detail, ms: Date.now() - startedAt};
  } catch (error) {
    return {
      outcome: 'failed',
      reason: error instanceof Error ? error.message : String(error),
      detail,
      ms: Date.now() - startedAt,
    };
  }
}
