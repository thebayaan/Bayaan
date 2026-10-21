// @ai-start
/**
 * MomentsAudioService - Plays short ayah-aligned clips for the Moments feed
 *
 * Audio is one MP3 per surah, so a moment is a seek to the first ayah and a
 * stop at the end of the last one. Two players take turns: while one plays the
 * current card, the other loads the next card and waits at its start, so a
 * swipe starts sound without a network round trip.
 */

import {createAudioPlayer, AudioPlayer, AudioStatus} from 'expo-audio';
import {audioCoordinator} from '@/services/audio/AudioCoordinator';

type EventSubscription = {remove(): void};

export interface MomentSource {
  key: string;
  url: string;
  startMs: number;
  endMs: number;
}

export interface MomentsPlaybackState {
  key: string | null;
  positionMs: number;
  playing: boolean;
  buffering: boolean;
}

interface Slot {
  player: AudioPlayer;
  subscription: EventSubscription;
  source: MomentSource | null;
  /** Seeked to the moment's start and safe to play. */
  ready: boolean;
  cueing: Promise<void> | null;
  ended: boolean;
}

/** How often the players emit status updates (ms) */
const STATUS_UPDATE_INTERVAL = 100;

class MomentsAudioService {
  private static instance: MomentsAudioService;
  private slots: Slot[] = [];
  private activeIndex = 0;
  private wantsPlay = false;
  private rate = 1;
  private state: MomentsPlaybackState = {
    key: null,
    positionMs: 0,
    playing: false,
    buffering: false,
  };
  private listeners = new Set<(state: MomentsPlaybackState) => void>();
  private endedListeners = new Set<(key: string) => void>();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): MomentsAudioService {
    if (!MomentsAudioService.instance) {
      MomentsAudioService.instance = new MomentsAudioService();
    }
    return MomentsAudioService.instance;
  }

  // ========== SUBSCRIPTIONS ==========

  subscribe(listener: (state: MomentsPlaybackState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onEnded(listener: (key: string) => void): () => void {
    this.endedListeners.add(listener);
    return () => {
      this.endedListeners.delete(listener);
    };
  }

  getState(): MomentsPlaybackState {
    return this.state;
  }

  private emit(patch: Partial<MomentsPlaybackState>): void {
    this.state = {...this.state, ...patch};
    this.listeners.forEach(listener => listener(this.state));
  }

  // ========== SLOTS ==========

  private ensureSlots(): void {
    if (this.slots.length) return;
    for (let i = 0; i < 2; i++) {
      const player = createAudioPlayer(null, {
        updateInterval: STATUS_UPDATE_INTERVAL,
      });
      const subscription = player.addListener(
        'playbackStatusUpdate',
        (status: AudioStatus) => this.handleStatus(i, status),
      );
      this.slots.push({
        player,
        subscription,
        source: null,
        ready: false,
        cueing: null,
        ended: false,
      });
    }
  }

  private load(index: number, source: MomentSource): void {
    const slot = this.slots[index];
    if (slot.source?.key === source.key) return;
    slot.player.pause();
    slot.source = source;
    slot.ready = false;
    slot.ended = false;
    slot.player.replace({uri: source.url});
  }

  private cue(slot: Slot): Promise<void> {
    if (!slot.source) return Promise.resolve();
    if (slot.cueing) return slot.cueing;
    slot.cueing = slot.player
      .seekTo(slot.source.startMs / 1000)
      .then(() => {
        slot.ready = true;
        slot.ended = false;
      })
      .finally(() => {
        slot.cueing = null;
      });
    return slot.cueing;
  }

  private handleStatus(index: number, status: AudioStatus): void {
    const slot = this.slots[index];
    if (!slot?.source) return;

    if (status.isLoaded && !slot.ready) {
      if (slot.cueing) return;
      this.cue(slot)
        .then(() => {
          if (index === this.activeIndex && this.wantsPlay) this.startActive();
        })
        .catch(error => {
          if (__DEV__) console.warn('[MomentsAudio] Seek failed:', error);
        });
      return;
    }

    if (index !== this.activeIndex || !slot.ready || slot.ended) return;

    const positionMs = status.currentTime * 1000;
    // The seek landed on the previous source (replace had not finished
    // loading yet), so cue again once the new file is in.
    if (positionMs < slot.source.startMs - 1000) {
      slot.ready = false;
      return;
    }
    if (positionMs >= slot.source.endMs || status.didJustFinish) {
      slot.ended = true;
      slot.player.pause();
      this.wantsPlay = false;
      this.emit({positionMs: slot.source.endMs, playing: false});
      const key = slot.source.key;
      this.endedListeners.forEach(listener => listener(key));
      return;
    }

    this.emit({
      positionMs: Math.max(slot.source.startMs, positionMs),
      playing: status.playing,
      buffering: status.isBuffering,
    });
  }

  private startActive(): void {
    const slot = this.slots[this.activeIndex];
    audioCoordinator.momentsWillPlay();
    slot.player.setPlaybackRate(this.rate);
    slot.player.play();
    this.emit({playing: true});
  }

  // ========== CONTROLS ==========

  /** Plays a moment from its start, reusing the preloaded player if it matches. */
  play(source: MomentSource): void {
    this.ensureSlots();
    const preloaded = this.slots.findIndex(s => s.source?.key === source.key);
    const previous = this.slots[this.activeIndex];
    this.activeIndex =
      preloaded >= 0 ? preloaded : (this.activeIndex + 1) % this.slots.length;
    if (previous !== this.slots[this.activeIndex]) previous.player.pause();

    const slot = this.slots[this.activeIndex];
    this.wantsPlay = true;
    this.emit({
      key: source.key,
      positionMs: source.startMs,
      playing: false,
      buffering: true,
    });

    if (preloaded >= 0 && slot.ready) {
      this.cue(slot).then(() => this.wantsPlay && this.startActive());
    } else {
      this.load(this.activeIndex, source);
    }
  }

  /** Loads the next moment into the idle player so it can start instantly. */
  preload(source: MomentSource): void {
    this.ensureSlots();
    const idle = (this.activeIndex + 1) % this.slots.length;
    if (this.slots[this.activeIndex].source?.key === source.key) return;
    this.load(idle, source);
  }

  pause(): void {
    this.wantsPlay = false;
    this.slots[this.activeIndex]?.player.pause();
    this.emit({playing: false});
  }

  resume(): void {
    const slot = this.slots[this.activeIndex];
    if (!slot?.source) return;
    this.wantsPlay = true;
    if (!slot.ready) return;
    if (slot.ended) {
      this.cue(slot).then(() => this.wantsPlay && this.startActive());
      return;
    }
    this.startActive();
  }

  /** Seeks within the active moment. `positionMs` is a position in the surah file. */
  async seek(positionMs: number): Promise<void> {
    const slot = this.slots[this.activeIndex];
    if (!slot?.source || !slot.ready) return;
    const clamped = Math.min(
      Math.max(positionMs, slot.source.startMs),
      slot.source.endMs - 250,
    );
    slot.ended = false;
    this.emit({positionMs: clamped});
    await slot.player.seekTo(clamped / 1000);
  }

  setRate(rate: number): void {
    this.rate = rate;
    this.slots[this.activeIndex]?.player.setPlaybackRate(rate);
  }

  /** Stops and frees both players. Called when the Moments screen closes. */
  release(): void {
    this.wantsPlay = false;
    for (const slot of this.slots) {
      slot.subscription.remove();
      slot.player.pause();
      slot.player.remove();
    }
    this.slots = [];
    this.activeIndex = 0;
    this.rate = 1;
    this.emit({key: null, positionMs: 0, playing: false, buffering: false});
    audioCoordinator.sourceDidStop('moments');
  }
}

export const momentsAudioService = MomentsAudioService.getInstance();
// @ai-end
