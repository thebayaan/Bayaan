import followerConstants from '../followerConstants.npl.json';
import {alternativesOf} from '../secondLook/alternatives';
import {recentAudio, RING_SECONDS} from '../secondLook/audioRing';
import {ayahLetters} from '../secondLook/ayahLetters';
import {secondLookModelNow} from '../secondLook/checkWord';
import {CHECK_TIMEOUT_MS} from '../secondLook/config';
import {fbankInSteps} from '../secondLook/fbank';
import {
  checkV1Mark,
  markTime,
  mayOpenWithBasmala,
  type CheckContext,
  type V1CheckAnswer,
} from './checkMark';
import v1Constants from './constants.json';
import type {V1Engine} from './engine';
import {
  answerV1Check,
  checkingV1,
  emptyV1Book,
  noteV1Mark,
  noteV1Place,
  shownV1,
  type Place,
  type V1Book,
  type V1Entry,
  type V1Shown,
} from './marks';
import type {WordMark} from '../wordMarks';
import type {V1Mark} from './types';

// One take's Tilawa 1.0 marks, between the engine and the page. The tracking service
// hands it the engine's v1_mark messages and cursor moves; it runs the app's check
// on each confirmed mistake once the take has heard a little past it, and tells the
// service what to show.
//
// A check that fails or takes too long shows the mark. With no second model at all
// nothing shows: Tilawa's marks unchecked are far too many (about 6 a 1,000 words
// on the bench, against 0.3 checked).

const SAMPLE_RATE = 16000;
const {holdSeconds} = followerConstants.secondJudge;
/** The ring keeps this much audio; an older slice cannot be cut. */
const KEPT_SECONDS = RING_SECONDS;
const POLL_MS = 40;

export interface V1TakeHost {
  /** The take's engine, while it runs. */
  engine: () => V1Engine | null;
  /** What the page should show now. */
  publish: (shown: V1Shown) => void;
  /** New mistakes just showed. */
  buzz: () => void;
  trace: (line: string) => void;
}

interface V1Take {
  host: V1TakeHost;
  book: V1Book;
  pending: Set<Promise<void>>;
  /** Marks the reader dismissed this take, by place. */
  dismissed: Set<string>;
  /** The take is stopping: no more audio will come, so no check waits for any. */
  settling: boolean;
  over: boolean;
}

let take: V1Take | null = null;

const placeKey = (p: Place) => `${p.surah}:${p.ayah}:${p.word}`;
/** A shown mark's key: an added mark and a red one can share a word. */
const shownKey = (p: Place, kind: WordMark['kind']) =>
  `${placeKey(p)}${kind === 'added' ? '+' : ''}`;

/** Resolves once the take has heard `seconds` of audio, or is over. */
function heardBy(current: V1Take, seconds: number): Promise<void> {
  const need = Math.round(seconds * SAMPLE_RATE);
  return new Promise(resolve => {
    const poll = () => {
      if (
        current.over ||
        current.settling ||
        take !== current ||
        recentAudio.heard() >= need
      ) {
        resolve();
        return;
      }
      setTimeout(poll, POLL_MS);
    };
    poll();
  });
}

const after = (a: Place, b: Place) =>
  a.surah - b.surah || a.ayah - b.ayah || a.word - b.word;

/**
 * Resolves once the follower has gone past `place`, or the take has heard `seconds`
 * of audio, or is stopping.
 */
function passedBy(
  current: V1Take,
  place: Place,
  seconds: number,
): Promise<void> {
  const need = Math.round(seconds * SAMPLE_RATE);
  return new Promise(resolve => {
    const poll = () => {
      const path = current.host.engine()?.timeline().path ?? [];
      const last = path[path.length - 1]?.[1];
      if (
        current.over ||
        current.settling ||
        take !== current ||
        recentAudio.heard() >= need ||
        (last && after(last, place) > 0)
      ) {
        resolve();
        return;
      }
      setTimeout(poll, POLL_MS);
    };
    poll();
  });
}

function withTimeout(
  check: Promise<V1CheckAnswer>,
  ms: number,
): Promise<V1CheckAnswer> {
  return new Promise(resolve => {
    const timer = setTimeout(
      () =>
        resolve({
          outcome: 'failed',
          reason: `no answer within ${ms / 1000} s`,
          detail: {},
          ms,
        }),
      ms,
    );
    void check.then(answer => {
      clearTimeout(timer);
      resolve(answer);
    });
  });
}

function contextOf(engine: V1Engine): CheckContext {
  return {
    places: engine,
    timeline: engine.timeline(),
    heard: () => recentAudio.heard(),
    samples: (start, end) => {
      const kept = recentAudio.heard() - KEPT_SECONDS * SAMPLE_RATE;
      return start < kept
        ? new Float32Array(0)
        : recentAudio.samples(start, end);
    },
    features: wave => fbankInSteps(wave),
    run: async (features, frames) => {
      const model = await secondLookModelNow();
      if (!model) throw new Error('no second model');
      return model.run(features, frames);
    },
    letters: ayahLetters,
    alternatives: alternativesOf,
  };
}

function markOf(entry: V1Entry): V1Mark {
  return {
    id: entry.id,
    state: 'confirmed',
    errorClass: entry.errorClass,
    ...entry.place,
    totalWords: entry.totalWords,
    audioTime: entry.confirmedAt ?? entry.since,
    confidence: 0,
  };
}

function shownCount(book: V1Book): number {
  let n = 0;
  for (const e of book.values()) if (e.status === 'shown') n += 1;
  return n;
}

function publish(current: V1Take): void {
  const engine = current.host.engine();
  const shown = shownV1(current.book, (s, a) => engine?.wordCount(s, a) ?? 0);
  current.host.publish({
    marks: shown.marks.filter(m => !current.dismissed.has(shownKey(m, m.kind))),
    skippedAyat: shown.skippedAyat,
  });
}

async function runCheck(current: V1Take, entry: V1Entry): Promise<void> {
  const at = entry.confirmedAt ?? entry.since;
  const mark = markOf(entry);
  const timeline = () =>
    current.host.engine()?.timeline() ?? {
      words: new Map(),
      ayahEntered: new Map(),
      path: [],
    };
  // Tilawa marks a surah's first word while the reader is still saying the basmala:
  // the word is checked once the follower has gone past it.
  if (
    entry.errorClass !== 'added_word' &&
    mayOpenWithBasmala(timeline(), entry.place)
  ) {
    await passedBy(
      current,
      entry.place,
      at + v1Constants.firstWord.waitSeconds,
    );
  }
  // The slice ends a hold after the word was heard: wait for that much audio.
  const engineNow = current.host.engine();
  const heardAt = engineNow
    ? markTime(mark, {...contextOf(engineNow), timeline: timeline()})
    : at;
  await heardBy(current, Math.max(at, heardAt) + holdSeconds);
  if (take !== current) return;
  const engine = current.host.engine();
  const model = await secondLookModelNow();
  if (take !== current) return;
  let answer: V1CheckAnswer;
  if (!engine || !model) {
    // No check at all: the mark stays hidden rather than show unchecked.
    answer = {
      outcome: 'cancelled',
      why: model ? 'no engine' : 'no second model',
      detail: {},
      ms: 0,
    };
  } else {
    answer = await withTimeout(
      checkV1Mark(mark, contextOf(engine)),
      CHECK_TIMEOUT_MS,
    );
  }
  if (take !== current) return;
  const before = shownCount(current.book);
  current.book = answerV1Check(current.book, entry.id, answer);
  const what =
    answer.outcome === 'failed'
      ? `failed open (${answer.reason})`
      : `${answer.outcome === 'kept' ? 'shows' : 'cancelled'} (${answer.why})`;
  current.host.trace(
    `v1 check ${entry.errorClass} ${entry.place.surah}:${
      entry.place.ayah
    } word ${entry.place.word + 1}: ${what}, ${answer.ms} ms`,
  );
  publish(current);
  if (shownCount(current.book) > before) current.host.buzz();
}

/** A take begins: nothing from an earlier one can reach it. */
export function startV1Take(host: V1TakeHost): void {
  if (take) take.over = true;
  take = {
    host,
    book: emptyV1Book(),
    pending: new Set(),
    dismissed: new Set(),
    settling: false,
    over: false,
  };
}

/** One of the engine's v1_mark messages. */
export function noteV1Message(mark: V1Mark): void {
  const current = take;
  if (!current || current.over) return;
  // A red mark the reader dismissed is not raised again on that word.
  if (
    mark.errorClass !== 'added_word' &&
    current.dismissed.has(placeKey(mark))
  ) {
    return;
  }
  const before = current.book;
  const {book, toCheck} = noteV1Mark(current.book, mark);
  current.book = book;
  if (mark.state !== 'suspected') {
    current.host.trace(
      `v1 ${mark.state} ${mark.errorClass} ${mark.surah}:${mark.ayah} word ${
        mark.word + 1
      }`,
    );
  }
  if (toCheck) {
    const run = runCheck(current, toCheck).catch(error => {
      current.host.trace(`v1 check failed: ${String(error)}`);
    });
    current.pending.add(run);
    void run.finally(() => current.pending.delete(run));
  }
  if (book !== before && !toCheck) publish(current);
}

/** The cursor moved: the restart rule may correct a mark. */
export function noteV1Cursor(at: Place): void {
  const current = take;
  if (!current || current.over || !v1Constants.restart.on) return;
  const next = noteV1Place(current.book, at);
  if (next === current.book) return;
  current.book = next;
  current.host.trace(`v1 re-read past a mark at ${at.surah}:${at.ayah}`);
  publish(current);
}

/**
 * The take is stopping and hears no more audio: the checks under way run on what
 * was heard, rather than wait for audio that will not come. Waits for them, at most
 * `ms`.
 */
export async function settleV1Checks(ms: number): Promise<void> {
  const current = take;
  if (!current) return;
  current.settling = true;
  const deadline = Date.now() + ms;
  while (current.pending.size > 0 && Date.now() < deadline) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    await Promise.race([
      Promise.all([...current.pending]),
      new Promise(resolve => {
        timer = setTimeout(resolve, deadline - Date.now());
      }),
    ]);
    if (timer) clearTimeout(timer);
  }
}

/** The reader said they read this word correctly: that mark goes for the take. */
export function dismissV1(place: Place, kind: WordMark['kind']): void {
  const current = take;
  if (!current) return;
  current.dismissed.add(shownKey(place, kind));
  publish(current);
}

/**
 * The take is over. A mark still waiting for its check shows, as a check that gets
 * no answer must not hide it.
 */
export function endV1Take(): V1Shown | null {
  const current = take;
  take = null;
  if (!current) return null;
  current.over = true;
  for (const entry of checkingV1(current.book)) {
    current.book = answerV1Check(current.book, entry.id, {
      outcome: 'failed',
      reason: 'the take ended',
      detail: {},
      ms: 0,
    });
  }
  const engine = current.host.engine();
  const shown = shownV1(current.book, (s, a) => engine?.wordCount(s, a) ?? 0);
  return {
    marks: shown.marks.filter(m => !current.dismissed.has(shownKey(m, m.kind))),
    skippedAyat: shown.skippedAyat,
  };
}

/** Whether a Tilawa 1.0 take is running. */
export function v1TakeActive(): boolean {
  return take !== null && !take.over;
}
