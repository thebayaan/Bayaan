/**
 * audioEngine.ts — TV audio engine adapter
 *
 * Wraps ExpoAudioService in a simple, mockable interface.
 * The store depends only on AudioEngine, never on ExpoAudioService directly.
 *
 * NOTE: ExpoAudioService requires setPlayer() to be called from a React
 * component (via useAudioPlayer hook) before load/play will work.
 * Wire-up happens in tv-app/App.tsx (T17). The createAudioEngine() factory
 * is safe to call before setPlayer — operations will no-op gracefully.
 *
 * Position/duration are NOT emitted by ExpoAudioService events; we poll
 * every POLL_INTERVAL_MS and merge with state-change events.
 */

import {expoAudioService} from '../../services/audio/ExpoAudioService';
import type {PlaybackState} from '../../services/audio/ExpoAudioService';

export type EngineStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'error';

export type EngineEvent = {
  status: EngineStatus;
  positionSeconds: number;
  durationSeconds: number;
};

export type AudioEngine = {
  load: (url: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
  setRate: (rate: number) => void;
  subscribe: (cb: (e: EngineEvent) => void) => () => void;
  destroy: () => void;
};

const POLL_INTERVAL_MS = 500;

function mapPlaybackState(state: PlaybackState): EngineStatus {
  switch (state) {
    case 'idle':
      return 'idle';
    case 'loading':
      return 'loading';
    case 'ready':
      return 'paused';
    case 'playing':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'error':
      return 'error';
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function createAudioEngine(): AudioEngine {
  const listeners = new Set<(e: EngineEvent) => void>();
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function safeGet<T>(fn: () => T, fallback: T): T {
    try {
      return fn();
    } catch {
      return fallback;
    }
  }

  function snapshot(): EngineEvent {
    const status = safeGet<EngineStatus>(
      () => mapPlaybackState(expoAudioService.getPlaybackState()),
      'idle',
    );
    const positionSeconds = safeGet(() => expoAudioService.getCurrentTime(), 0);
    const durationSeconds = safeGet(() => expoAudioService.getDuration(), 0);
    return {status, positionSeconds, durationSeconds};
  }

  function emit(): void {
    const event = snapshot();
    listeners.forEach(cb => cb(event));
  }

  function startPolling(): void {
    if (pollTimer !== null) return;
    pollTimer = setInterval(emit, POLL_INTERVAL_MS);
  }

  function stopPolling(): void {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // Listen to ExpoAudioService state changes (play/pause/error transitions)
  const removeStateListener = expoAudioService.addStateListener(() => {
    emit();
    const current = safeGet<EngineStatus>(
      () => mapPlaybackState(expoAudioService.getPlaybackState()),
      'idle',
    );
    if (current === 'playing') {
      startPolling();
    } else {
      stopPolling();
    }
  });

  return {
    load: async (url: string): Promise<void> => {
      await expoAudioService.loadTrack(url);
    },

    play: async (): Promise<void> => {
      await expoAudioService.play();
      startPolling();
    },

    pause: (): void => {
      void expoAudioService.pause();
      stopPolling();
    },

    seek: (seconds: number): void => {
      void expoAudioService.seekTo(seconds);
    },

    setRate: (rate: number): void => {
      expoAudioService.setRate(rate);
    },

    subscribe: (cb: (e: EngineEvent) => void): (() => void) => {
      listeners.add(cb);
      cb(snapshot());

      return (): void => {
        listeners.delete(cb);
        if (listeners.size === 0) {
          stopPolling();
          removeStateListener();
        }
      };
    },

    destroy: (): void => {
      stopPolling();
      removeStateListener();
      listeners.clear();
    },
  };
}
