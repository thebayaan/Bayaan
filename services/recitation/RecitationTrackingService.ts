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
  emptyMarkBook,
  nextConfirmAt,
  shownMarks,
  type MarkBook,
  type VerdictChange,
} from './wordMarks';
import {
  activeSessionPurpose,
  configureSession,
  setSessionHint,
  startSession,
  stopSession,
  type SessionHandlers,
  type SessionUpdate,
} from './sessionRunner';
import {shownFlags, toShownFlag} from './flags';
import {passageOnPage} from './passage';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
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
// rest of that surah's part of the page, and moves the passage on page by
// page. Hidden or not, the reader's words are judged as they recite.
interface Memorisation {
  hidden: boolean;
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

// Takes that end in the mushaf get a summary; the others (left the mushaf,
// app in the background, playback, another session) are only logged.
const SUMMARY_REASONS: ReadonlySet<RecitationStopReason> = new Set([
  'user',
  'mic_silent',
  'interruption',
]);

function passageFrom(from: {surah: number; ayah: number}): ExpectedPassage {
  const page = digitalKhattDataService.getPageForVerse(
    `${from.surah}:${from.ayah}`,
  );
  const keys = page
    ? mushafVerseMapService.getOrderedVerseKeysForPage(page)
    : [];
  return passageOnPage(keys, from) ?? {...from, ayahEnd: from.ayah};
}

function ayahAfter(
  passage: ExpectedPassage,
): {surah: number; ayah: number} | null {
  const end = passage.ayahEnd ?? passage.ayah;
  if (end < (SURAHS[passage.surah - 1]?.verses_count ?? 0)) {
    return {surah: passage.surah, ayah: end + 1};
  }
  return passage.surah < 114 ? {surah: passage.surah + 1, ayah: 1} : null;
}

function startCorrection(from: {surah: number; ayah: number}): void {
  if (!memo) return;
  memo.expected = passageFrom(from);
  memo.correction = true;
  memo.checked = true;
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

/** The reader passed the passage's last ayah: expect the next page's. */
function advancePassage(matched: {surah: number; ayah: number}): void {
  const expected = memo?.expected;
  if (!memo?.correction || !expected) return;
  const last = expected.ayahEnd ?? expected.ayah;
  if (matched.surah !== expected.surah || matched.ayah !== last) return;
  const next = ayahAfter(expected);
  if (!next) return;
  memo.expected = passageFrom(next);
  configureSession({expected: memo.expected});
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
    buzz();
    publishMarks();
  }
  scheduleConfirm();
}

/** One short vibration for a newly marked mistake, if the reader wants it. */
function buzz(): void {
  if (!useMushafSettingsStore.getState().recitationMistakeHaptics) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
    () => undefined,
  );
}

function noteVerdicts(changes: readonly VerdictChange[]): void {
  const now = Date.now();
  for (const change of changes) {
    if (change.state === 'pending') continue;
    judged.set(`${change.surah}:${change.ayah}:${change.word}`, {
      change,
      hidden: memo?.hidden ?? false,
      at: now,
    });
  }
  const update = applyVerdicts(book, changes, now);
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
    out.push({
      surah,
      ayah,
      word: hafsWordPosition(surah, ayah, word, totalWords),
      result: marked
        ? marked.status === 'mistake'
          ? 'mistake'
          : 'corrected'
        : state === 'ok'
          ? 'correct'
          : 'unclear',
      kind: marked?.kind ?? null,
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
// While checking, the engine cannot leave the expected passage; these mean
// the reader went elsewhere (or paused), so it follows freely again.
const FALLBACK_EVENTS = new Set(['idle', 'locateFailed']);

function handleEvent(msg: EngineMessage): void {
  const state = useRecitationTrackingStore.getState();
  if (state.status !== 'listening') return;
  if (msg.type === 'word_verdicts') {
    // Verdicts from before a lock are the search's guesses.
    if (state.locked) noteVerdicts(msg.changes);
    return;
  }
  if (msg.type === 'correction') {
    if (msg.state.phase === 'error' && msg.state.issue) {
      noteFlag(msg.state.issue, msg.totalWords);
    }
    return;
  }
  if (msg.type === 'word_progress') {
    if (memo && !memo.correction) {
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
    if (!state.recitedVerseKeys.includes(key)) {
      setState({recitedVerseKeys: [...state.recitedVerseKeys, key]});
    }
    advancePassage(msg);
    return;
  }
  if (msg.type !== 'debug') return;
  if (LOCK_EVENTS.has(msg.event)) setState({locked: true});
  if (UNLOCK_EVENTS.has(msg.event)) setState({locked: false});
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
        correction: false,
        checked: false,
        expected: null,
        dismissed: new Set(),
      };
      book = emptyMarkBook();
      judged = new Map();
      clearConfirmTimer();
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
    case 'off':
      clearConfirmTimer();
      if (update.listened) trackTakeStopped(update.reason, update.stats);
      setState(RECITATION_TRACKING_IDLE);
      return;
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
    if (listened && finished) {
      const record: TakeRecord = {
        ...finishTake(finished, messages, reason, Date.now()),
        words: takeWords(),
      };
      saveTake(record);
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
