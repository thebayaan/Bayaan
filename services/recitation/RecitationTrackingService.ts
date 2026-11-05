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
import type {EngineMessage, RecitationStats} from './recitationEngine';
import {
  applyVerdicts,
  confirmDue,
  dropSuspects,
  emptyMarkBook,
  nextConfirmAt,
  shownMarks,
  markKey,
  type MarkBook,
  type MarkKind,
  type VerdictChange,
} from './wordMarks';
import {
  activeSessionPurpose,
  configureSession,
  holdSession,
  releaseSession,
  setSessionHint,
  startSession,
  stopSession,
  type SessionHandlers,
  type SessionUpdate,
} from './sessionRunner';
import {shownFlags, toShownFlag} from './flags';
import {debugTakeSave, debugTakeStart, trace} from './debugTake';
import {
  advanceRevealed,
  peekAyah,
  peekWord,
  type AyahRef,
  type RevealSource,
} from './reveal';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {dkWordPosition} from '@/components/mushaf/skia/recitedWord';
import {SURAHS} from '@/data/surahData';

// Follow-along: follows a live recitation in the mushaf and publishes the
// ayah and word being recited to useRecitationTrackingStore. The session
// (mic, model, watchdog) belongs to sessionRunner.

export {
  recitationModelNeedsDownload,
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
// Each judged word's last verdict, for the take's record.
interface JudgedWord {
  change: VerdictChange;
  hidden: boolean;
  at: number;
}
let judged = new Map<string, JudgedWord>();
// Marks the reader dismissed this take ("I read it correctly"), by key.
let dismissedMarks = new Map<string, MarkKind>();
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
// phone out of memory; ten ayat take a tenth of a second on a Mac). Getting
// lost goes back to tracking (dropToTracking), so moving the passage never
// makes a search snap to its first ayah.
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
  if (update.confirmed.length > 0) {
    for (const m of update.confirmed) {
      trace(`MARK ${m.kind} ${m.surah}:${m.ayah} word ${m.word + 1}`);
    }
    buzz();
    publishMarks();
  }
  scheduleConfirm();
}

/** One short vibration for a newly marked mistake, if the reader wants it. */
function buzz(): void {
  const on = useMushafSettingsStore.getState().recitationMistakeHaptics;
  trace(`vibrate ${on ? 'on' : 'off (setting)'}`);
  if (!on) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
    () => undefined,
  );
}

function noteVerdicts(all: readonly VerdictChange[]): void {
  const now = Date.now();
  // A word the reader said they read correctly is not marked again.
  const changes = all.filter(
    c => !dismissedMarks.has(markKey(c.surah, c.ayah, c.word)),
  );
  for (const change of changes) {
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
  const update = applyVerdicts(book, changes, now);
  for (const m of update.corrected) {
    trace(`CORRECTED ${m.surah}:${m.ayah} word ${m.word + 1}`);
  }
  if (update.book === book) return;
  book = update.book;
  publishMarks();
  scheduleConfirm();
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
    // Verdicts from before a lock are the search's guesses.
    if (state.locked && memo?.check) noteVerdicts(msg.changes);
    else if (!state.locked && msg.changes.some(c => c.state !== 'pending')) {
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
    return;
  }
  if (msg.type === 'verse_match') {
    const key = `${msg.surah}:${msg.ayah}`;
    trace(`ayah ${key} recited`);
    slidePassage(msg);
    if (!state.recitedVerseKeys.includes(key)) {
      setState({recitedVerseKeys: [...state.recitedVerseKeys, key]});
    }
    return;
  }
  if (msg.type !== 'debug') return;
  if (LOCK_EVENTS.has(msg.event) || UNLOCK_EVENTS.has(msg.event)) {
    trace(`engine ${msg.event}`);
  }
  if (LOCK_EVENTS.has(msg.event)) setState({locked: true});
  if (UNLOCK_EVENTS.has(msg.event)) {
    setState({locked: false});
    // What the engine suspected just before losing the reader is not
    // trustworthy; marks already shown stay.
    book = dropSuspects(book);
    scheduleConfirm();
  }
  if (FALLBACK_EVENTS.has(msg.event)) dropToTracking();
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
      clearConfirmTimer();
      debugTakeStart();
      trace(
        `take started (text ${memo.hidden ? 'hidden' : 'shown'}, checking ${memo.check ? 'on' : 'off'})`,
      );
      loadDismissed(memo);
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
      clearConfirmTimer();
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
 */
export async function startRecitationTracking(
  hint: SearchHint | null,
): Promise<void> {
  const {status} = useRecitationTrackingStore.getState();
  if (status !== 'off' && status !== 'error') return;
  takeHint = hint;
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

/** Re-points the search bias, e.g. when the reader turns the page by hand. */
export function setRecitationHint(hint: SearchHint | null): void {
  if (activeSessionPurpose() === 'follow') setSessionHint(hint);
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
}): Promise<void> {
  const {marks, status} = useRecitationTrackingStore.getState();
  const mark = marks.find(
    m =>
      m.surah === target.surah &&
      m.ayah === target.ayah &&
      m.word === target.word,
  );
  if (!mark) return;
  setState({marks: marks.filter(m => m !== mark)});
  trace(`dismissed ${mark.surah}:${mark.ayah} word ${mark.word + 1}`);
  const key = markKey(mark.surah, mark.ayah, mark.word);
  if (isTakeActive(status)) {
    dismissedMarks.set(key, mark.kind);
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
