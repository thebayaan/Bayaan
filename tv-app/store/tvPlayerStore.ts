import {create} from 'zustand';
import type {AudioEngine, EngineEvent} from '../services/audioEngine';
import {
  recordProgress,
  removeContinue,
} from '../services/continueListeningStore';
import type {PlayerStatus, QueueItem} from '../types/player';

export type RepeatMode = 'off' | 'one' | 'all';

/** A sleep timer fades the audio out over its last stretch instead of cutting off. */
export const SLEEP_FADE_MS = 30 * 1000;
const SLEEP_FADE_STEP_MS = 500;

export type SleepMode =
  | {kind: 'off'}
  | {kind: 'timer'; endsAt: number}
  | {kind: 'endOfSurah'};

type TVPlayerState = {
  engine: AudioEngine | null;
  queue: QueueItem[];
  currentIndex: number;
  status: PlayerStatus;
  positionSeconds: number;
  durationSeconds: number;
  speed: number;
  shuffle: boolean;
  repeat: RepeatMode;
  sleep: SleepMode;
  lastError: string | null;
  /** The queue ran out on its own (last surah ended, repeat off). */
  finished: boolean;
  /**
   * True while the player is open for a track whose recitation is still
   * being looked up (see beginPending); the engine's events are ignored
   * meanwhile, so the old track's state never shows under the new title.
   */
  pending: boolean;
  /** Runs the pending lookup again when Try again is pressed after it failed. */
  pendingRetry: (() => void) | null;
  /** Bumped by every load; a load that finds it changed has been replaced. */
  loadToken: number;
  /**
   * The engine is paused for a verse repeat's gap before the replay (see
   * hold). The listener is still listening, so Play/Pause during the gap
   * means "stop here" and cancels the replay.
   */
  held: boolean;
  /**
   * A sleep timer (or "end of surah") stopped playback. The listening room
   * stays dark until the next press instead of lighting back up.
   */
  slept: boolean;
  unsubscribe: (() => void) | null;
  progressWriteTimer: ReturnType<typeof setInterval> | null;
  sleepTimerId: ReturnType<typeof setTimeout> | null;

  setEngine: (engine: AudioEngine) => void;
  loadQueue: (
    queue: QueueItem[],
    startIndex: number,
    opts?: LoadOptions,
  ) => Promise<void>;
  beginPending: (item: QueueItem, retry: () => void) => number;
  failPending: (token: number, message: string) => void;
  toggle: () => void;
  replay: () => void;
  hold: (ms: number) => void;
  wake: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seekBy: (deltaSeconds: number) => void;
  seekTo: (seconds: number) => void;
  setSpeed: (speed: number) => void;
  setShuffle: (on: boolean) => void;
  setRepeat: (mode: RepeatMode) => void;
  setSleep: (minutes: number) => void;
  retry: () => Promise<void>;
  jumpToIndex: (index: number) => Promise<void>;
  reset: () => void;
};

export type LoadOptions = {
  /**
   * Whether the queue was shuffled before loading. It still plays in its own
   * order (so the Queue panel shows what comes next); the flag is for the
   * player to say so. Every queue load states it (defaults to false).
   */
  shuffle?: boolean;
  /** Where to start the first track, for resuming. */
  startSeconds?: number;
};

export const useTVPlayerStore = create<TVPlayerState>((set, get) => ({
  engine: null,
  queue: [],
  currentIndex: 0,
  status: 'idle',
  positionSeconds: 0,
  durationSeconds: 0,
  speed: 1,
  shuffle: false,
  repeat: 'off',
  sleep: {kind: 'off'},
  lastError: null,
  finished: false,
  pending: false,
  pendingRetry: null,
  loadToken: 0,
  held: false,
  slept: false,
  unsubscribe: null,
  progressWriteTimer: null,
  sleepTimerId: null,

  setEngine: (engine: AudioEngine): void => {
    const prevEngine = get().engine;
    const prevUnsub = get().unsubscribe;
    if (prevUnsub) prevUnsub();
    prevEngine?.destroy();

    const unsubscribe = engine.subscribe((e: EngineEvent) => {
      const current = get();
      if (current.pending) return;
      const errored = e.status === 'error' && current.status !== 'error';
      set({
        status: e.status,
        positionSeconds: settledPosition(e),
        durationSeconds: e.durationSeconds,
        ...(errored && !current.lastError
          ? {lastError: describeError(e.error)}
          : {}),
      });
      const ended =
        e.status === 'idle' &&
        current.status === 'playing' &&
        current.positionSeconds > 0 &&
        e.positionSeconds >= e.durationSeconds - 0.5;
      if (!ended) return;
      // A verse repeat on the surah's last verse goes round again rather
      // than let the surah end.
      const again = endOfTrackHook?.() ?? null;
      if (again) {
        seekEngine(get, set, again.seconds);
        if (again.holdMs > 0) get().hold(again.holdMs);
        else void engine.play();
        return;
      }
      // A surah heard to the end leaves Continue listening.
      const done = current.queue[current.currentIndex];
      if (done) removeContinue(done.reciterId, done.surahNumber);
      if (current.sleep.kind === 'endOfSurah') {
        engine.pause();
        set({sleep: {kind: 'off'}, slept: true});
        return;
      }
      const last = current.repeat === 'off' && !hasNextIn(current);
      if (current.repeat === 'one') {
        engine.seek(0);
        void engine.play();
      } else if (last) {
        set({finished: true});
      } else {
        void get().next();
      }
    });
    set({engine, unsubscribe});
  },

  loadQueue: async (
    queue: QueueItem[],
    startIndex: number,
    opts: LoadOptions = {},
  ): Promise<void> => {
    const engine = get().engine;
    if (!engine || queue.length === 0) return;
    const index = Math.max(0, Math.min(queue.length - 1, startIndex));
    set({
      queue,
      shuffle: opts.shuffle ?? false,
      pending: false,
      pendingRetry: null,
    });
    startProgressWriter(get, set);
    await loadIndex(get, set, index, opts.startSeconds);
  },

  beginPending: (item: QueueItem, retry: () => void): number => {
    const token = get().loadToken + 1;
    // Stop the old track: the player now shows the new one loading.
    if (!get().pending) get().engine?.pause();
    clearHold();
    set({
      held: false,
      slept: false,
      queue: [item],
      currentIndex: 0,
      status: 'loading',
      positionSeconds: 0,
      durationSeconds: 0,
      lastError: null,
      finished: false,
      pending: true,
      pendingRetry: retry,
      loadToken: token,
    });
    return token;
  },

  failPending: (token: number, message: string): void => {
    if (get().loadToken !== token) return;
    set({status: 'error', lastError: message, pending: false});
  },

  toggle: (): void => {
    const {
      engine,
      status,
      finished,
      positionSeconds,
      durationSeconds,
      pending,
    } = get();
    // Nothing of the new track is loaded yet; playing would resume the old.
    if (!engine || pending) return;
    set({slept: false});
    // Pressed in a verse repeat's gap: stay paused, with no replay to come.
    if (get().held) {
      clearHold();
      set({held: false});
      return;
    }
    if (status === 'error') {
      void get().retry();
      return;
    }
    // At the end, play starts the surah again (the engine would resume at
    // the end and stop at once).
    const atEnd =
      durationSeconds > 0 && positionSeconds >= durationSeconds - 0.5;
    if (status !== 'playing' && (finished || atEnd)) {
      // Stopped at the end of a surah by "sleep at end of surah": play goes
      // on to the next one rather than hear this one again.
      const {queue, currentIndex, repeat} = get();
      if (!finished && repeat !== 'one' && currentIndex < queue.length - 1) {
        void get().next();
        return;
      }
      get().replay();
      return;
    }
    if (status === 'playing') {
      engine.pause();
    } else {
      void engine.play();
    }
  },

  replay: (): void => {
    const {engine, queue, pending} = get();
    if (!engine || queue.length === 0 || pending) return;
    set({finished: false});
    seekEngine(get, set, 0);
    void engine.play();
  },

  hold: (ms: number): void => {
    const engine = get().engine;
    if (!engine) return;
    clearHold();
    engine.pause();
    set({held: true});
    holdTimer = setTimeout(() => {
      holdTimer = null;
      if (!get().held) return;
      set({held: false});
      void get().engine?.play();
    }, ms);
  },

  wake: (): void => {
    if (get().slept) set({slept: false});
  },

  // A shuffled queue was shuffled when it loaded, so next and previous
  // always follow the queue's order: what the Queue panel lists is what
  // plays, Previous is the surah just heard, and the queue ends.
  next: async (): Promise<void> => {
    const {engine, queue, currentIndex, repeat, pending} = get();
    // While a recitation is looked up the queue is only its placeholder.
    if (!engine || queue.length === 0 || pending) return;
    let nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeat !== 'all') return;
      nextIndex = 0;
    }
    await loadIndex(get, set, nextIndex);
  },

  prev: async (): Promise<void> => {
    const {engine, queue, currentIndex, positionSeconds, repeat, pending} =
      get();
    if (!engine || queue.length === 0 || pending) return;
    const prevIndex =
      currentIndex > 0
        ? currentIndex - 1
        : repeat === 'all'
          ? queue.length - 1
          : currentIndex;
    // A few seconds in, Previous starts this surah again, as on any player.
    // The position follows every seek, even paused, so a second press goes
    // back a surah. At the first surah there is only the restart.
    if (positionSeconds > 3 || prevIndex === currentIndex) {
      seekEngine(get, set, 0);
      return;
    }
    await loadIndex(get, set, prevIndex);
  },

  seekBy: (delta: number): void => {
    const {engine, positionSeconds, pending} = get();
    if (!engine || pending) return;
    seekEngine(get, set, positionSeconds + delta);
  },

  seekTo: (seconds: number): void => {
    const {engine, pending} = get();
    if (!engine || pending) return;
    seekEngine(get, set, seconds);
  },

  setSpeed: (speed: number): void => {
    get().engine?.setRate(speed);
    set({speed});
  },

  setShuffle: (shuffle: boolean): void => set({shuffle}),

  setRepeat: (repeat: RepeatMode): void => set({repeat}),

  retry: async (): Promise<void> => {
    const {engine, queue, currentIndex, pendingRetry, positionSeconds} = get();
    if (!engine || queue.length === 0) return;
    // The recitation was never found: look it up again.
    if (!queue[currentIndex].audioUrl) {
      pendingRetry?.();
      return;
    }
    // A track that failed partway picks up where it stopped.
    await loadIndex(get, set, currentIndex, positionSeconds);
  },

  jumpToIndex: async (index: number): Promise<void> => {
    const {engine, queue, currentIndex, pending} = get();
    if (!engine || queue.length === 0 || pending) return;
    if (index < 0 || index >= queue.length) return;
    if (index === currentIndex) {
      get().replay();
      return;
    }
    await loadIndex(get, set, index);
  },

  setSleep: (minutes: number): void => {
    const existing = get().sleepTimerId;
    if (existing !== null) clearTimeout(existing);
    // Undo a fade that was under way.
    get().engine?.setVolume(1);
    if (minutes === 0) {
      set({sleep: {kind: 'off'}, sleepTimerId: null});
      return;
    }
    if (minutes < 0) {
      set({sleep: {kind: 'endOfSurah'}, sleepTimerId: null});
      return;
    }
    const totalMs = minutes * 60 * 1000;
    const endsAt = Date.now() + totalMs;
    // Each step lowers the volume and schedules the next, keeping the pending
    // one in sleepTimerId so turning the timer off cancels it.
    const fadeStep = (): void => {
      const left = endsAt - Date.now();
      const engine = get().engine;
      if (left <= 0) {
        engine?.pause();
        engine?.setVolume(1);
        set({sleep: {kind: 'off'}, sleepTimerId: null, slept: true});
        return;
      }
      engine?.setVolume(left / SLEEP_FADE_MS);
      set({
        sleepTimerId: setTimeout(fadeStep, Math.min(SLEEP_FADE_STEP_MS, left)),
      });
    };
    const timerId = setTimeout(fadeStep, Math.max(0, totalMs - SLEEP_FADE_MS));
    set({sleep: {kind: 'timer', endsAt}, sleepTimerId: timerId});
  },

  reset: (): void => {
    const {engine, unsubscribe, progressWriteTimer, sleepTimerId} = get();
    if (unsubscribe) unsubscribe();
    engine?.destroy();
    if (progressWriteTimer !== null) clearInterval(progressWriteTimer);
    if (sleepTimerId !== null) clearTimeout(sleepTimerId);
    clearHold();
    seekGuard = null;
    set({
      engine: null,
      queue: [],
      currentIndex: 0,
      status: 'idle',
      positionSeconds: 0,
      durationSeconds: 0,
      speed: 1,
      shuffle: false,
      repeat: 'off',
      sleep: {kind: 'off'},
      lastError: null,
      finished: false,
      pending: false,
      pendingRetry: null,
      loadToken: 0,
      held: false,
      slept: false,
      unsubscribe: null,
      progressWriteTimer: null,
      sleepTimerId: null,
    });
  },
}));

/** The pending replay of a verse repeat's gap (see hold). */
let holdTimer: ReturnType<typeof setTimeout> | null = null;

function clearHold(): void {
  if (holdTimer !== null) clearTimeout(holdTimer);
  holdTimer = null;
}

const NETWORK_HINTS = [
  'Network request failed',
  'Unable to resolve host',
  'The Internet connection appears to be offline',
  'NSURLErrorDomain',
  'Could not initiate download',
  'ERR_INTERNET_DISCONNECTED',
  'timed out',
  'ENOTFOUND',
  'ECONNREFUSED',
  'The network connection was lost',
];

export function isNetworkError(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return NETWORK_HINTS.some(hint => lower.includes(hint.toLowerCase()));
}

/**
 * What the error card says when a recording fails for a reason other than
 * the connection. The native player's own words (an AVFoundation code, an
 * ExoPlayer exception) are for the logs, not the screen.
 */
export const PLAYBACK_FAILED_MESSAGE =
  "This recording couldn't be played. Try again, or choose another reciter.";

/**
 * The error to keep for the card: a connection problem keeps its message,
 * which the card and toasts recognise (isNetworkError) and word themselves;
 * anything else becomes PLAYBACK_FAILED_MESSAGE.
 */
export function describeError(err: unknown): string {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (isNetworkError(message)) return message;
  if (message) console.warn('[tvPlayer] playback failed:', message);
  return PLAYBACK_FAILED_MESSAGE;
}

/**
 * Whether Next has somewhere to go: a surah after this one, or the start of
 * the queue again with repeat all. The tray's Next and the error card's Skip
 * both follow it.
 */
export function hasNextIn(
  state: Pick<TVPlayerState, 'queue' | 'currentIndex' | 'repeat'>,
): boolean {
  const {queue, currentIndex, repeat} = state;
  return (
    currentIndex < queue.length - 1 || (repeat === 'all' && queue.length > 1)
  );
}

/**
 * Where to go instead of ending the track, as the end-of-track hook answers
 * (see setEndOfTrackHook): seek here, then play, after holdMs for a verse
 * repeat's pause.
 */
export type PlayAgain = {seconds: number; holdMs: number};

let endOfTrackHook: (() => PlayAgain | null) | null = null;

/**
 * Lets the listening store keep a verse repeat on the surah's last verse
 * going when the track itself ends (it can't be imported from here).
 */
export function setEndOfTrackHook(
  hook: (() => PlayAgain | null) | null,
): void {
  endOfTrackHook = hook;
}

/** Positions the engine reports this soon after a seek may predate it. */
const SEEK_SETTLE_MS = 600;

/** The last seek's target while it settles (see settledPosition). */
let seekGuard: {target: number; until: number} | null = null;

/**
 * The position to show for an engine event. Right after a seek the engine
 * can still report where it was, which would snap the screen back and make
 * the next step start from the old place, so the target holds until the
 * engine reports it (or the settle time passes).
 */
function settledPosition(e: EngineEvent): number {
  if (!seekGuard) return e.positionSeconds;
  const reached = Math.abs(e.positionSeconds - seekGuard.target) < 1;
  if (reached || e.status === 'idle' || Date.now() > seekGuard.until) {
    seekGuard = null;
    return e.positionSeconds;
  }
  return seekGuard.target;
}

/**
 * Seeks within the current track. The store takes the target at once, so the
 * screen moves even while paused (the engine reports nothing then) and quick
 * repeated presses each start from the last one's target. Seeking back from
 * the end means the queue is no longer finished.
 */
function seekEngine(
  get: () => TVPlayerState,
  set: (partial: Partial<TVPlayerState>) => void,
  seconds: number,
): void {
  const {engine, durationSeconds, finished} = get();
  if (!engine) return;
  const target = Math.max(
    0,
    durationSeconds > 0 ? Math.min(durationSeconds, seconds) : seconds,
  );
  seekGuard = {target, until: Date.now() + SEEK_SETTLE_MS};
  engine.seek(target);
  set({
    positionSeconds: target,
    ...(finished && target < durationSeconds - 0.5 ? {finished: false} : {}),
  });
}

/**
 * Loads and plays the queue's track at `index`. Each load takes a new token,
 * so when another load starts before this one finishes (a double press, Next
 * pressed twice), the older one stops quietly instead of playing over it or
 * reporting its error.
 */
async function loadIndex(
  get: () => TVPlayerState,
  set: (partial: Partial<TVPlayerState>) => void,
  index: number,
  startSeconds?: number,
): Promise<void> {
  const {engine, queue} = get();
  const item = queue[index];
  if (!engine || !item) return;
  // The lookup's placeholder has no recording yet: look it up again rather
  // than load an empty source.
  if (!item.audioUrl) {
    get().pendingRetry?.();
    return;
  }
  const token = get().loadToken + 1;
  clearHold();
  set({
    held: false,
    slept: false,
    currentIndex: index,
    status: 'loading',
    positionSeconds: 0,
    durationSeconds: 0,
    lastError: null,
    finished: false,
    pending: false,
    loadToken: token,
  });
  const stale = (): boolean => get().loadToken !== token;
  try {
    await engine.load(item.audioUrl);
    if (stale()) return;
    // Seek before play so a resume never blips from the start.
    if (startSeconds !== undefined && startSeconds > 0) {
      seekEngine(get, set, startSeconds);
    }
    await engine.play();
  } catch (err) {
    if (stale()) return;
    set({status: 'error', lastError: describeError(err)});
  }
}

function startProgressWriter(
  get: () => TVPlayerState,
  set: (partial: Partial<TVPlayerState>) => void,
): void {
  const existing = get().progressWriteTimer;
  if (existing !== null) clearInterval(existing);
  const timer = setInterval(() => {
    const {queue, currentIndex, positionSeconds, durationSeconds, status} =
      get();
    if (status !== 'playing' || queue.length === 0) return;
    const item = queue[currentIndex];
    recordProgress({
      reciterId: item.reciterId,
      rewayahId: item.rewayahId ?? '',
      surahNumber: item.surahNumber,
      positionSeconds,
      durationSeconds,
    });
  }, 5000);
  set({progressWriteTimer: timer});
}
