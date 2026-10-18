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
   * Whether next/previous pick at random. Every queue load states it, so a
   * surah chosen after a shuffle play plays in order (defaults to false).
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
        positionSeconds: e.positionSeconds,
        durationSeconds: e.durationSeconds,
        ...(errored && !current.lastError
          ? {lastError: 'Playback failed'}
          : {}),
      });
      const ended =
        e.status === 'idle' &&
        current.status === 'playing' &&
        current.positionSeconds > 0 &&
        e.positionSeconds >= e.durationSeconds - 0.5;
      if (!ended) return;
      // A surah heard to the end leaves Continue listening.
      const done = current.queue[current.currentIndex];
      if (done) removeContinue(done.reciterId, done.surahNumber);
      if (current.sleep.kind === 'endOfSurah') {
        engine.pause();
        set({sleep: {kind: 'off'}});
        return;
      }
      const last =
        current.currentIndex >= current.queue.length - 1 &&
        current.repeat === 'off' &&
        !(current.shuffle && current.queue.length > 1);
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
    set({
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
    if (status === 'error') {
      void get().retry();
      return;
    }
    // At the end, play starts the surah again (the engine would resume at
    // the end and stop at once).
    const atEnd =
      durationSeconds > 0 && positionSeconds >= durationSeconds - 0.5;
    if (status !== 'playing' && (finished || atEnd)) {
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
    const {engine, queue} = get();
    if (!engine || queue.length === 0) return;
    set({finished: false});
    engine.seek(0);
    void engine.play();
  },

  next: async (): Promise<void> => {
    const {engine, queue, currentIndex, repeat, shuffle} = get();
    if (!engine || queue.length === 0) return;
    let nextIndex: number;
    if (shuffle && queue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeat === 'all') {
          nextIndex = 0;
        } else {
          return;
        }
      }
    }
    await loadIndex(get, set, nextIndex);
  },

  prev: async (): Promise<void> => {
    const {engine, queue, currentIndex, positionSeconds, shuffle} = get();
    if (!engine || queue.length === 0) return;
    if (positionSeconds > 3) {
      engine.seek(0);
      return;
    }
    let prevIndex: number;
    if (shuffle && queue.length > 1) {
      do {
        prevIndex = Math.floor(Math.random() * queue.length);
      } while (prevIndex === currentIndex);
    } else {
      prevIndex = Math.max(0, currentIndex - 1);
    }
    await loadIndex(get, set, prevIndex);
  },

  seekBy: (delta: number): void => {
    const {engine, positionSeconds, durationSeconds} = get();
    if (!engine) return;
    const target = Math.max(
      0,
      Math.min(durationSeconds, positionSeconds + delta),
    );
    engine.seek(target);
  },

  seekTo: (seconds: number): void => {
    const {engine} = get();
    engine?.seek(Math.max(0, seconds));
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
    const {engine, queue, currentIndex} = get();
    if (!engine || queue.length === 0) return;
    if (index < 0 || index >= queue.length) return;
    if (index === currentIndex) {
      engine.seek(0);
      void engine.play();
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
        set({sleep: {kind: 'off'}, sleepTimerId: null});
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
      unsubscribe: null,
      progressWriteTimer: null,
      sleepTimerId: null,
    });
  },
}));

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

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Playback failed';
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
  const token = get().loadToken + 1;
  set({
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
      engine.seek(startSeconds);
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
