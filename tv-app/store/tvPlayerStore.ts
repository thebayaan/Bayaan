import {create} from 'zustand';
import type {AudioEngine, EngineEvent} from '../services/audioEngine';
import {recordProgress} from '../services/continueListeningStore';
import type {PlayerStatus, QueueItem} from '../types/player';

export type RepeatMode = 'off' | 'one' | 'all';

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
  unsubscribe: (() => void) | null;
  progressWriteTimer: ReturnType<typeof setInterval> | null;
  sleepTimerId: ReturnType<typeof setTimeout> | null;

  setEngine: (engine: AudioEngine) => void;
  loadQueue: (queue: QueueItem[], startIndex: number) => Promise<void>;
  toggle: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seekBy: (deltaSeconds: number) => void;
  seekTo: (seconds: number) => void;
  setSpeed: (speed: number) => void;
  setShuffle: (on: boolean) => void;
  setRepeat: (mode: RepeatMode) => void;
  setSleep: (minutes: number) => void;
  reset: () => void;
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
      set({
        status: e.status,
        positionSeconds: e.positionSeconds,
        durationSeconds: e.durationSeconds,
      });
      const ended =
        e.status === 'idle' &&
        current.status === 'playing' &&
        current.positionSeconds > 0 &&
        e.positionSeconds >= e.durationSeconds - 0.5;
      if (!ended) return;
      if (current.sleep.kind === 'endOfSurah') {
        engine.pause();
        set({sleep: {kind: 'off'}});
        return;
      }
      if (current.repeat === 'one') {
        engine.seek(0);
        void engine.play();
      } else {
        void get().next();
      }
    });
    set({engine, unsubscribe});
  },

  loadQueue: async (queue: QueueItem[], startIndex: number): Promise<void> => {
    const engine = get().engine;
    if (!engine || queue.length === 0) return;
    set({queue, currentIndex: startIndex, status: 'loading'});
    await engine.load(queue[startIndex].audioUrl);
    await engine.play();
    startProgressWriter(get, set);
  },

  toggle: (): void => {
    const {engine, status} = get();
    if (!engine) return;
    if (status === 'playing') {
      engine.pause();
    } else {
      void engine.play();
    }
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
    set({currentIndex: nextIndex, status: 'loading'});
    await engine.load(queue[nextIndex].audioUrl);
    await engine.play();
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
    set({currentIndex: prevIndex, status: 'loading'});
    await engine.load(queue[prevIndex].audioUrl);
    await engine.play();
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

  setSleep: (minutes: number): void => {
    const existing = get().sleepTimerId;
    if (existing !== null) clearTimeout(existing);
    if (minutes === 0) {
      set({sleep: {kind: 'off'}, sleepTimerId: null});
      return;
    }
    if (minutes < 0) {
      set({sleep: {kind: 'endOfSurah'}, sleepTimerId: null});
      return;
    }
    const endsAt = Date.now() + minutes * 60 * 1000;
    const timerId = setTimeout(() => {
      get().engine?.pause();
      set({sleep: {kind: 'off'}, sleepTimerId: null});
    }, minutes * 60 * 1000);
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
      unsubscribe: null,
      progressWriteTimer: null,
      sleepTimerId: null,
    });
  },
}));

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
