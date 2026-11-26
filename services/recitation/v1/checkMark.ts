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
      /** An added word: the word after the gap it was heard in. */
      gapRight?: {surah: number; ayah: number; word: number};
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
  const {surah} = from;
  let {ayah, word} = from;
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

const keyOf = (p: Place) => `${p.surah}:${p.ayah}:${p.word}`;

/**
 * Where in the take to look at a mark: when the cursor left its word, or the word
 * before it for a word that was left out. A mark Tilawa confirms late (at the end of
 * a take, say) is then still read on its own word's audio.
 */
export function markTime(mark: V1Mark, ctx: CheckContext): number {
  const at: Place = {surah: mark.surah, ayah: mark.ayah, word: mark.word};
  const {words, path} = ctx.timeline;
  const own = words.get(keyOf(at))?.to;
  if (own !== undefined) return own;
  const prev = previousPlace(ctx, at);
  const before = prev ? words.get(keyOf(prev))?.to : undefined;
  if (before !== undefined) return before;
  // An ayah's first word with nothing heard before it: where the reader went on,
  // later in the ayah or in an ayah after it (a one-word first ayah the follower
  // never landed on, 69:1 say, was said just before 69:2).
  const later = path.find(
    ([, p]) =>
      p.surah === at.surah &&
      (p.ayah > at.ayah || (p.ayah === at.ayah && p.word > at.word)),
  );
  return later ? later[0] : mark.audioTime;
}

// What a reader may say before an ayah's first word, as the second model writes it:
// a lookup key for scoring, never shown. A'udhu billah; the basmala comes from the
// app's own text (1:1).
const ISTIADHA = ['اعوذ', 'بالله', 'من', 'الشيطان', 'الرجيم'];

/** The take began at this ayah: the reader may have opened with a'udhu billah or the basmala. */
function startsTheTake(timeline: V1Timeline, at: Place): boolean {
  const first = timeline.path[0]?.[1];
  return !!first && first.surah === at.surah && first.ayah === at.ayah;
}

/**
 * Before a surah's first word (any surah but 9, and 1:1 is the basmala itself), and
 * before the first word of the take, a reader may say the basmala, a'udhu billah or
 * both. None of that is a mistake, and none of it is an added word.
 */
export function mayOpenWithBasmala(timeline: V1Timeline, at: Place): boolean {
  if (at.word !== 0) return false;
  const surahStart = at.ayah === 1 && at.surah !== 1 && at.surah !== 9;
  return surahStart || startsTheTake(timeline, at);
}

/** The readings to try before a word: nothing, or the openings a reader may say. */
function openingsBefore(ctx: CheckContext, at: Place): string[][] {
  if (!mayOpenWithBasmala(ctx.timeline, at)) return [[]];
  const basmala = [...(ctx.letters(1, 1) ?? [])];
  return basmala.length
    ? [[], basmala, ISTIADHA, [...ISTIADHA, ...basmala]]
    : [[], ISTIADHA];
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
  const t = markTime(mark, ctx);
  const {start, end} = judgeSlice(
    ctx.places,
    mark.surah,
    mark.ayah,
    t,
    ctx.heard(),
  );
  detail.slice = [start / SAMPLE_RATE, end / SAMPLE_RATE];
  const out = await modelOn(ctx, start, end);
  // Before a first word the reader may have said the basmala: the slice is read with
  // each opening before the ayah, and the reading where the word fits best counts.
  const alternatives = ctx.alternatives(mark.surah, mark.ayah, mark.word);
  let judged: ReturnType<typeof judgeWord> | null = null;
  for (const opening of openingsBefore(ctx, mark)) {
    const reading = judgeWord(
      out.logp,
      out.frames,
      [...opening, ...letters],
      opening.length + mark.word,
      alternatives,
    );
    if (!judged || reading.exact > judged.exact) judged = reading;
  }
  if (!judged) throw new CheckFailure('no reading of the slice');
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
): Promise<{outcome: 'kept' | 'cancelled'; why: string; gapRight?: Place}> {
  const {keepGain, repeatSlack, contextWords} = v1Constants.added;
  const letters = ctx.letters(mark.surah, mark.ayah);
  if (!letters?.[mark.word]) throw new CheckFailure('no letters for this word');
  // Tilawa names the word after the extra one (on the bench, all 71 real ones), the
  // next ayah's first word for one after an ayah's last word: the gap is before it.
  const right: Place = {surah: mark.surah, ayah: mark.ayah, word: mark.word};
  if (mayOpenWithBasmala(ctx.timeline, right)) {
    return {
      outcome: 'cancelled',
      why: "before a first word the reader may say the basmala or a'udhu billah",
    };
  }
  const leftEnd = previousPlace(ctx, right);
  if (!leftEnd) throw new CheckFailure('no word before the gap');
  const left = wordsAround(ctx, leftEnd, contextWords, 'back');
  const after = wordsAround(ctx, right, contextWords, 'ahead');
  if (left.length === 0 || after.length === 0) {
    throw new CheckFailure('no words around the gap');
  }
  const {start, end} = judgeSlice(
    ctx.places,
    mark.surah,
    mark.ayah,
    markTime(mark, ctx),
    ctx.heard(),
  );
  detail.slice = [start / SAMPLE_RATE, end / SAMPLE_RATE];
  const out = await modelOn(ctx, start, end);
  const score = insertionScore(out.logp, out.frames, left, after);
  detail.insertionGain = score.gain;
  detail.repeat = score.repeat;
  if (score.gain < keepGain) {
    return {outcome: 'cancelled', why: 'nothing extra was said'};
  }
  if (score.repeat >= -repeatSlack) {
    return {outcome: 'cancelled', why: 'a repeat, not an added word'};
  }
  return {outcome: 'kept', why: 'an extra word was said', gapRight: right};
}

/** Where the follower landed after skipping from before `at`, if it jumped at all. */
function landing(timeline: V1Timeline, at: Place): Place | null {
  const path = timeline.path;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1][1];
    const place = path[i][1];
    if (before(prev, at) && before(at, place)) return place;
  }
  return null;
}

/**
 * Where the reader may have gone on after skipping from just before `at`: a few
 * words further in the ayah, the start of one of the next few ayat, and where the
 * follower landed. Tilawa often walks a few words of the skipped ayah before it
 * lands, and confirms a skip late, so the check does not rely on its landing.
 */
function wentOnCandidates(ctx: CheckContext, at: Place): Place[] {
  const {wordsAhead, maxAyat} = v1Constants.skipped;
  const out: Place[] = [];
  const letters = ctx.letters(at.surah, at.ayah);
  for (
    let k = 1;
    k <= wordsAhead && letters && at.word + k < letters.length;
    k++
  ) {
    out.push({...at, word: at.word + k});
  }
  for (let k = 1; k <= maxAyat; k++) {
    if (!ctx.letters(at.surah, at.ayah + k)) break;
    out.push({surah: at.surah, ayah: at.ayah + k, word: 0});
  }
  const landed = landing(ctx.timeline, at);
  if (landed && !out.some(p => keyOf(p) === keyOf(landed))) out.push(landed);
  return out;
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
  const {keepGain, beforeSeconds, afterSeconds, contextWords} =
    v1Constants.skipped;
  const at: Place = {surah: mark.surah, ayah: mark.ayah, word: mark.word};
  const leftEnd = previousPlace(ctx, at);
  if (!leftEnd) throw new CheckFailure('nothing read before the skip');
  const leftTime = ctx.timeline.words.get(keyOf(leftEnd));
  if (!leftTime)
    throw new CheckFailure('the words before the skip were not heard');
  const left = wordsAround(ctx, leftEnd, contextWords, 'back');
  const said = wordsAround(ctx, at, contextWords, 'ahead');
  const candidates = wentOnCandidates(ctx, at);
  if (!left.length || !said.length || candidates.length === 0) {
    throw new CheckFailure('no letters around the skip');
  }
  // From just before the last word read to a few seconds after the reader left it.
  const end = Math.min(
    ctx.heard(),
    Math.round((leftTime.to + afterSeconds) * SAMPLE_RATE),
  );
  const start = Math.max(
    0,
    Math.round((leftTime.from - beforeSeconds) * SAMPLE_RATE),
    end - Math.round(JUDGE.sliceSeconds * SAMPLE_RATE),
  );
  detail.slice = [start / SAMPLE_RATE, end / SAMPLE_RATE];
  const out = await modelOn(ctx, start, end);
  let best: {gain: number; place: Place} | null = null;
  for (const place of candidates) {
    const went = wordsAround(ctx, place, contextWords, 'ahead');
    if (went.length === 0) continue;
    const gain = skipGain(out.logp, out.frames, left, said, went);
    if (!best || gain > best.gain) best = {gain, place};
  }
  if (!best) throw new CheckFailure('no letters where the reader went on');
  detail.skipGain = best.gain;
  return best.gain >= keepGain
    ? {
        outcome: 'kept',
        why: 'the reader went straight on',
        resumedAt: best.place,
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
