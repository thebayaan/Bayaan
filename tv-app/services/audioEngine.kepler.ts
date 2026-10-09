/**
 * audioEngine.kepler.ts — Vega (Fire TV) audio engine.
 *
 * Implements the same AudioEngine contract as audioEngine.ts on top of Vega's
 * W3C media AudioPlayer (an HTMLMediaElement-style API), so the player store
 * and every screen stay platform-neutral. Metro picks this file over
 * audioEngine.ts when bundling for the `kepler` platform.
 *
 * Remote and Alexa transport controls need the app's component instance,
 * which only a React hook can provide; TVAudioProvider.kepler.tsx hands it in
 * through attachMediaControls() before the first track loads.
 */

import {AudioPlayer} from '@amazon-devices/react-native-w3cmedia';
import type {IComponentInstance} from '@amazon-devices/react-native-kepler';
import type {AudioEngine, EngineEvent, EngineStatus} from './audioEngineTypes';

export type {AudioEngine, EngineEvent, EngineStatus} from './audioEngineTypes';

const POLL_INTERVAL_MS = 500;

let componentInstance: IComponentInstance | null = null;

export function attachMediaControls(instance: IComponentInstance): void {
  componentInstance = instance;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function createAudioEngine(): AudioEngine {
  const listeners = new Set<(e: EngineEvent) => void>();
  let player: AudioPlayer | null = null;
  let initPromise: Promise<AudioPlayer> | null = null;
  let status: EngineStatus = 'idle';
  let currentRate = 1;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function snapshot(): EngineEvent {
    const duration = player ? finiteOr(player.duration, 0) : 0;
    const position = player ? finiteOr(player.currentTime, 0) : 0;
    // The store detects a finished track as `idle` at the duration.
    const positionSeconds =
      status === 'idle' && duration > 0 ? duration : position;
    return {status, positionSeconds, durationSeconds: duration};
  }

  function emit(): void {
    const event = snapshot();
    listeners.forEach(cb => cb(event));
  }

  function setStatus(next: EngineStatus): void {
    status = next;
    if (next === 'playing') startPolling();
    else stopPolling();
    emit();
  }

  function startPolling(): void {
    if (pollTimer !== null) return;
    pollTimer = setInterval(emit, POLL_INTERVAL_MS);
  }

  function stopPolling(): void {
    if (pollTimer === null) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  const onPlaying = (): void => setStatus('playing');
  const onPause = (): void => setStatus('paused');
  const onWaiting = (): void => setStatus('buffering');
  const onEnded = (): void => setStatus('idle');
  const onError = (): void => setStatus('error');
  const onMetadata = (): void => emit();

  function ensurePlayer(): Promise<AudioPlayer> {
    if (player) return Promise.resolve(player);
    if (initPromise) return initPromise;
    initPromise = (async (): Promise<AudioPlayer> => {
      const created = new AudioPlayer();
      if (componentInstance) {
        await created.setMediaControlFocus(componentInstance);
      }
      await created.initialize();
      created.addEventListener('playing', onPlaying);
      created.addEventListener('pause', onPause);
      created.addEventListener('waiting', onWaiting);
      created.addEventListener('ended', onEnded);
      created.addEventListener('error', onError);
      created.addEventListener('loadedmetadata', onMetadata);
      player = created;
      return created;
    })();
    return initPromise;
  }

  return {
    load: async (url: string): Promise<void> => {
      const audio = await ensurePlayer();
      setStatus('loading');
      audio.autoplay = false;
      audio.src = url;
      audio.load();
      // A new source resets the element's rate; keep the chosen speed.
      audio.playbackRate = currentRate;
    },

    play: async (): Promise<void> => {
      const audio = await ensurePlayer();
      audio.play();
    },

    pause: (): void => {
      player?.pause();
    },

    seek: (seconds: number): void => {
      if (!player) return;
      player.currentTime = Math.max(0, seconds);
      emit();
    },

    setRate: (rate: number): void => {
      currentRate = rate;
      if (player) player.playbackRate = rate;
    },

    subscribe: (cb: (e: EngineEvent) => void): (() => void) => {
      listeners.add(cb);
      cb(snapshot());
      return (): void => {
        listeners.delete(cb);
      };
    },

    destroy: (): void => {
      stopPolling();
      listeners.clear();
      const audio = player;
      player = null;
      initPromise = null;
      if (!audio) return;
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('loadedmetadata', onMetadata);
      audio.pause();
      void audio.deinitialize();
    },
  };
}
