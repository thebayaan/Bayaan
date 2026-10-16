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
import type {AudioEngine, EngineEvent, EngineStatus} from './audioEngineTypes';
import {
  audioFocusHeldByOther,
  claimAudioFocus,
  releaseAudioFocus,
  type AudioFocusOwner,
} from './audioFocus';

export type {AudioEngine, EngineEvent, EngineStatus} from './audioEngineTypes';

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
  // Loading a fresh source resets the underlying player's rate to 1x, so we
  // track the chosen rate here and re-apply it after every load() to keep the
  // selected speed across track changes.
  let currentRate = 1;
  let currentVolume = 1;
  // Every engine shares the one expo-audio player (see audioFocus.ts). The
  // last URL this engine loaded, and where to resume after another engine
  // took the player over.
  let lastUrl: string | null = null;
  let resumeAt: {url: string; seconds: number} | null = null;
  const focusOwner: AudioFocusOwner = {
    onFocusLost: (): void => {
      stopPolling();
      if (!lastUrl) return;
      const event = snapshot();
      resumeAt = {url: lastUrl, seconds: event.positionSeconds};
      // Report a pause, never `idle`, so the owner doesn't take it for a
      // finished track.
      listeners.forEach(cb => cb({...event, status: 'paused'}));
    },
  };
  const otherHasFocus = (): boolean => audioFocusHeldByOther(focusOwner);

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
    // ExpoAudioService stays "playing" after a track runs out (only stop()
    // returns it to idle), so report the end here: the player stopped at the
    // end of the track. The store treats playing -> idle at the end as
    // finished and moves on (next surah, repeat, sleep at end of surah).
    const ranOut =
      status === 'playing' &&
      durationSeconds > 0 &&
      positionSeconds >= durationSeconds - 0.5 &&
      !safeGet(() => expoAudioService.getIsPlaying(), true);
    return {status: ranOut ? 'idle' : status, positionSeconds, durationSeconds};
  }

  // Lost the player and not yet taken it back: whatever it reports now is
  // another engine's track (a late pause from the adhkar reader, say).
  const sidelined = (): boolean => otherHasFocus() || resumeAt !== null;

  function emit(): void {
    if (sidelined()) return;
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
    if (sidelined()) return;
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
      claimAudioFocus(focusOwner);
      lastUrl = url;
      resumeAt = null;
      await expoAudioService.loadTrack(url);
      expoAudioService.setRate(currentRate);
      expoAudioService.setVolume(currentVolume);
    },

    play: async (): Promise<void> => {
      if (otherHasFocus() || resumeAt) {
        // Another engine has the player: take it back and reload where this
        // engine left off. Without a track of its own there is nothing to do.
        const resume = resumeAt;
        if (!resume) return;
        claimAudioFocus(focusOwner);
        resumeAt = null;
        await expoAudioService.loadTrack(resume.url);
        expoAudioService.setRate(currentRate);
        expoAudioService.setVolume(currentVolume);
        if (resume.seconds > 0) await expoAudioService.seekTo(resume.seconds);
      }
      await expoAudioService.play();
      startPolling();
    },

    pause: (): void => {
      if (otherHasFocus()) return;
      void expoAudioService.pause();
      stopPolling();
    },

    seek: (seconds: number): void => {
      if (sidelined()) {
        if (resumeAt) resumeAt = {...resumeAt, seconds};
        return;
      }
      void expoAudioService.seekTo(seconds);
    },

    setRate: (rate: number): void => {
      currentRate = rate;
      if (otherHasFocus()) return;
      expoAudioService.setRate(rate);
    },

    setVolume: (volume: number): void => {
      currentVolume = volume;
      if (otherHasFocus()) return;
      expoAudioService.setVolume(volume);
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
      releaseAudioFocus(focusOwner);
      removeStateListener();
      listeners.clear();
    },
  };
}
