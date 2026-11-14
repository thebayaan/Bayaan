import {trace} from '../debugTake';
import followerConstants from '../followerConstants.npl.json';
import {ensureSecondLookModel, secondLookModelPath} from '../recitationAssets';
import type {RecitationEngine, RecitationStats} from '../recitationEngine';
import {wakesAtStep1} from '../secondJudge/wake';
import type {
  EngineWord,
  JudgeAnswer,
  JudgedVerdict,
  MarkKind,
  WordMark,
} from '../wordMarks';
import {alternativesOf} from './alternatives';
import {recentAudio} from './audioRing';
import {ayahLetters} from './ayahLetters';
import {
  CANCEL_MAY_CANCEL,
  CHECK_QUEUE_CAP,
  CHECK_TIMEOUT_MS,
  JUDGE_STEP,
  type CancelMayCancel,
} from './config';
import {corruptRow} from './corruptOutput';
import {fbankInSteps} from './fbank';
import {
  cancelAnswer,
  innerGap,
  judgeAnswer,
  judgeWord,
  scoresFarTooLow,
  tokensOf,
  type WordJudgement,
} from './judge';
import {
  loadSecondLookModel,
  type ModelOutput,
  type SecondLookModel,
} from './model';
import {
  heardAtHold,
  judgeSlice,
  melRange,
  MIN_MEL_FRAMES,
  MODEL_FRAME_SECONDS,
  paddedRange,
  sliceStartSeconds,
  withSilence,
} from './slice';

// The second judge and the cancel step, as RULE.md in scripts/second-look freezes
// them, and the one queue they share. The follower never waits for any of this: a
// wake returns at once, and all that runs on the JS thread runs in short pieces.
//
// A wake gets one look at its word. One chunk after the verdict its first pass runs
// on the engine's own log-mel frames, and the judge's answer goes back at once. If the
// word is then a suspect, its padded look starts straight away, so the runs overlap
// the wait the mark rules impose anyway: a mark that falls due waits only for what is
// left. A look can only ever answer for its own verdict.

const {holdSeconds} = followerConstants.secondJudge;

const HOLD_MS = holdSeconds * 1000;
// How long to wait, past the hold, for the engine to have heard the chunk the slice
// ends on. Longer means no chunk is coming: the slice goes on with what was heard.
const CHUNK_LATE_MS = HOLD_MS;
const CHUNK_LATE_POLL_MS = 40;
/** The padded look needs an inner letter. */
const LEAST_LETTERS = 3;
/** How far back a mark can still ask about a verdict. */
const KEEP_LOOKS_SECONDS = 30;

/** A word that woke the judge, and the verdict that woke it. */
export interface JudgeWake extends JudgedVerdict {
  /** Names this wake in the answer. */
  id: number;
  audioTime: number;
}

/** What the checks need from the take they run in. */
export interface CheckHost {
  /** The running take's engine, for its log-mel frames and word places. */
  engine: () => RecitationEngine | null;
  /** False once the judge's answer would change nothing: no model need run. */
  wants: (wakeId: number) => boolean;
  /** The judge's answer. `note` says how it came, in numbers, for the trace. */
  answer: (wakeId: number, answer: JudgeAnswer, note: string) => void;
  markOf: (word: EngineWord) => WordMark | undefined;
}

/**
 * What the cancel step says about a word about to be marked. 'cancelled': never
 * shown. 'kept': it shows. 'failed': no answer, and it shows, since a failure must
 * never hide a mark.
 */
export type CheckAnswer =
  | {
      outcome: 'cancelled' | 'kept';
      why: string;
      /** The expected word's score per letter, when the first pass got that far. */
      score: number | null;
      gap: number | null;
      /** How long the mark waited here. */
      ms: number;
    }
  | {outcome: 'failed'; reason: string; ms: number};

/** The kind of mark, and what the judge said about it, go into the check. */
export type CheckTarget = EngineWord & {
  kind: MarkKind;
  identified?: boolean;
};

interface Look {
  wake: JudgeWake;
  letters: readonly string[];
  /** Filled in by the first pass. */
  first: {
    perLetter: number;
    startFrame: number;
    endFrame: number;
    /** Seconds of the slice's start. */
    sliceStart: number;
  } | null;
  /** Undefined until the padded look has run; null with no inner letter. */
  gap: number | null | undefined;
  paddedAsked: boolean;
  failure: string | null;
  timer: ReturnType<typeof setTimeout> | null;
  /** Marks waiting for more of this look. */
  waiters: (() => void)[];
}

/** The looks of one ayah in one chunk: one slice, one model run. */
interface Slot {
  key: string;
  surah: number;
  ayah: number;
  audioTime: number;
  looks: Look[];
  heldSince: number;
}

type Job = {slot: Slot; look?: undefined} | {look: Look; slot?: undefined};

interface TakeStats {
  wakes: number;
  wakesStep2: number;
  firstPasses: number;
  modelRuns: number;
  paddedLooks: number;
  firstMs: number[];
  paddedMs: number[];
  shown: number;
  cancelled: number;
  failedOpen: number;
  timeouts: number;
  dropped: number;
  droppedStep2: number;
  unneeded: number;
  queueMax: number;
  backlogMax: number;
}

interface CheckTake {
  host: CheckHost;
  /** What the cancel step may cancel this take. */
  mayCancel: CancelMayCancel;
  looks: Map<string, Look>;
  /** Each word's newest look. */
  newest: Map<string, Look>;
  holds: Map<string, Slot>;
  jobs: Job[];
  running: boolean;
  stats: TakeStats;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const nextTask = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });

const wordName = (word: EngineWord) =>
  `${word.surah}:${word.ayah} word ${word.word + 1}`;

const two = (value: number) => value.toFixed(2);

let model: SecondLookModel | null = null;
let loading: Promise<SecondLookModel | null> | null = null;
// Bumped by every load and unload, so a load still under way knows it was
// dropped.
let loadRun = 0;

async function load(run: number): Promise<SecondLookModel | null> {
  const path = await secondLookModelPath();
  if (!path) {
    // An install from before the second look has the other files only, and a new
    // install may still be fetching it: this joins that download. This take goes
    // without it, and the next one has it.
    trace('second look: no model file, downloading it for the next take');
    ensureSecondLookModel().catch(error => {
      console.warn('[recitation] could not download the second model', error);
    });
    return null;
  }
  const startedAt = Date.now();
  const loaded = await loadSecondLookModel(path);
  if (run !== loadRun) {
    await loaded.release();
    return null;
  }
  model = loaded;
  trace(`second look: model loaded in ${Date.now() - startedAt} ms`);
  return loaded;
}

/**
 * Loads the model in the background at the start of a take, off the JS thread:
 * the follower does not wait for it.
 */
export function prepareSecondLook(): void {
  if (model || loading) return;
  const run = ++loadRun;
  loading = load(run)
    .catch(error => {
      trace(`second look: model failed to load (${messageOf(error)})`);
      return null;
    })
    .finally(() => {
      if (run === loadRun) loading = null;
    });
}

// The live check (liveCheck/runner.ts) runs this same model between looks. One run
// at a time: a look waits for the live check's run to end before its own. Never set
// while the live check is off.
let otherRun: Promise<void> | null = null;

/** The loaded model, for the live check, or null. Loads nothing. */
export function secondLookModel(): SecondLookModel | null {
  return model;
}

/**
 * A look is running or waiting its turn, or a live run is still on the model (one an
 * earlier take started, too): the live check leaves the model alone.
 */
export function secondLookBusy(): boolean {
  if (otherRun) return true;
  return take !== null && (take.running || take.jobs.length > 0);
}

/** The live check's run of the model: looks wait for it, whatever its outcome. */
export function holdSecondLookModel(run: Promise<unknown>): void {
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  otherRun = settled;
  void settled.then(() => {
    if (otherRun === settled) otherRun = null;
  });
}

/** Lets the model go; the next take loads it again. */
export async function unloadSecondLook(): Promise<void> {
  loadRun += 1;
  loading = null;
  const loaded = model;
  model = null;
  try {
    await loaded?.release();
  } catch (error) {
    trace(`second look: could not release the model (${messageOf(error)})`);
  }
}

let take: CheckTake | null = null;

const wordKey = (word: EngineWord) => `${word.surah}:${word.ayah}:${word.word}`;
const lookKey = (word: EngineWord, audioTime: number) =>
  `${wordKey(word)}@${audioTime}`;

const isStep2Only = (slot: Slot) =>
  slot.looks.every(look => !wakesAtStep1(look.wake.state));

function clearTimer(look: Look): void {
  if (look.timer) clearTimeout(look.timer);
  look.timer = null;
}

function wakeWaiters(look: Look): void {
  const waiters = look.waiters;
  look.waiters = [];
  for (const waiter of waiters) waiter();
}

/**
 * This look will say no more. Before its first pass that means the judge says
 * nothing, and any mark that asks about it shows.
 */
function fail(current: CheckTake, look: Look, reason: string): void {
  if (look.failure) return;
  look.failure = reason;
  clearTimer(look);
  if (!look.first) {
    current.host.answer(look.wake.id, 'neither', `, no answer (${reason})`);
  }
  wakeWaiters(look);
}

function startTimer(current: CheckTake, look: Look): void {
  clearTimer(look);
  look.timer = setTimeout(() => {
    look.timer = null;
    current.stats.timeouts += 1;
    fail(current, look, `no answer within ${CHECK_TIMEOUT_MS / 1000} s`);
  }, CHECK_TIMEOUT_MS);
}

/**
 * A run whose output a broken onnxruntime build spoiled fails as a failed run does:
 * its looks say nothing and the mark shows, rather than score on garbage.
 */
function assertCleanOutput(output: ModelOutput): void {
  const row = corruptRow(output.logp, output.frames);
  if (row >= 0) throw new Error(`corrupted model output, row ${row}`);
}

function noteBacklog(current: CheckTake): void {
  const backlog = current.host.engine()?.getStats().backlog ?? 0;
  current.stats.backlogMax = Math.max(current.stats.backlogMax, backlog);
}

/** A mark may be cancelled at all: the phone switch and Step 2's rule. */
function mayCancel(switched: CancelMayCancel, target: CheckTarget): boolean {
  if (switched === 'skipped' && target.kind === 'wrong') return false;
  return !(JUDGE_STEP === 2 && target.identified);
}

function wantsPaddedLook(first: NonNullable<Look['first']>, look: Look) {
  return (
    first.startFrame >= 0 &&
    !scoresFarTooLow(first.perLetter) &&
    look.letters[look.wake.word].length >= LEAST_LETTERS
  );
}

function askPadded(current: CheckTake, look: Look): void {
  if (look.paddedAsked || look.failure) return;
  look.paddedAsked = true;
  startTimer(current, look);
  // Ahead of the slices waiting: this mark is the nearest to showing.
  current.jobs.unshift({look});
  void pump(current);
}

function holdIsOver(current: CheckTake, slot: Slot, waited: number): void {
  if (current !== take) return;
  const {last} = melRange(0, heardAtHold(slot.audioTime));
  const engine = current.host.engine();
  if (
    engine &&
    waited < CHUNK_LATE_MS &&
    engine.readMelFrames(last - 1, last).frames === 0
  ) {
    setTimeout(
      () => holdIsOver(current, slot, waited + CHUNK_LATE_POLL_MS),
      CHUNK_LATE_POLL_MS,
    );
    return;
  }
  current.holds.delete(slot.key);
  enqueue(current, slot);
}

/** A slot in the queue, or fail open: Step 2's wakes make way for Step 1's. */
function enqueue(current: CheckTake, slot: Slot): void {
  const {stats, jobs} = current;
  const waiting = jobs.filter(job => job.slot);
  if (waiting.length >= CHECK_QUEUE_CAP) {
    const makeWay = isStep2Only(slot)
      ? undefined
      : waiting.find(job => job.slot && isStep2Only(job.slot));
    const dropped = makeWay?.slot ?? slot;
    if (makeWay) jobs.splice(jobs.indexOf(makeWay), 1);
    for (const look of dropped.looks) {
      stats.dropped += 1;
      if (!wakesAtStep1(look.wake.state)) stats.droppedStep2 += 1;
      fail(current, look, 'no room in the queue');
    }
    if (dropped === slot) return;
  }
  for (const look of slot.looks) startTimer(current, look);
  jobs.push({slot});
  stats.queueMax = Math.max(stats.queueMax, jobs.length);
  void pump(current);
}

async function pump(current: CheckTake): Promise<void> {
  if (current.running) return;
  current.running = true;
  while (current === take && current.jobs.length > 0) {
    const job = current.jobs.shift() as Job;
    try {
      if (job.slot) await runFirstPass(current, job.slot);
      else await runPadded(current, job.look);
    } catch (error) {
      for (const look of job.slot?.looks ?? [job.look as Look]) {
        fail(current, look, messageOf(error));
      }
    }
  }
  current.running = false;
}

async function runFirstPass(current: CheckTake, slot: Slot): Promise<void> {
  const looks = slot.looks.filter(look => {
    if (look.failure) return false;
    if (current.newest.get(wordKey(look.wake)) !== look) {
      // Only the latest verdict's slice counts: a queue that has fallen behind
      // does not spend its time on an older one.
      current.stats.unneeded += 1;
      fail(current, look, 'a newer verdict stands');
      return false;
    }
    if (current.host.wants(look.wake.id)) return true;
    current.stats.unneeded += 1;
    fail(current, look, 'no longer needed');
    return false;
  });
  if (looks.length === 0) return;
  noteBacklog(current);
  const startedAt = Date.now();
  const failAll = (reason: string) => {
    for (const look of looks) fail(current, look, reason);
  };
  const ready = model ?? (await loading);
  if (current !== take || looks.every(look => look.failure)) return;
  const engine = current.host.engine();
  if (!ready || !engine) {
    failAll('no model');
    return;
  }
  const {start, end} = judgeSlice(
    engine,
    slot.surah,
    slot.ayah,
    slot.audioTime,
    recentAudio.heard(),
  );
  const {first, last} = melRange(start, end);
  const span = engine.readMelFrames(first, last);
  if (span.first !== first || span.frames < MIN_MEL_FRAMES) {
    failAll('too little of the slice');
    return;
  }
  if (otherRun) {
    await otherRun;
    if (current !== take) return;
  }
  const runAt = Date.now();
  const output = await ready.run(span.data, span.frames);
  const modelMs = Date.now() - runAt;
  current.stats.modelRuns += 1;
  if (current !== take) return;
  assertCleanOutput(output);
  // Every score first, with pauses between them, then every answer in one go: words of
  // one chunk fall due together, and show together with one vibration.
  const scored: {look: Look; judged: WordJudgement}[] = [];
  for (const [i, look] of looks.entries()) {
    if (look.failure) continue;
    const {word} = look.wake;
    scored.push({
      look,
      judged: judgeWord(
        output.logp,
        output.frames,
        look.letters,
        word,
        alternativesOf(slot.surah, slot.ayah, word),
      ),
    });
    if (i < looks.length - 1) await nextTask();
    if (current !== take) return;
  }
  for (const {look, judged} of scored) {
    if (look.failure) continue;
    look.first = {
      perLetter: judged.perLetter,
      startFrame: judged.startFrame,
      endFrame: judged.endFrame,
      sliceStart: sliceStartSeconds(start),
    };
    clearTimer(look);
    const ms = Date.now() - startedAt;
    current.stats.firstPasses += 1;
    current.stats.firstMs.push(ms);
    const best = judged.mut[0]?.s;
    const waited = Math.max(0, startedAt - slot.heldSince);
    current.host.answer(
      look.wake.id,
      judgeAnswer(judged),
      `, expected ${two(judged.expected)} (${two(judged.perLetter)} a letter), no word ${two(judged.nothing)}, best other ${best === undefined ? 'none' : two(best)}, ${ms} ms (model ${modelMs}, waited ${waited}), queue ${current.jobs.length}`,
    );
    startPaddedIfSuspect(current, look);
    wakeWaiters(look);
  }
}

/** The word is a suspect on this very verdict: its padded look overlaps the wait. */
function startPaddedIfSuspect(current: CheckTake, look: Look): void {
  const mark = current.host.markOf(look.wake);
  if (
    (mark?.status === 'suspect' || mark?.status === 'checking') &&
    mark.lastBadAudio === look.wake.audioTime &&
    mayCancel(current.mayCancel, mark) &&
    look.first &&
    wantsPaddedLook(look.first, look)
  ) {
    askPadded(current, look);
  }
}

async function runPadded(current: CheckTake, look: Look): Promise<void> {
  if (look.failure) return;
  const mark = current.host.markOf(look.wake);
  if (mark?.status !== 'suspect' && mark?.status !== 'checking') {
    fail(current, look, 'the mark has gone');
    return;
  }
  const first = look.first as NonNullable<Look['first']>;
  const startedAt = Date.now();
  const ready = model ?? (await loading);
  if (current !== take) return;
  if (!ready) {
    fail(current, look, 'no model');
    return;
  }
  const range = paddedRange(
    first.sliceStart + first.startFrame * MODEL_FRAME_SECONDS,
    first.sliceStart + (first.endFrame + 1) * MODEL_FRAME_SECONDS,
    heardAtHold(look.wake.audioTime),
    recentAudio.heard(),
  );
  if (!range) {
    fail(current, look, 'too little to cut');
    return;
  }
  const wave = withSilence(recentAudio.samples(range.start, range.end));
  const features = await fbankInSteps(wave);
  const featuresAt = Date.now();
  if (current !== take || look.failure) return;
  if (otherRun) {
    await otherRun;
    if (current !== take || look.failure) return;
  }
  const output = await ready.run(features.data, features.frames);
  current.stats.modelRuns += 1;
  if (current !== take || look.failure) return;
  assertCleanOutput(output);
  look.gap = innerGap(
    output.logp,
    output.frames,
    tokensOf(look.letters[look.wake.word]),
  );
  clearTimer(look);
  const ms = Date.now() - startedAt;
  current.stats.paddedLooks += 1;
  current.stats.paddedMs.push(ms);
  trace(
    `padded ${wordName(look.wake)} at ${two(look.wake.audioTime)} s: gap ${look.gap === null ? 'none' : two(look.gap)}, ${ms} ms (features ${featuresAt - startedAt}, model ${Date.now() - featuresAt}), queue ${current.jobs.length}`,
  );
  wakeWaiters(look);
}

/**
 * A word woke the judge. Returns at once; its first pass starts at the end of the
 * hold, and the answer goes to the host's `answer`.
 */
export function wakeCheck(wake: JudgeWake): void {
  const current = take;
  if (!current) return;
  const {stats, looks, holds} = current;
  stats.wakes += 1;
  if (!wakesAtStep1(wake.state)) stats.wakesStep2 += 1;
  noteBacklog(current);
  const letters = ayahLetters(wake.surah, wake.ayah);
  const look: Look = {
    wake,
    letters: letters ?? [],
    first: null,
    gap: undefined,
    paddedAsked: false,
    failure: null,
    timer: null,
    waiters: [],
  };
  for (const [key, old] of looks) {
    if (wake.audioTime - old.wake.audioTime > KEEP_LOOKS_SECONDS) {
      looks.delete(key);
    }
  }
  looks.set(lookKey(wake, wake.audioTime), look);
  current.newest.set(wordKey(wake), look);
  if (!letters?.[wake.word]) {
    fail(current, look, 'no letters for this word');
    return;
  }
  if (!model && !loading) {
    fail(current, look, 'no model');
    return;
  }
  const key = `${wake.surah}:${wake.ayah}@${wake.audioTime}`;
  const held = holds.get(key);
  if (held) {
    held.looks.push(look);
    return;
  }
  const slot: Slot = {
    key,
    surah: wake.surah,
    ayah: wake.ayah,
    audioTime: wake.audioTime,
    looks: [look],
    heldSince: Date.now() + HOLD_MS,
  };
  holds.set(key, slot);
  setTimeout(() => holdIsOver(current, slot, 0), HOLD_MS);
}

/**
 * The cancel step, for a word about to be marked: the frozen rule's order. Never
 * throws or rejects. When it knows at once it answers at once rather than with a
 * promise, so that mark shows in the same tick. Otherwise it answers when what is left
 * of its look is done, and a look that takes too long shows the mark.
 * @param audioTime - Seconds of the take's fed audio at the end of the chunk behind
 *   the word's latest bad verdict
 */
export function checkWord(
  target: CheckTarget,
  audioTime: number | undefined,
): CheckAnswer | Promise<CheckAnswer> {
  const startedAt = Date.now();
  const current = take;
  const done = (answer: CheckAnswer): CheckAnswer => {
    if (current) {
      if (answer.outcome === 'kept') current.stats.shown += 1;
      else if (answer.outcome === 'cancelled') current.stats.cancelled += 1;
      else current.stats.failedOpen += 1;
    }
    return answer;
  };
  const failed = (reason: string) =>
    done({outcome: 'failed', reason, ms: Date.now() - startedAt});
  const said = (
    outcome: 'kept' | 'cancelled',
    why: string,
    score: number | null,
    gap: number | null,
  ) => done({outcome, why, score, gap, ms: Date.now() - startedAt});
  if (!mayCancel(current?.mayCancel ?? CANCEL_MAY_CANCEL, target))
    return said('kept', 'may not be cancelled', null, null);
  if (!current || audioTime === undefined) return failed('no check');
  const look = current.looks.get(lookKey(target, audioTime));
  if (!look) return failed('no check for this verdict');
  const decide = (): CheckAnswer | null => {
    if (look.failure) return failed(look.failure);
    const first = look.first;
    if (!first) return null;
    if (first.startFrame < 0) return failed('no path');
    if (scoresFarTooLow(first.perLetter)) {
      return said('kept', 'scores far too low', first.perLetter, null);
    }
    if (look.letters[look.wake.word].length < LEAST_LETTERS) {
      return said('cancelled', 'no inner letter', first.perLetter, null);
    }
    if (look.gap === undefined) {
      askPadded(current, look);
      return null;
    }
    return cancelAnswer(first.perLetter, look.gap) === 'keep'
      ? said('kept', 'a spelling beats it', first.perLetter, look.gap)
      : said('cancelled', 'no spelling beats it', first.perLetter, look.gap);
  };
  const known = decide();
  if (known) return known;
  return new Promise(resolve => {
    const tryAgain = () => {
      const answer = decide();
      if (answer) resolve(answer);
      else look.waiters.push(tryAgain);
    };
    look.waiters.push(tryAgain);
  });
}

/**
 * A take begins: the checks start clean, and nothing earlier can reach it.
 * @param switched - What the cancel step may cancel this take
 */
export function startCheckTake(
  host: CheckHost,
  switched: CancelMayCancel = CANCEL_MAY_CANCEL,
): void {
  take = {
    host,
    mayCancel: switched,
    looks: new Map(),
    newest: new Map(),
    holds: new Map(),
    jobs: [],
    running: false,
    stats: {
      wakes: 0,
      wakesStep2: 0,
      firstPasses: 0,
      modelRuns: 0,
      paddedLooks: 0,
      firstMs: [],
      paddedMs: [],
      shown: 0,
      cancelled: 0,
      failedOpen: 0,
      timeouts: 0,
      dropped: 0,
      droppedStep2: 0,
      unneeded: 0,
      queueMax: 0,
      backlogMax: 0,
    },
  };
}

function medianAndMax(values: readonly number[]): string {
  if (values.length === 0) return 'median - max -';
  const sorted = [...values].sort((a, b) => a - b);
  return `median ${sorted[sorted.length >> 1]} max ${sorted[sorted.length - 1]}`;
}

/** The take is over: whatever is still running can settle nothing. Sums it up. */
export function endCheckTake(follower: RecitationStats | null): void {
  const current = take;
  take = null;
  if (!current) return;
  for (const look of current.looks.values()) {
    clearTimer(look);
    look.failure ??= 'the take ended';
    wakeWaiters(look);
  }
  const s = current.stats;
  trace(
    `checks this take: ${s.wakes} wakes (${s.wakesStep2} step 2 only), ${s.firstPasses} first passes (${s.unneeded} not needed), ${s.paddedLooks} padded looks, ${s.modelRuns} model runs; first pass ${medianAndMax(s.firstMs)} ms, padded ${medianAndMax(s.paddedMs)} ms; ${s.shown} shown, ${s.cancelled} cancelled, ${s.failedOpen} failed open; ${s.timeouts} timeouts, ${s.dropped} dropped (${s.droppedStep2} step 2), queue max ${s.queueMax}; follower backlog now ${follower?.backlog ?? 0} max ${Math.max(s.backlogMax, follower?.backlog ?? 0)}, slowest chunk ${Math.round(follower?.maxFeedMs ?? 0)} ms, real time ${follower && follower.audioSeconds > 0 ? two(follower.busyMs / 1000 / follower.audioSeconds) : '-'}`,
  );
}
