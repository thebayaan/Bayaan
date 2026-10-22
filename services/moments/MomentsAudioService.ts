// @ai-start
/**
 * MomentsAudioService - Plays short ayah-aligned clips for the Moments feed
 *
 * Audio is one MP3 per surah, so a moment is a seek to the first ayah and a
 * stop at the end of the last one. Two players take turns: while one plays the
 * current card, the other loads the next card and waits at its start, so a
 * swipe starts sound without a network round trip.
 *
 * A source can also be a pre-cut clip file (startMs 0, endMs its length) with
 * `offsetMs` set to where the clip starts in the surah. Positions in and out
 * of the service stay surah positions either way, so captions and seeking do
 * not care which file is playing. A clip that fails to load falls back to its
 * `fallback` source (the seek-into-surah one).
 *
 * There are three players: the card on screen and both neighbors, each idle
 * one waiting at its start. A card that was swiped away is rewound in the
 * background, so swiping back replays it from the top at once.
 */

import {createAudioPlayer, AudioPlayer, AudioStatus} from 'expo-audio';
import {audioCoordinator} from '@/services/audio/AudioCoordinator';
import {planPreload} from './feedPlayback';

type EventSubscription = {remove(): void};

export interface MomentSource {
  key: string;
  url: string;
  /** Start and end, as positions in the file at `url`. */
  startMs: number;
  endMs: number;
  /**
   * Added to file positions to get the positions the service reports and
   * `seek` takes (the clip's start in the surah, for a pre-cut clip).
   */
  offsetMs?: number;
  /** Played instead, under the same key, if this source fails to load. */
  fallback?: MomentSource;
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
  /** A position inside the moment has been seen since the last cue. */
  confirmed: boolean;
  /** Cued and not played or seeked since, so it can start without a seek. */
  atStart: boolean;
  /** When it last became active or loaded, to pick which one to reuse. */
  usedAt: number;
}

/** How often the players emit status updates (ms) */
const STATUS_UPDATE_INTERVAL = 100;

/** The card on screen, the next one and the previous one. */
const SLOT_COUNT = 3;

const noop = () => undefined;

class MomentsAudioService {
  private static instance: MomentsAudioService;
  private slots: Slot[] = [];
  private activeIndex = 0;
  private wantsPlay = false;
  private rate = 1;
  private clock = 0;
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
    for (let i = 0; i < SLOT_COUNT; i++) {
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
        confirmed: false,
        atStart: false,
        usedAt: 0,
      });
    }
  }

  private load(index: number, source: MomentSource): void {
    const slot = this.slots[index];
    if (slot.source?.key === source.key && slot.source.url === source.url)
      return;
    slot.player.pause();
    slot.source = source;
    // A seek still running belongs to the old source; do not wait on it.
    slot.cueing = null;
    slot.ready = false;
    slot.ended = false;
    slot.confirmed = false;
    slot.atStart = false;
    slot.usedAt = ++this.clock;
    slot.player.replace({uri: source.url});
  }

  /** The idle player that was used longest ago. */
  private leastRecentlyUsed(): number {
    let best = -1;
    this.slots.forEach((slot, i) => {
      if (i === this.activeIndex) return;
      if (best < 0 || slot.usedAt < this.slots[best].usedAt) best = i;
    });
    return best;
  }

  private cue(slot: Slot): Promise<void> {
    if (!slot.source) return Promise.resolve();
    if (slot.cueing) return slot.cueing;
    const source = slot.source;
    const cueing: Promise<void> = slot.player
      .seekTo(source.startMs / 1000)
      .then(() => {
        // The player was given another source while this seek ran.
        if (slot.source !== source) return;
        slot.ready = true;
        slot.ended = false;
        slot.confirmed = false;
        slot.atStart = true;
      })
      .finally(() => {
        if (slot.cueing === cueing) slot.cueing = null;
      });
    slot.cueing = cueing;
    return cueing;
  }

  private handleStatus(index: number, status: AudioStatus): void {
    const slot = this.slots[index];
    if (!slot?.source) return;

    // A cached clip that will not play: go back to seeking into the surah.
    if (status.error && slot.source.fallback) {
      if (__DEV__) console.warn('[MomentsAudio] Clip failed:', status.error);
      const fallback = slot.source.fallback;
      slot.cueing = null;
      this.load(index, fallback);
      return;
    }

    if (status.isLoaded && !slot.ready) {
      if (slot.cueing) return;
      this.cue(slot)
        .then(() => this.startIfActive(slot))
        .catch(error => {
          if (__DEV__) console.warn('[MomentsAudio] Seek failed:', error);
        });
      return;
    }

    if (index !== this.activeIndex || !slot.ready || slot.ended) return;

    const positionMs = status.currentTime * 1000;
    const offset = slot.source.offsetMs ?? 0;
    // The seek landed on the previous source (replace had not finished
    // loading yet), so cue again once the new file is in. A clip starts at
    // 0, so a stale position shows up past its end instead. A moment that
    // already finished can also report its old end once more after the
    // rewind; that must replay, not end it again.
    if (
      positionMs < slot.source.startMs - 1000 ||
      (!slot.confirmed &&
        (positionMs >= slot.source.endMs || status.didJustFinish))
    ) {
      slot.ready = false;
      return;
    }
    if (positionMs >= slot.source.endMs || status.didJustFinish) {
      slot.ended = true;
      slot.player.pause();
      this.wantsPlay = false;
      this.emit({positionMs: slot.source.endMs + offset, playing: false});
      const key = slot.source.key;
      this.endedListeners.forEach(listener => listener(key));
      return;
    }

    slot.confirmed = true;
    this.emit({
      positionMs: Math.max(slot.source.startMs, positionMs) + offset,
      playing: status.playing,
      buffering: status.isBuffering,
    });
  }

  private startActive(): void {
    const slot = this.slots[this.activeIndex];
    // Never two moments at once.
    for (const other of this.slots) if (other !== slot) other.player.pause();
    slot.atStart = false;
    audioCoordinator.momentsWillPlay();
    slot.player.setPlaybackRate(this.rate);
    slot.player.play();
    this.emit({playing: true});
  }

  /** Starts `slot` if it is still the active one (a seek may have raced a swipe). */
  private startIfActive(slot: Slot): void {
    if (this.wantsPlay && slot.ready && this.slots[this.activeIndex] === slot) {
      this.startActive();
    }
  }

  // ========== CONTROLS ==========

  /** Plays a moment from its start, reusing the preloaded player if it matches. */
  play(source: MomentSource): void {
    this.ensureSlots();
    const preloaded = this.slots.findIndex(s => s.source?.key === source.key);
    const previous = this.slots[this.activeIndex];
    this.activeIndex = preloaded >= 0 ? preloaded : this.leastRecentlyUsed();
    const slot = this.slots[this.activeIndex];
    slot.usedAt = ++this.clock;
    if (previous !== slot) {
      previous.player.pause();
      // Rewind it now, so swiping back to it starts at once from the top.
      if (previous.ready) this.cue(previous).catch(noop);
    }

    this.wantsPlay = true;
    this.emit({
      key: source.key,
      positionMs: source.startMs + (source.offsetMs ?? 0),
      playing: false,
      buffering: true,
    });

    if (preloaded >= 0 && slot.source?.url !== source.url) {
      // Preloaded from the other file (the clip finished downloading since).
      this.load(this.activeIndex, source);
    } else if (preloaded >= 0 && slot.ready && slot.atStart && !slot.cueing) {
      // Already waiting at its start: no seek, no wait.
      this.startActive();
    } else if (preloaded >= 0 && slot.ready) {
      this.cue(slot)
        .then(() => this.startIfActive(slot))
        .catch(noop);
    } else {
      this.load(this.activeIndex, source);
    }
  }

  /**
   * Loads neighbors into the idle players, most important first, so they
   * can start instantly. Players already holding one of them keep it.
   */
  preload(...sources: (MomentSource | null | undefined)[]): void {
    this.ensureSlots();
    const wanted = sources.filter((s): s is MomentSource => !!s);
    const plan = planPreload(
      this.slots.map(s => s.source?.key ?? null),
      this.activeIndex,
      wanted.map(s => s.key),
    );
    for (const {slot, key} of plan) {
      const source = wanted.find(s => s.key === key);
      if (source) this.load(slot, source);
    }
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
      this.cue(slot)
        .then(() => this.startIfActive(slot))
        .catch(noop);
      return;
    }
    this.startActive();
  }

  /** Seeks within the active moment. `positionMs` is a position in the surah file. */
  async seek(positionMs: number): Promise<void> {
    const slot = this.slots[this.activeIndex];
    if (!slot?.source || !slot.ready) return;
    const offset = slot.source.offsetMs ?? 0;
    const clamped = Math.min(
      Math.max(positionMs - offset, slot.source.startMs),
      slot.source.endMs - 250,
    );
    slot.ended = false;
    slot.atStart = false;
    this.emit({positionMs: clamped + offset});
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
    this.clock = 0;
    this.emit({key: null, positionMs: 0, playing: false, buffering: false});
    audioCoordinator.sourceDidStop('moments');
  }
}

export const momentsAudioService = MomentsAudioService.getInstance();
// @ai-end
