import * as Haptics from 'expo-haptics';
import type {CorrectionIssue, ExpectedPassage, SearchHint} from '@tilawa/core';
import {
  isTakeActive,
  RECITATION_TRACKING_IDLE,
  useRecitationTrackingStore,
  type RecitationSummaryMark,
} from '@/store/recitationTrackingStore';
import i18n from '@/i18n';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import type {RecitationStopReason} from '@/services/analytics/events';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {scheduleUnload} from './engineHost';
import {recitationLogDatabase} from './RecitationLogDatabase';
import {
  finishTake,
  startTake,
  takeEvent,
  takePeek,
  type TakeBuilder,
  type TakeRecord,
  type TakeWord,
} from './take';
import type {
  EngineMessage,
  RecitationEngine,
  RecitationStats,
} from './recitationEngine';
import {
  addedKey,
  applyJudgeAnswer,
  applyVerdicts,
  cancelCheck,
  confirmDue,
  dropLockArtifacts,
  dropRealignment,
  dropSuspects,
  emptyMarkBook,
  endJudgeWaits,
  finishChecks,
  holdForJudge,
  isFilteredChunk,
  judgeAnswerMatters,
  judgeAnswerStillDue,
  nextConfirmAt,
  rememberVerdicts,
  shownMarks,
  skipsSecondLook,
  startChecks,
  markKey,
  wordMarkKey,
  type JudgeAnswer,
  type JudgedVerdict,
  type MarkBook,
  type EngineWord,
  type MarkKind,
  type SeenVerdict,
  type VerdictChange,
  type WordMark,
} from './wordMarks';
import {
  activeSessionPurpose,
  configureSession,
  holdSession,
  releaseSession,
  sessionEngine,
  setSessionHint,
  startSession,
  stopSession,
  type SessionHandlers,
  type SessionUpdate,
} from './sessionRunner';
import {
  checkWord,
  endCheckTake,
  prepareSecondLook,
  startCheckTake,
  wakeCheck,
  type CheckAnswer,
  type CheckHost,
  type JudgeWake,
} from './secondLook/checkWord';
import {CANCEL_MAY_CANCEL, SECOND_LOOK_ENABLED} from './secondLook/config';
import {wakesSecondJudge} from './secondJudge/wake';
import {shownFlags, toShownFlag} from './flags';
import {debugTakeSave, debugTakeStart, trace} from './debugTake';
import {
  advanceRevealed,
  isRevealed,
  peekAyah,
  peekWord,
  type AyahRef,
  type RevealSource,
} from './reveal';
import {
  LIVE_BUZZ_GAP_MS,
  LIVE_CHECK_ENABLED,
  LIVE_REVEAL_WAIT_MS,
} from './liveCheck/config';
import {applyLiveOpinions, type LiveMarkGate} from './liveCheck/liveMarks';
import {
  defaultLivePort,
  startLiveCheck,
  type LiveCheckPort,
  type LiveRunner,
} from './liveCheck/runner';
import type {LiveOpinion} from './liveCheck/types';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {dkWordPosition} from '@/components/mushaf/skia/recitedWord';
import {SURAHS} from '@/data/surahData';

// Follow-along: follows a live recitation in the mushaf and publishes the
// ayah and word being recited to useRecitationTrackingStore. The session
// (mic, model, watchdog) belongs to sessionRunner.

export {
  recitationModelNeedsDownload,
  recitationModelOnPhone,
  scheduleUnload,
  unloadRecitationModel,
} from './engineHost';
export {removeRecitationModel} from './sessionRunner';

// The model stays loaded this long after an error clears.
const IDLE_UNLOAD_MS = 5 * 60 * 1000;

// The current take, for analytics.
let takeStartedAt = 0;
let takeLockedAt: number | null = null;
let takeHint: SearchHint | null = null;
// The ayat on the open page: the engine's guess at the reader's place shows
// before the lock only when it is one of them.
let takePage: ReadonlySet<string> = new Set();
// The current take, for the recitation log.
let take: TakeBuilder | null = null;

// Checking: at each lock the take switches to correction mode, expecting the
// rest of that surah. Hidden or not, the reader's words are judged as they
// recite.
interface Memorisation {
  hidden: boolean;
  /** "Check my recitation" was on when the take started. */
  check: boolean;
  correction: boolean;
  /** Correction mode was on at some point in the take. */
  checked: boolean;
  expected: ExpectedPassage | null;
  /** Flags the reader marked "I read it correctly". */
  dismissed: ReadonlySet<string>;
}
let memo: Memorisation | null = null;

// Live word marks for the current take (see wordMarks), and the timer that
// confirms suspects.
let book: MarkBook = emptyMarkBook();
let confirmTimer: ReturnType<typeof setTimeout> | null = null;
// Numbers each second look, across takes, so an answer can only ever settle the
// marks it was asked about.
let lastCheckId = 0;
// Each judged word's last verdict, for the take's record.
interface JudgedWord {
  change: VerdictChange;
  hidden: boolean;
  at: number;
}
let judged = new Map<string, JudgedWord>();
// Marks the reader dismissed this take ("I read it correctly"), by key.
let dismissedMarks = new Map<string, MarkKind>();
// The added ones among them, for the take's record.
let dismissedAdded: WordMark[] = [];
// The last finished take, for dismissals after it ends.
let lastTakeId: string | null = null;

// Takes that end in the mushaf get a summary; the others (left the mushaf,
// app in the background, playback, another session) are only logged.
const SUMMARY_REASONS: ReadonlySet<RecitationStopReason> = new Set([
  'user',
  'mic_silent',
  'interruption',
]);

// The expected passage: PASSAGE_AYAT ayat from where the tracker locked,
// sliding forward as the reader nears its end. Tilawa's tracker follows the
// whole surah either way; the passage bounds the structural check at stop,
// whose time and memory grow steeply with it (Al-Baqarah 2:7-286 ran a
// phone out of memory). With ten ayat the check runs in slices at stop, so the JS
// thread stays free: in Hermes on a Mac, about 1.4 s of work at 2:215 with a voice
// behind, no piece over 50 ms. No phone has been timed. Getting lost goes back to
// tracking (dropToTracking), so moving the passage never makes a search snap to its
// first ayah.
const PASSAGE_AYAT = 10;
// Slide once a recited ayah is this close to the passage's end.
const SLIDE_WITHIN = 3;

function surahLength(surah: number, fallback: number): number {
  return SURAHS[surah - 1]?.verses_count ?? fallback;
}

function passageFrom(from: {surah: number; ayah: number}): ExpectedPassage {
  const last = surahLength(from.surah, from.ayah);
  return {
    ...from,
    ayahEnd: Math.max(from.ayah, Math.min(last, from.ayah + PASSAGE_AYAT - 1)),
  };
}

/** The reader nears the passage's end: start it an ayah back, ten long. */
function slidePassage(matched: {surah: number; ayah: number}): void {
  const expected = memo?.expected;
  if (!memo?.correction || !expected || matched.surah !== expected.surah) {
    return;
  }
  const end = expected.ayahEnd ?? expected.ayah;
  if (end >= surahLength(expected.surah, end)) return;
  if (matched.ayah <= end - SLIDE_WITHIN) return;
  memo.expected = passageFrom({
    surah: matched.surah,
    ayah: Math.max(1, matched.ayah - 1),
  });
  configureSession({expected: memo.expected});
  trace(
    `checking ${memo.expected.surah}:${memo.expected.ayah}-${memo.expected.ayahEnd}`,
  );
}

function startCorrection(from: {surah: number; ayah: number}): void {
  if (!memo) return;
  memo.expected = passageFrom(from);
  memo.correction = true;
  memo.checked = true;
  trace(
    `checking ${from.surah}:${from.ayah}-${memo.expected.ayahEnd ?? from.ayah}`,
  );
  configureSession({
    mode: 'correction',
    expected: memo.expected,
    structural: true,
  });
}

function stopCorrection(): void {
  if (!memo?.correction) return;
  memo.correction = false;
  memo.expected = null;
  configureSession({mode: 'tracking', expected: null, structural: false});
}

function skippedAyat(): Set<string> {
  return new Set(
    useRecitationTrackingStore
      .getState()
      .flags.filter(f => f.kind === 'skippedAyah')
      .map(f => `${f.surah}:${f.ayah}`),
  );
}

function publishMarks(): void {
  setState({marks: shownMarks(book, skippedAyat())});
}

function clearConfirmTimer(): void {
  if (confirmTimer) clearTimeout(confirmTimer);
  confirmTimer = null;
}

function scheduleConfirm(): void {
  clearConfirmTimer();
  const at = nextConfirmAt(book);
  if (at === null) return;
  confirmTimer = setTimeout(runConfirm, Math.max(0, at - Date.now()));
}

function runConfirm(): void {
  confirmTimer = null;
  if (!isTakeActive(useRecitationTrackingStore.getState().status)) return;
  const update = confirmDue(book, Date.now());
  book = update.book;
  const toCheck = SECOND_LOOK_ENABLED
    ? update.confirmed.filter(mark => !skipsSecondLook(mark))
    : [];
  const atOnce = update.confirmed.filter(mark => !toCheck.includes(mark));
  // Held back before anything is published, so they cannot reach the page early.
  const checkId = ++lastCheckId;
  book = startChecks(book, toCheck, checkId);
  const toShow = [...atOnce, ...askSecondLook(toCheck, checkId)];
  if (toShow.length > 0) showMarks(toShow);
  scheduleConfirm();
}

function traceMarks(marks: readonly WordMark[]): void {
  for (const m of marks) {
    trace(`MARK ${m.kind} ${m.surah}:${m.ayah} word ${m.word + 1}`);
  }
}

function showMarks(marks: readonly WordMark[]): void {
  traceMarks(marks);
  // A live mark just buzzed for this moment.
  if (!LIVE_CHECK_ENABLED || Date.now() - lastLiveBuzzAt >= LIVE_BUZZ_GAP_MS) {
    buzz();
  }
  publishMarks();
}

function traceCheck(mark: WordMark, answer: CheckAnswer, counted: boolean) {
  const word = `check ${mark.surah}:${mark.ayah} word ${mark.word + 1} ${mark.kind}`;
  if (answer.outcome === 'failed') {
    trace(`${word}: failed open (${answer.reason}), waited ${answer.ms} ms`);
    return;
  }
  const result = !counted
    ? 'too late to count'
    : answer.outcome === 'kept'
      ? 'shows'
      : 'cancelled';
  const score =
    answer.score === null ? '' : `, ${answer.score.toFixed(2)} a letter`;
  const gap = answer.gap === null ? '' : `, gap ${answer.gap.toFixed(2)}`;
  trace(
    `${word}: ${result} (${answer.why})${score}${gap}, waited ${answer.ms} ms`,
  );
}

/**
 * Marks held back as 'checking' wait until the second look has answered for all of
 * them: then those that stay show together, with one vibration, as marks confirmed
 * together always have. A check that fails leaves its mark to show.
 * @returns The marks to show if all answered in this tick, for the caller to show
 *   with its own. Otherwise they show when the last answer comes.
 */
function askSecondLook(
  marks: readonly WordMark[],
  checkId: number,
): WordMark[] {
  let waiting = marks.length;
  let asking = true;
  let inThisTick: WordMark[] = [];
  const answered = (mark: WordMark, answer: CheckAnswer) => {
    const key = markKey(mark.surah, mark.ayah, mark.word);
    const current = book.get(key);
    traceCheck(
      mark,
      answer,
      current?.status === 'checking' && current.checkId === checkId,
    );
    if (answer.outcome === 'cancelled') {
      book = cancelCheck(book, mark, checkId);
    }
    waiting -= 1;
    if (waiting > 0) return;
    const update = finishChecks(book, checkId);
    book = update.book;
    if (asking) inThisTick = update.confirmed;
    else if (update.confirmed.length > 0) showMarks(update.confirmed);
  };
  for (const mark of marks) {
    const answer = checkWord(mark, mark.lastBadAudio);
    if ('then' in answer) {
      void answer.then(
        result => answered(mark, result),
        error =>
          answered(mark, {
            outcome: 'failed',
            reason: String(error),
            ms: 0,
          }),
      );
    } else {
      answered(mark, answer);
    }
  }
  asking = false;
  return inThisTick;
}

/** One short vibration for a newly marked mistake, if the reader wants it. */
function buzz(): void {
  if (LIVE_CHECK_ENABLED) lastBuzzAt = Date.now();
  const on = useMushafSettingsStore.getState().recitationMistakeHaptics;
  trace(`vibrate ${on ? 'on' : 'off (setting)'}`);
  if (!on) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
    () => undefined,
  );
}

// The seam the second judge plugs into. The judge hears each word that wakes it
// through its port, reads what it needs from secondJudgeEngine(), and later answers
// with answerSecondJudge(). Nothing here waits: until an answer comes the follower
// and the other marks go on, and a suspect waits for at most JUDGE_WAIT_MS.

export type {JudgeWake};

export interface SecondJudgePort {
  /** Must return at once. Called in the engine's own event, after the filters. */
  wake: (wake: JudgeWake) => void;
}

let judgePort: SecondJudgePort | null = SECOND_LOOK_ENABLED
  ? {wake: wakeCheck}
  : null;
let lastWakeId = 0;
// Wakes not answered yet. Losing the reader or ending the take forgets them.
let judgeWaiting = new Map<number, JudgedVerdict>();
let seenVerdicts: SeenVerdict[] = [];

/** Attaches the second judge, or with null takes it away. */
export function setSecondJudgePort(port: SecondJudgePort | null): void {
  judgePort = port;
}

/** The running take's engine, for its log-mel frames and word places. */
export function secondJudgeEngine(): RecitationEngine | null {
  return activeSessionPurpose() === 'follow' ? sessionEngine() : null;
}

/** False once a wake no longer matters: no model need run for it. */
export function secondJudgeWants(wakeId: number): boolean {
  const verdict = judgeWaiting.get(wakeId);
  return !!verdict && judgeAnswerMatters(book, verdict, seenVerdicts);
}

/**
 * The judge's answer to a wake. One that no longer matters does nothing.
 * @param note - How the answer came, in numbers, for the trace
 */
export function answerSecondJudge(
  wakeId: number,
  answer: JudgeAnswer,
  note = '',
): void {
  const verdict = judgeWaiting.get(wakeId);
  if (!verdict) return;
  judgeWaiting.delete(wakeId);
  const key = markKey(verdict.surah, verdict.ayah, verdict.word);
  if (dismissedMarks.has(key)) return;
  const before = book.get(key)?.status ?? 'none';
  book = applyJudgeAnswer(book, verdict, answer, seenVerdicts);
  trace(
    `judge ${verdict.surah}:${verdict.ayah} word ${verdict.word + 1} ${verdict.state} at ${(verdict.audioTime ?? 0).toFixed(2)} s: ${answer}${note}, mark ${before} to ${book.get(key)?.status ?? 'none'}`,
  );
  // A corrected word is on the page, and a new suspect takes its place in the book.
  if (before === 'corrected') publishMarks();
  scheduleConfirm();
}

const checkHost: CheckHost = {
  engine: secondJudgeEngine,
  wants: secondJudgeWants,
  answer: answerSecondJudge,
  markOf: word => book.get(markKey(word.surah, word.ayah, word.word)),
};

function forgetJudgeWakes(): void {
  judgeWaiting = new Map();
  seenVerdicts = [];
}

/**
 * What the engine suspected just before losing the reader is not trustworthy, and
 * nor is what the judge may yet say about it. Marks already shown stay, and so does
 * a word that would have shown by now but for the judge's time.
 */
function dropWhatTheReaderLeftBehind(now: number): void {
  book = dropSuspects(book, now);
  judgeWaiting = new Map(
    [...judgeWaiting].filter(
      ([, verdict]) =>
        book.get(markKey(verdict.surah, verdict.ayah, verdict.word))?.status ===
          'suspect' || judgeAnswerStillDue(verdict, seenVerdicts, now),
    ),
  );
}

function wakeSecondJudge(
  port: SecondJudgePort,
  changes: readonly VerdictChange[],
  now: number,
  audioTime: number,
): void {
  for (const change of changes) {
    if (!wakesSecondJudge(change)) continue;
    const wake: JudgeWake = {
      id: ++lastWakeId,
      surah: change.surah,
      ayah: change.ayah,
      word: change.word,
      totalWords: change.totalWords,
      state: change.state,
      at: now,
      audioTime,
    };
    judgeWaiting.set(wake.id, wake);
    book = holdForJudge(book, wake, now);
    port.wake(wake);
  }
}

function noteVerdicts(
  all: readonly VerdictChange[],
  audioTime: number,
  mayWakeJudge: boolean,
): void {
  const now = Date.now();
  // A word the reader said they read correctly is not marked again.
  const changes = all
    .filter(c => !dismissedMarks.has(markKey(c.surah, c.ayah, c.word)))
    .map(c =>
      c.addedBefore && dismissedMarks.has(addedKey(c))
        ? {...c, addedBefore: undefined}
        : c,
    );
  for (const change of changes) {
    if (change.repeat) continue;
    if (
      change.state !== 'pending' &&
      (change.state !== 'ok' ||
        book.has(markKey(change.surah, change.ayah, change.word)))
    ) {
      trace(
        `verdict ${change.surah}:${change.ayah} word ${change.word + 1}/${change.totalWords} ${change.state}`,
      );
    }
    if (change.state === 'pending') continue;
    judged.set(`${change.surah}:${change.ayah}:${change.word}`, {
      change,
      hidden: memo?.hidden ?? false,
      at: now,
    });
  }
  const update = applyVerdicts(book, changes, now, audioTime);
  for (const m of update.corrected) {
    trace(`CORRECTED ${m.surah}:${m.ayah} word ${m.word + 1}`);
  }
  const before = book;
  book = update.book;
  if (judgePort) {
    seenVerdicts = rememberVerdicts(seenVerdicts, changes, now);
    if (mayWakeJudge) wakeSecondJudge(judgePort, changes, now, audioTime);
  }
  if (book === before) return;
  if (update.confirmed.length > 0) showMarks(update.confirmed);
  else publishMarks();
  scheduleConfirm();
}

// The live check (liveCheck/): the second model re-reads the last seconds about twice
// a second and gives its own opinion on each word. Its marks share the book and the
// page with the follower's, in their own lane (liveCheck/liveMarks). Nothing here runs
// unless LIVE_CHECK_ENABLED.

let livePort: LiveCheckPort | null = defaultLivePort;
let live: LiveRunner | null = null;
// When the last vibration came, so a live mark does not buzz twice for one moment.
let lastBuzzAt = -Infinity;
// When a live mark last buzzed, so a follower mark right after it does not buzz again.
let lastLiveBuzzAt = -Infinity;
// Whether the text was hidden when each live mark was made, for the take's record.
let liveHidden = new Map<string, boolean>();
// Live marks the reader dismissed this take, for the take's record.
let dismissedLive = new Map<string, WordMark>();
// Live mistakes on hidden words not revealed yet, and since when they wait.
let liveHeld = new Map<string, {opinion: LiveOpinion; since: number}>();
// Readings that waited too long: sent again on later runs, they are not held again.
let liveGaveUp = new Set<string>();
// The latest reading of each word the live lane marked or corrected, by markKey.
let liveSettled = new Map<string, number>();
const readingKey = (opinion: LiveOpinion) =>
  `${markKey(opinion.surah, opinion.ayah, opinion.word)}@${opinion.evidence.reading}`;

/** Attaches what the live check is made of, or with null takes it away. */
export function setLiveCheckPort(port: LiveCheckPort | null): void {
  livePort = port;
}

/** With the text hidden, colouring a word the reader has not reached would show it. */
function wordRevealed(word: EngineWord & {totalWords: number}): boolean {
  if (!memo?.hidden) return true;
  const position = dkWordPosition(
    digitalKhattDataService.getVerseWords(`${word.surah}:${word.ayah}`),
    word.word,
    word.totalWords,
  );
  return (
    position !== null &&
    isRevealed(
      useRecitationTrackingStore.getState().revealedThrough,
      word.surah,
      word.ayah,
      position,
    )
  );
}

const liveGate: LiveMarkGate = {
  dismissed: key => dismissedMarks.has(key),
  revealed: wordRevealed,
  settled: key => liveSettled.get(key),
};

const two = (value: number) => value.toFixed(2);

function applyLive(opinions: readonly LiveOpinion[], now: number): void {
  if (opinions.length === 0) return;
  const update = applyLiveOpinions(book, opinions, now, liveGate);
  if (update.book === book) return;
  book = update.book;
  for (const m of [...update.confirmed, ...update.corrected]) {
    const key = wordMarkKey(m);
    const reading = m.live?.reading ?? 0;
    liveSettled.set(key, Math.max(reading, liveSettled.get(key) ?? reading));
  }
  for (const m of update.confirmed) {
    liveHidden.set(wordMarkKey(m), memo?.hidden ?? false);
    trace(
      `MARK live ${m.kind} ${m.surah}:${m.ayah} word ${m.word + 1} (reading ${m.live?.reading}, letters ${two(m.live?.letterShare ?? 0)}, gap ${two(m.live?.gap ?? 0)})`,
    );
  }
  for (const m of update.corrected) {
    trace(
      `CORRECTED live ${m.surah}:${m.ayah} word ${m.word + 1} (reading ${m.live?.reading})`,
    );
  }
  // A mark left to a skipped-ayah flag is not on the page, so it does not buzz.
  const onPage = shownMarks(
    new Map(update.confirmed.map(m => [wordMarkKey(m), m])),
    skippedAyat(),
  );
  if (onPage.length > 0 && now - lastBuzzAt >= LIVE_BUZZ_GAP_MS) {
    buzz();
    lastLiveBuzzAt = now;
  }
  publishMarks();
}

/** Held live mistakes whose words are now revealed show; those waited too long go. */
function releaseHeldLive(now: number): void {
  const ready: LiveOpinion[] = [];
  for (const [key, held] of liveHeld) {
    const {opinion} = held;
    if (now - held.since >= LIVE_REVEAL_WAIT_MS) {
      liveGaveUp.add(readingKey(opinion));
      trace(
        `live ${opinion.surah}:${opinion.ayah} word ${opinion.word + 1}: not revealed in time, dropped`,
      );
    } else if (wordRevealed(opinion)) {
      ready.push(opinion);
    } else {
      continue;
    }
    liveHeld.delete(key);
  }
  applyLive(ready, now);
}

/** One live run's opinions. Only final ones may make or correct a mark. */
function noteLiveOpinions(opinions: readonly LiveOpinion[]): void {
  const state = useRecitationTrackingStore.getState();
  if (!live || !memo?.check || state.status !== 'listening' || !state.locked) {
    return;
  }
  const now = Date.now();
  releaseHeldLive(now);
  const ready: LiveOpinion[] = [];
  for (const opinion of opinions) {
    if (!opinion.final) continue;
    const key = markKey(opinion.surah, opinion.ayah, opinion.word);
    if (dismissedMarks.has(key)) continue;
    if (opinion.verdict !== 'fine' && liveGaveUp.has(readingKey(opinion))) {
      continue;
    }
    if (opinion.verdict !== 'fine' && !wordRevealed(opinion)) {
      const since = liveHeld.get(key)?.since ?? now;
      liveHeld.set(key, {opinion, since});
      continue;
    }
    ready.push(opinion);
  }
  applyLive(ready, now);
}

function startLive(): void {
  liveHidden = new Map();
  dismissedLive = new Map();
  liveHeld = new Map();
  liveGaveUp = new Set();
  liveSettled = new Map();
  live?.stop();
  live = null;
  if (!memo?.check || !livePort) return;
  prepareSecondLook();
  live = startLiveCheck(
    {
      engine: secondJudgeEngine,
      ready: () => {
        const {status, locked} = useRecitationTrackingStore.getState();
        return status === 'listening' && locked && !!memo?.check;
      },
      report: opinions => {
        try {
          noteLiveOpinions(opinions);
        } catch (error) {
          trace(`live check: marks failed (${String(error)})`);
        }
      },
    },
    livePort,
  );
}

/** The word's 1-based position in the ayah, as the mushaf numbers it. */
function hafsWordPosition(
  surah: number,
  ayah: number,
  word: number,
  totalWords: number,
): number {
  return (
    dkWordPosition(
      digitalKhattDataService.getVerseWords(`${surah}:${ayah}`),
      word,
      totalWords,
    ) ?? word + 1
  );
}

/** Every judged word of the take, in reading order. */
function takeWords(): TakeWord[] {
  const out: TakeWord[] = [];
  for (const [key, entry] of judged) {
    const {surah, ayah, word, totalWords, state} = entry.change;
    const mark = book.get(key);
    const marked =
      mark?.status === 'mistake' || mark?.status === 'corrected' ? mark : null;
    const dismissedKind = dismissedMarks.get(key);
    out.push({
      surah,
      ayah,
      word: hafsWordPosition(surah, ayah, word, totalWords),
      result: dismissedKind
        ? 'dismissed'
        : marked
          ? marked.status === 'mistake'
            ? 'mistake'
            : 'corrected'
          : state === 'ok'
            ? 'correct'
            : 'unclear',
      kind: dismissedKind ?? marked?.kind ?? null,
      hidden: entry.hidden,
      at: entry.at,
    });
  }
  if (LIVE_CHECK_ENABLED) {
    // A live mark can stand on a word the follower never judged.
    const liveMarks = [...book].filter(
      ([key, m]) =>
        m.live &&
        (m.status === 'mistake' || m.status === 'corrected') &&
        !judged.has(key),
    );
    const liveDismissed = [...dismissedLive].filter(
      ([key]) => !judged.has(key),
    );
    for (const [key, mark] of [...liveMarks, ...liveDismissed]) {
      const {surah, ayah, word, totalWords} = mark;
      const dismissedKind = dismissedMarks.get(key);
      out.push({
        surah,
        ayah,
        word: hafsWordPosition(surah, ayah, word, totalWords),
        result: dismissedKind
          ? 'dismissed'
          : mark.status === 'mistake'
            ? 'mistake'
            : 'corrected',
        kind: dismissedKind ?? mark.kind,
        hidden: liveHidden.get(key) ?? false,
        at: mark.since,
      });
    }
  }
  const added = [...book.values()].filter(
    m => m.kind === 'added' && m.status === 'mistake',
  );
  for (const mark of [...added, ...dismissedAdded]) {
    const {surah, ayah, word, totalWords} = mark;
    out.push({
      surah,
      ayah,
      word: hafsWordPosition(surah, ayah, word, totalWords),
      result: dismissedAdded.includes(mark) ? 'dismissed' : 'mistake',
      kind: 'added',
      hidden: judged.get(markKey(surah, ayah, word))?.hidden ?? false,
      at: mark.since,
    });
  }
  return out.sort(
    (a, b) => a.surah - b.surah || a.ayah - b.ayah || a.word - b.word,
  );
}

/** Lost while checking: follow freely near the last ayah until a new lock. */
function dropToTracking(): void {
  if (!memo?.correction) return;
  stopCorrection();
  trace('following freely until the next lock');
  const {verseKey} = useRecitationTrackingStore.getState();
  if (!verseKey) return;
  const [surah, ayah] = verseKey.split(':').map(Number);
  setSessionHint({surah, ayah});
}

function noteFlag(issue: CorrectionIssue, totalWords: number): void {
  const shown = toShownFlag({
    kind: issue.kind,
    surah: issue.surah,
    ayah: issue.ayah,
    word: issue.word,
    source: issue.source ?? 'word',
  });
  trace(
    `flag ${issue.kind} ${issue.surah}:${issue.ayah} word ${issue.word + 1}`,
  );
  if (!shown || memo?.dismissed.has(shown.key)) return;
  const {flags} = useRecitationTrackingStore.getState();
  if (flags.some(f => f.key === shown.key)) return;
  setState({flags: [...flags, {...shown, totalWords}]});
  // A skipped ayah's own word marks give way to the ayah flag.
  if (shown.kind === 'skippedAyah') publishMarks();
}

function newTakeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function saveTake(record: TakeRecord): void {
  recitationLogDatabase.recordTake(record).catch(error => {
    console.warn('[recitation] could not save the take', error);
  });
}

function setState(
  patch: Partial<ReturnType<typeof useRecitationTrackingStore.getState>>,
): void {
  useRecitationTrackingStore.setState(patch);
}

// Engine events (sent as debug messages) that move between searching for
// the reader's place and following it.
const LOCK_EVENTS = new Set(['located', 'relocated']);
const UNLOCK_EVENTS = new Set(['lost', 'idle', 'locateFailed', 'completed']);
// While checking, the engine cannot leave the expected passage, and a search
// after losing the reader would snap to the passage's start; these mean the
// reader paused, went elsewhere or finished the surah, so it follows freely
// again until the next lock.
const FALLBACK_EVENTS = new Set(['idle', 'lost', 'locateFailed', 'completed']);

function handleEvent(msg: EngineMessage): void {
  const state = useRecitationTrackingStore.getState();
  if (state.status !== 'listening') return;
  if (msg.type === 'word_verdicts') {
    // Verdicts from before a lock are the search's guesses, the lock's own
    // chunk is judged from replayed audio, and a chunk judging a long stretch
    // across ayat at once is the tracker re-aligning, not the reader.
    if (state.locked && memo?.check) {
      const lock = msg.lock ?? null;
      if (lock) live?.relocated(lock, msg.audioTime);
      noteVerdicts(
        dropRealignment(dropLockArtifacts(msg.changes, lock)),
        msg.audioTime,
        !isFilteredChunk(msg.changes, lock),
      );
    } else if (!state.locked && msg.changes.some(c => c.state !== 'pending')) {
      trace(`${msg.changes.length} verdicts ignored (not locked)`);
    }
    return;
  }
  if (msg.type === 'correction') {
    if (msg.state.phase === 'error' && msg.state.issue) {
      noteFlag(msg.state.issue, msg.totalWords);
    }
    return;
  }
  if (msg.type === 'word_progress') {
    if (
      state.verseKey !== `${msg.surah}:${msg.ayah}` ||
      state.wordIndex !== msg.word_index
    ) {
      trace(
        `at ${msg.surah}:${msg.ayah} word ${msg.word_index + 1}/${msg.total_words}`,
      );
    }
    if (memo?.check && !memo.correction) {
      startCorrection({surah: msg.surah, ayah: msg.ayah});
    }
    if (takeLockedAt === null) {
      takeLockedAt = Date.now();
      analyticsService.trackRecitationTrackingLocked({
        time_to_lock_ms: takeLockedAt - takeStartedAt,
        surah_id: msg.surah,
        ayah: msg.ayah,
        page_hint_matched: takeHint?.surah === msg.surah,
      });
    }
    const key = `${msg.surah}:${msg.ayah}`;
    const position = dkWordPosition(
      digitalKhattDataService.getVerseWords(key),
      msg.word_index,
      msg.total_words,
    );
    setState({
      locked: true,
      revealedThrough:
        position === null
          ? state.revealedThrough
          : advanceRevealed(state.revealedThrough, {
              surah: msg.surah,
              ayah: msg.ayah,
              position,
            }),
      verseKey: key,
      wordIndex: msg.word_index,
      totalWords: msg.total_words,
    });
    if (live) {
      live.setPlace({
        surah: msg.surah,
        ayah: msg.ayah,
        word: msg.word_index,
        totalWords: msg.total_words,
      });
      if (liveHeld.size > 0) releaseHeldLive(Date.now());
    }
    return;
  }
  if (msg.type === 'verse_match') {
    const key = `${msg.surah}:${msg.ayah}`;
    // The engine keeps its tracker across a deferred flag, so it can still
    // align the next ayah's audio onto one it flagged as skipped: that ayah
    // was not recited, and the passage does not move with it.
    if (skippedAyat().has(key)) {
      trace(`ayah ${key} match ignored (flagged as skipped)`);
      return;
    }
    trace(`ayah ${key} recited`);
    slidePassage(msg);
    if (!state.recitedVerseKeys.includes(key)) {
      setState({recitedVerseKeys: [...state.recitedVerseKeys, key]});
    }
    return;
  }
  if (msg.type !== 'debug') return;
  if (msg.event === 'tentative') {
    showTentative(msg.data, state.locked);
    return;
  }
  if (LOCK_EVENTS.has(msg.event) || UNLOCK_EVENTS.has(msg.event)) {
    trace(`engine ${msg.event}`);
  }
  if (LOCK_EVENTS.has(msg.event)) setState({locked: true});
  if (UNLOCK_EVENTS.has(msg.event)) {
    setState({locked: false});
    live?.lost();
    dropWhatTheReaderLeftBehind(Date.now());
    scheduleConfirm();
  }
  if (FALLBACK_EVENTS.has(msg.event)) dropToTracking();
}

/**
 * Before the lock, several ayat can fit what was heard equally well (a shared
 * opening). The engine then names the open page's one as tentative: the cursor
 * shows there at once, with no verdicts, no reveal and no lock. The lock moves
 * it if the words turn out to belong elsewhere.
 */
function showTentative(data: Record<string, unknown>, locked: boolean): void {
  if (locked) return;
  const {surah, ayah, word, totalWords} = data;
  if (
    typeof surah !== 'number' ||
    typeof ayah !== 'number' ||
    typeof word !== 'number' ||
    typeof totalWords !== 'number'
  ) {
    return;
  }
  const key = `${surah}:${ayah}`;
  if (!takePage.has(key)) return;
  trace(`probably at ${key} word ${word + 1}/${totalWords}`);
  setState({verseKey: key, wordIndex: word, totalWords});
}

function trackTakeStopped(
  reason: RecitationStopReason,
  stats: RecitationStats | null,
): void {
  analyticsService.trackRecitationTrackingStopped({
    duration_ms: Date.now() - takeStartedAt,
    locked: takeLockedAt !== null,
    ayat_recited: useRecitationTrackingStore.getState().recitedVerseKeys.length,
    stop_reason: reason,
    rtf:
      stats && stats.audioSeconds > 0
        ? Math.round((stats.busyMs / 1000 / stats.audioSeconds) * 1000) / 1000
        : 0,
    max_feed_ms: stats ? Math.round(stats.maxFeedMs) : 0,
    load_ms: stats ? Math.round(stats.loadMs) : 0,
  });
}

// Stops the reader did not ask for, and what the mushaf says about them.
const STOP_ERRORS: Partial<Record<RecitationStopReason, () => string>> = {
  interruption: () => i18n.t('reader:recitation.errorInterruption'),
  mic_silent: () => i18n.t('reader:recitation.errorMicSilent'),
};

function onUpdate(update: SessionUpdate): void {
  switch (update.status) {
    case 'downloading':
      setState({status: 'downloading', downloadProgress: update.progress});
      return;
    case 'loading':
      setState({status: 'loading'});
      return;
    case 'listening':
      takeStartedAt = Date.now();
      takeLockedAt = null;
      take = startTake({
        id: newTakeId(),
        purpose: 'follow',
        startedAt: takeStartedAt,
        hidden: useMushafSettingsStore.getState().recitationHideText,
        expected: null,
      });
      memo = {
        hidden: useMushafSettingsStore.getState().recitationHideText,
        check: useMushafSettingsStore.getState().recitationCheckMistakes,
        correction: false,
        checked: false,
        expected: null,
        dismissed: new Set(),
      };
      book = emptyMarkBook();
      judged = new Map();
      dismissedMarks = new Map();
      dismissedAdded = [];
      forgetJudgeWakes();
      clearConfirmTimer();
      debugTakeStart();
      trace(
        `take started (text ${memo.hidden ? 'hidden' : 'shown'}, checking ${memo.check ? 'on' : 'off'})`,
      );
      loadDismissed(memo);
      if (SECOND_LOOK_ENABLED && memo.check) {
        prepareSecondLook();
        startCheckTake(
          checkHost,
          useMushafSettingsStore.getState().recitationCancelMayCancel ??
            CANCEL_MAY_CANCEL,
        );
      }
      if (LIVE_CHECK_ENABLED) startLive();
      analyticsService.trackRecitationTrackingStarted({
        hint_surah_id: takeHint?.surah ?? null,
        model_loaded: update.modelWasLoaded,
      });
      setState({status: 'listening'});
      return;
    case 'paused':
      setState({status: 'paused'});
      return;
    case 'resumed':
      setState({status: 'listening'});
      return;
    case 'off': {
      // The live check stops first, and what it had not settled goes with it: its
      // marks are made while the reader recites, never after.
      if (live) {
        live.stop();
        live = null;
        liveHeld = new Map();
      }
      clearConfirmTimer();
      forgetJudgeWakes();
      // What is due by its own rules shows, as no answer can come now. So does a
      // mark still waiting for its second look: a check that gets no answer must
      // not hide it. The reader has stopped, so no vibration.
      const due = confirmDue(endJudgeWaits(book), Date.now());
      const unanswered = finishChecks(due.book);
      book = unanswered.book;
      const lastMarks = [...due.confirmed, ...unanswered.confirmed];
      if (lastMarks.length > 0) {
        traceMarks(lastMarks);
        publishMarks();
      }
      endCheckTake(update.stats);
      if (update.listened) trackTakeStopped(update.reason, update.stats);
      // The take's marks stay on the page until the next take.
      const {marks} = useRecitationTrackingStore.getState();
      setState({...RECITATION_TRACKING_IDLE, marks});
      return;
    }
    case 'error':
      analyticsService.trackRecitationTrackingError({
        stage: update.stage,
        error_message: update.detail,
      });
      setState({
        ...RECITATION_TRACKING_IDLE,
        status: 'error',
        error:
          update.kind === 'permission'
            ? i18n.t('reader:recitation.micPermission')
            : update.message,
        errorKind: update.kind,
      });
      return;
  }
}

const handlers: SessionHandlers = {
  onUpdate,
  onEvent: msg => {
    if (take) take = takeEvent(take, msg, Date.now());
    handleEvent(msg);
  },
  onFinish: ({messages, reason, listened}) => {
    const finished = take;
    const checked = memo;
    take = null;
    memo = null;
    clearConfirmTimer();
    trace(`take ended (${reason})`);
    if (listened)
      void debugTakeSave(
        `take-${new Date().toISOString().replace(/[:.]/g, '-')}`,
      );
    if (listened && finished) {
      const record: TakeRecord = {
        ...finishTake(finished, messages, reason, Date.now()),
        words: takeWords(),
      };
      saveTake(record);
      lastTakeId = record.id;
      if (checked?.checked && SUMMARY_REASONS.has(reason)) {
        const flags = shownFlags(record.flags, checked.dismissed);
        const marks: RecitationSummaryMark[] = shownMarks(
          book,
          new Set(
            flags
              .filter(f => f.kind === 'skippedAyah')
              .map(f => `${f.surah}:${f.ayah}`),
          ),
        ).map(m => ({
          surah: m.surah,
          ayah: m.ayah,
          word: hafsWordPosition(m.surah, m.ayah, m.word, m.totalWords),
          kind: m.kind,
          status: m.status === 'corrected' ? 'corrected' : 'mistake',
        }));
        if (record.ayat.length > 0 || flags.length > 0 || marks.length > 0) {
          setState({
            summary: {
              takeId: record.id,
              startedAt: record.startedAt,
              endedAt: record.endedAt,
              ayat: record.ayat.map(({surah, ayah}) => ({surah, ayah})),
              flags,
              marks,
            },
          });
        }
      }
    }
    const error = STOP_ERRORS[reason];
    if (error) setState({status: 'error', error: error(), errorKind: 'other'});
  },
};

/**
 * Starts listening, downloading and loading the model first if needed.
 * @param hint - The ayah on screen, so the first lock favours this page
 * @param pageVerseKeys - Every ayah on the open page ("surah:ayah"), where the
 *   reader's place may show before the lock
 */
export async function startRecitationTracking(
  hint: SearchHint | null,
  pageVerseKeys: readonly string[] = [],
): Promise<void> {
  const {status} = useRecitationTrackingStore.getState();
  if (status !== 'off' && status !== 'error') return;
  takeHint = hint;
  takePage = new Set(pageVerseKeys);
  setState({...RECITATION_TRACKING_IDLE, status: 'loading'});
  await startSession({purpose: 'follow', hint}, handlers);
}

/** Stops listening and clears the highlight. Safe to call when idle. */
export async function stopRecitationTracking(
  reason: RecitationStopReason = 'user',
): Promise<void> {
  if (activeSessionPurpose() === 'follow') {
    await stopSession(reason);
    return;
  }
  setState(RECITATION_TRACKING_IDLE);
  scheduleUnload(IDLE_UNLOAD_MS);
}

const AYAH_MARKER = '۝';

const revealSource: RevealSource = {
  ayahCount: surah => SURAHS[surah - 1]?.verses_count ?? 0,
  lastPosition: (surah, ayah) => {
    let last = 0;
    for (const word of digitalKhattDataService.getVerseWords(
      `${surah}:${ayah}`,
    )) {
      if (word.text.trimStart().startsWith(AYAH_MARKER)) continue;
      last = Math.max(last, word.wordPositionInVerse);
    }
    return last;
  },
};

/**
 * Hide and reveal: shows the next hidden word (or the rest of the ayah).
 * @param start - First ayah on screen, used before anything is revealed
 */
export function peekRecitation(kind: 'word' | 'ayah', start: AyahRef): void {
  const state = useRecitationTrackingStore.getState();
  if (!isTakeActive(state.status)) return;
  const peek = kind === 'word' ? peekWord : peekAyah;
  const next = peek(state.revealedThrough, start, revealSource);
  if (next === state.revealedThrough) return;
  setState({revealedThrough: next});
  if (take) {
    take = takePeek(take, {
      surah: next.surah,
      ayah: next.ayah,
      kind,
      at: Date.now(),
    });
  }
}

/**
 * Re-points the search bias, e.g. when the reader turns the page by hand.
 * @param pageVerseKeys - Every ayah on the page now open
 */
export function setRecitationHint(
  hint: SearchHint | null,
  pageVerseKeys: readonly string[] = [],
): void {
  if (activeSessionPurpose() !== 'follow') return;
  takePage = new Set(pageVerseKeys);
  setSessionHint(hint);
}

/**
 * The reader hid or showed the text mid-take. Checking goes on either way;
 * words judged from now on are recorded as hidden or not.
 */
export function setRecitationHidden(hidden: boolean): void {
  if (!memo || activeSessionPurpose() !== 'follow') return;
  memo.hidden = hidden;
}

/**
 * Holds the take while the reader looks at a mistake: the mic stays open but
 * is not heard. Returns false when no take is listening.
 */
export function holdRecitationTracking(): boolean {
  return activeSessionPurpose() === 'follow' && holdSession();
}

/** Ends holdRecitationTracking's hold. */
export function releaseRecitationTracking(): void {
  if (activeSessionPurpose() === 'follow') releaseSession();
}

/**
 * "I read it correctly" on a marked word: the mark goes, and the word is
 * saved as dismissed (during the take, with the take; after it, in the log).
 * @param target - The word in Tilawa's 0-based index, as in the store marks
 */
export async function dismissRecitationMark(target: {
  surah: number;
  ayah: number;
  word: number;
  kind?: MarkKind;
}): Promise<void> {
  const {marks, status} = useRecitationTrackingStore.getState();
  const added = target.kind === 'added';
  const inBook = book.get(
    added ? addedKey(target) : markKey(target.surah, target.ayah, target.word),
  );
  const mark =
    marks.find(
      m =>
        m.surah === target.surah &&
        m.ayah === target.ayah &&
        m.word === target.word &&
        (m.kind === 'added') === added,
    ) ?? (inBook?.status === 'checking' ? inBook : undefined);
  if (!mark) return;
  setState({marks: marks.filter(m => m !== mark)});
  trace(`dismissed ${mark.surah}:${mark.ayah} word ${mark.word + 1}`);
  const key = wordMarkKey(mark);
  if (isTakeActive(status)) {
    dismissedMarks.set(key, mark.kind);
    if (added) dismissedAdded.push(mark);
    if (LIVE_CHECK_ENABLED && mark.live) dismissedLive.set(key, mark);
    const next = new Map(book);
    next.delete(key);
    book = next;
    return;
  }
  if (!lastTakeId) return;
  try {
    await recitationLogDatabase.dismissWord(
      lastTakeId,
      mark.surah,
      mark.ayah,
      hafsWordPosition(mark.surah, mark.ayah, mark.word, mark.totalWords),
      ...(added ? (['added'] as const) : []),
    );
  } catch (error) {
    console.warn('[recitation] could not save the dismissal', error);
  }
}

/** The mushaf showed the summary sheet. */
export function clearRecitationSummary(): void {
  setState({summary: null});
}

function loadDismissed(target: Memorisation): void {
  recitationLogDatabase
    .dismissedKeys()
    .then(keys => {
      target.dismissed = keys;
    })
    .catch(error => {
      console.warn('[recitation] could not read dismissed flags', error);
    });
}
