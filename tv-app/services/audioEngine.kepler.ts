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
 * through attachMediaControls() before the first track loads, along with
 * which transport each engine's commands should drive.
 *
 * Media-control commands go through TransportHandler: each transport command
 * claims the transport gate (so a press that also arrives as a key event acts
 * once) and, for the recitation's engine, runs through the player store; Next
 * and Previous change surah, which the default W3C handler can't (it has no
 * queue), and seeks stay within the store's bounds. Whichever engine last took audio focus also takes media-control
 * focus, so after the adhkar reader the remote drives the recitation again.
 */

import {
  AudioPlayer,
  KeplerMediaControlHandler,
} from '@amazon-devices/react-native-w3cmedia';
import type {
  ICommandContext,
  IMediaSessionId,
  ITimeValue,
} from '@amazon-devices/kepler-media-controls';
import type {IComponentInstance} from '@amazon-devices/react-native-kepler';
import type {AudioEngine, EngineEvent, EngineStatus} from './audioEngineTypes';
import {
  claimAudioFocus,
  releaseAudioFocus,
  type AudioFocusOwner,
} from './audioFocus';
import type {MediaTransport} from './mediaTransport';
import {isEndOfMediaPause} from './mediaEnd';
import {MEDIA_SEEK_SECONDS} from './remoteKeys';
import {claimTransport, type TransportChannel} from './transportGate';
import {useNavStore} from '../store/navStore';

export type {AudioEngine, EngineEvent, EngineStatus} from './audioEngineTypes';

const POLL_INTERVAL_MS = 500;

const toSeconds = (time: ITimeValue): number =>
  time.seconds + time.nanoseconds / 1e9;

type TransportFor = (engine: AudioEngine) => MediaTransport | null;

let componentInstance: IComponentInstance | null = null;
let transportFor: TransportFor = () => null;
// The player the system's media controls currently drive.
let controlOwner: AudioPlayer | null = null;

export function attachMediaControls(
  instance: IComponentInstance,
  transport: TransportFor = () => null,
): void {
  componentInstance = instance;
  transportFor = transport;
}

/**
 * Media-control commands for one engine. Without a transport (the adhkar
 * reader's engine) the default W3C handling drives its element, still gated.
 */
class TransportHandler extends KeplerMediaControlHandler {
  private readonly transport: () => MediaTransport | null;

  constructor(transport: () => MediaTransport | null) {
    super();
    this.transport = transport;
  }

  /**
   * Claims the transport gate for a system command. The adhkar reader
   * handles every transport key itself (see screenOwnsMediaKey): while it
   * is on top the recitation's controls stand aside without claiming, so
   * the key event that follows reaches the reader instead of being dropped
   * as a repeat.
   */
  private claim(channel: TransportChannel): boolean {
    if (this.transport() !== null) {
      const {stack} = useNavStore.getState();
      if (stack[stack.length - 1]?.screen === 'adhkarReader') return false;
    }
    return claimTransport('system', channel);
  }

  async handleTogglePlayPause(sessionId?: IMediaSessionId): Promise<void> {
    if (!this.claim('playPause')) return;
    const transport = this.transport();
    if (transport) transport.toggle();
    else await super.handleTogglePlayPause(sessionId);
  }

  async handlePlay(sessionId?: IMediaSessionId): Promise<void> {
    if (!this.claim('playPause')) return;
    const transport = this.transport();
    if (transport) transport.play();
    else await super.handlePlay(sessionId);
  }

  async handlePause(
    sessionId?: IMediaSessionId,
    context?: ICommandContext,
  ): Promise<void> {
    if (!this.claim('playPause')) return;
    const transport = this.transport();
    if (transport) transport.pause();
    else await super.handlePause(sessionId, context);
  }

  async handleNext(sessionId?: IMediaSessionId): Promise<void> {
    if (!this.claim('track')) return;
    const transport = this.transport();
    if (transport) transport.next();
    else await super.handleNext(sessionId);
  }

  async handlePrevious(): Promise<void> {
    if (!this.claim('track')) return;
    const transport = this.transport();
    if (transport) transport.previous();
    else await super.handlePrevious();
  }

  async handleFastForward(sessionId?: IMediaSessionId): Promise<void> {
    if (!this.claim('seek')) return;
    const transport = this.transport();
    if (transport) transport.seekBy(MEDIA_SEEK_SECONDS);
    else await super.handleFastForward(sessionId);
  }

  async handleRewind(sessionId?: IMediaSessionId): Promise<void> {
    if (!this.claim('seek')) return;
    const transport = this.transport();
    if (transport) transport.seekBy(-MEDIA_SEEK_SECONDS);
    else await super.handleRewind(sessionId);
  }

  async handleSkipForward(
    delta: ITimeValue,
    sessionId?: IMediaSessionId,
  ): Promise<void> {
    if (!this.claim('seek')) return;
    const transport = this.transport();
    if (transport) transport.seekBy(Math.abs(toSeconds(delta)));
    else await super.handleSkipForward(delta, sessionId);
  }

  async handleSkipBackward(
    delta: ITimeValue,
    sessionId?: IMediaSessionId,
  ): Promise<void> {
    if (!this.claim('seek')) return;
    const transport = this.transport();
    if (transport) transport.seekBy(-Math.abs(toSeconds(delta)));
    else await super.handleSkipBackward(delta, sessionId);
  }
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
  // Each engine has its own player here; taking focus pauses the other one
  // so the Quran and an adhkar recitation never play over each other.
  const focusOwner: AudioFocusOwner = {
    onFocusLost: (): void => {
      player?.pause();
    },
  };

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
  // The pause that comes just before `ended` (see mediaEnd.ts) is left out,
  // so the store sees playing -> idle and moves on.
  const onPause = (): void => {
    const audio = player;
    if (
      audio &&
      isEndOfMediaPause(
        finiteOr(audio.currentTime, 0),
        finiteOr(audio.duration, 0),
        (audio as {ended?: boolean}).ended === true,
      )
    ) {
      return;
    }
    setStatus('paused');
  };
  const onWaiting = (): void => setStatus('buffering');
  const onEnded = (): void => setStatus('idle');
  const onError = (): void => setStatus('error');
  const onMetadata = (): void => emit();
  const handler = new TransportHandler(() => transportFor(engine));

  /** Points the system's media controls at this engine's player. */
  async function takeMediaControls(audio: AudioPlayer): Promise<void> {
    if (!componentInstance || controlOwner === audio) return;
    try {
      await audio.setMediaControlFocus(componentInstance, handler);
      controlOwner = audio;
    } catch (e) {
      // Playback works without system controls; never fail a load over them.
      console.warn('[audioEngine] media controls unavailable', e);
    }
  }

  function ensurePlayer(): Promise<AudioPlayer> {
    if (player) return Promise.resolve(player);
    if (initPromise) return initPromise;
    initPromise = (async (): Promise<AudioPlayer> => {
      const created = new AudioPlayer();
      await takeMediaControls(created);
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

  const engine: AudioEngine = {
    load: async (url: string): Promise<void> => {
      claimAudioFocus(focusOwner);
      const audio = await ensurePlayer();
      await takeMediaControls(audio);
      setStatus('loading');
      audio.autoplay = false;
      audio.src = url;
      audio.load();
      // A new source resets the element's rate; keep the chosen speed.
      audio.playbackRate = currentRate;
    },

    play: async (): Promise<void> => {
      claimAudioFocus(focusOwner);
      const audio = await ensurePlayer();
      await takeMediaControls(audio);
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

    setVolume: (volume: number): void => {
      if (player) player.volume = Math.max(0, Math.min(1, volume));
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
      releaseAudioFocus(focusOwner);
      listeners.clear();
      const audio = player;
      player = null;
      initPromise = null;
      if (!audio) return;
      if (controlOwner === audio) controlOwner = null;
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
  return engine;
}
