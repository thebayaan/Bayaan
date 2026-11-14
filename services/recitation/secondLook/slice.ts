import followerConstants from '../followerConstants.npl.json';
import type {EngineWord} from '../wordMarks';
import {JUDGE} from './config';
import {SAMPLE_RATE} from './fbank';

// Where the second judge's slice and the padded look's cut go. All in samples of the
// stream, from 0 at the reset. Ported from judge/e2e_harness.mjs, which lib.mjs's
// judgeSlice copies, judge/model.mjs's sliceFrames and rule.mjs's paddedCut.

const {
  holdSeconds,
  trackerLagSeconds,
  cursorLagSeconds,
  afterPreviousSeconds,
  noPreviousSeconds,
  minSliceSeconds,
  fallbackSeconds,
} = followerConstants.secondJudge;
const {marginSeconds, silenceSeconds, minCutSeconds} = followerConstants.cancel;

const MEL_SHIFT = 160;
// A log-mel frame's window ends this far after its grid point.
const WINDOW_AFTER_START = 280;
// One model frame is this long.
export const MODEL_FRAME_SECONDS = 0.04;
/** Below this many log-mel frames the model leaves too little to score. */
export const MIN_MEL_FRAMES = 16;

/** What the slice reads from the follower. */
export interface SlicePlaces {
  wordFrames: (word: EngineWord) => {from: number; to: number} | null;
  ayahEnteredAt: (surah: number, ayah: number) => number | null;
  wordCount: (surah: number, ayah: number) => number;
}

/** Seconds where an ayah's first word starts, or null when nothing says. */
function ayahStart(
  places: SlicePlaces,
  surah: number,
  ayah: number,
): number | null {
  const first = places.wordFrames({surah, ayah, word: 0});
  if (first) return first.from * MODEL_FRAME_SECONDS - trackerLagSeconds;
  const entered = places.ayahEnteredAt(surah, ayah);
  return entered === null ? null : entered - cursorLagSeconds;
}

/** Seconds where a slice inside this ayah may start, or null when nothing says. */
function sliceFrom(
  places: SlicePlaces,
  surah: number,
  ayah: number,
): number | null {
  const first = ayahStart(places, surah, ayah);
  const count = ayah > 1 ? places.wordCount(surah, ayah - 1) : 0;
  const previous = count
    ? places.wordFrames({surah, ayah: ayah - 1, word: count - 1})
    : null;
  const after = previous
    ? previous.to * MODEL_FRAME_SECONDS + afterPreviousSeconds
    : null;
  if (first === null) return after;
  return after === null
    ? first - noPreviousSeconds
    : Math.min(after, first - JUDGE.cutSeconds);
}

/**
 * The judge's slice for a word of this ayah: inside the ayah, as far as the follower
 * knows where that is, and up to JUDGE.sliceSeconds.
 * @param t - Audio time of the verdict, in seconds
 * @param heard - Samples of the stream heard so far
 */
export function judgeSlice(
  places: SlicePlaces,
  surah: number,
  ayah: number,
  t: number,
  heard: number,
): {start: number; end: number} {
  let endSeconds = t + holdSeconds;
  const next = ayahStart(places, surah, ayah + 1);
  if (next !== null && next > 0) {
    endSeconds = Math.min(endSeconds, Math.max(t, next + JUDGE.tailSeconds));
  }
  const end = Math.min(heard, Math.round(endSeconds * SAMPLE_RATE));
  let start = Math.max(0, end - Math.round(JUDGE.sliceSeconds * SAMPLE_RATE));
  const here = sliceFrom(places, surah, ayah);
  if (here !== null) start = Math.max(start, Math.round(here * SAMPLE_RATE));
  if (end - start < minSliceSeconds * SAMPLE_RATE) {
    start = Math.max(0, end - fallbackSeconds * SAMPLE_RATE);
  }
  return {start: Math.max(0, start), end};
}

/** The log-mel frames [first, last) a stream's features hold for these samples. */
export function melRange(
  start: number,
  end: number,
): {first: number; last: number} {
  const first = Math.max(0, Math.round(start / MEL_SHIFT));
  const last = Math.floor((end - WINDOW_AFTER_START) / MEL_SHIFT) + 1;
  return {first, last: Math.max(first, last)};
}

/** Seconds of the slice's start, as the model's first frame sees it. */
export function sliceStartSeconds(start: number): number {
  return Math.round(start / MEL_SHIFT) * 0.01;
}

/** The last sample the padded look may use: what is heard at the end of the hold. */
export function heardAtHold(t: number): number {
  return Math.round((t + holdSeconds) * SAMPLE_RATE);
}

/**
 * The samples of the word and its margins, or null when too little is left.
 * @param wordStart - Seconds
 * @param wordEnd - Seconds
 * @param limit - The last sample heard at the end of the hold
 * @param heard - Samples of the stream heard so far
 */
export function paddedRange(
  wordStart: number,
  wordEnd: number,
  limit: number,
  heard: number,
): {start: number; end: number} | null {
  const start = Math.max(
    0,
    Math.floor((wordStart - marginSeconds) * SAMPLE_RATE),
  );
  const end = Math.min(
    heard,
    limit,
    Math.ceil((wordEnd + marginSeconds) * SAMPLE_RATE),
  );
  return end - start < minCutSeconds * SAMPLE_RATE ? null : {start, end};
}

/** The cut with digital silence each side. */
export function withSilence(cut: Float32Array): Float32Array {
  const quiet = Math.round(silenceSeconds * SAMPLE_RATE);
  const out = new Float32Array(cut.length + 2 * quiet);
  out.set(cut, quiet);
  return out;
}
