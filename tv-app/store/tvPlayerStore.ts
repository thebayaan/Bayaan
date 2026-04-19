import {create} from 'zustand';
import type {AudioEngine, EngineEvent} from '../services/audioEngine';
import {recordProgress} from '../services/continueListeningStore';
import type {PlayerStatus, QueueItem} from '../types/player';

export type RepeatMode = 'off' | 'one' | 'all';

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
  unsubscribe: (() => void) | null;

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
  reset: () => void;
};

let progressWriteTimer: ReturnType<typeof setInterval> | null = null;

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
  unsubscribe: null,

  setEngine: (engine: AudioEngine): void => {
    const prevUnsub = get().unsubscribe;
    if (prevUnsub) prevUnsub();

    const unsubscribe = engine.subscribe((e: EngineEvent) => {
      const current = get();
      set({
        status: e.status,
        positionSeconds: e.positionSeconds,
        durationSeconds: e.durationSeconds,
      });
      if (
        e.status === 'idle' &&
        current.status === 'playing' &&
        current.positionSeconds > 0 &&
        e.positionSeconds >= current.durationSeconds - 0.5
      ) {
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
    startProgressWriter(get);
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
    const {engine, queue, currentIndex, repeat} = get();
    if (!engine || queue.length === 0) return;
    let nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        return;
      }
    }
    set({currentIndex: nextIndex, status: 'loading'});
    await engine.load(queue[nextIndex].audioUrl);
    await engine.play();
  },

  prev: async (): Promise<void> => {
    const {engine, queue, currentIndex, positionSeconds} = get();
    if (!engine || queue.length === 0) return;
    if (positionSeconds > 3) {
      engine.seek(0);
      return;
    }
    const prevIndex = Math.max(0, currentIndex - 1);
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

  reset: (): void => {
    const unsub = get().unsubscribe;
    if (unsub) unsub();
    if (progressWriteTimer) {
      clearInterval(progressWriteTimer);
      progressWriteTimer = null;
    }
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
      unsubscribe: null,
    });
  },
}));

function startProgressWriter(get: () => TVPlayerState): void {
  if (progressWriteTimer) clearInterval(progressWriteTimer);
  progressWriteTimer = setInterval(() => {
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
}
