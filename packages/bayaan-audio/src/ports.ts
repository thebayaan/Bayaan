/**
 * @bayaan/audio ports
 *
 * The five interfaces a consumer implements when integrating @bayaan/audio.
 * Defined in ADR-0001. The package calls into ports; ports never call back
 * into the package. Flow is one-directional: package → port → consumer.
 *
 * Every method is either sync void or returns a Promise. No hidden state.
 */

import type {
  AyahTimestamp,
  BaseTrack,
  LockScreenMetadata,
  PlaybackState,
} from '@bayaan/types';

// ============================================================
// PlayerController — state + progress + persistence bridge
// ============================================================

/**
 * Bridges @bayaan/audio's playback events into the consumer's state model
 * (Zustand, Redux, signals, anything). Replaces today's bidirectional
 * coupling between ExpoAudioProvider and playerStore (ADR-0001 §Context.1).
 *
 * The package fires events; the consumer decides what to persist, render,
 * or ignore. Repeat / queue / shuffle logic stays consumer-side — see the
 * onTrackEnded note below.
 */
export interface PlayerController<TTrack extends BaseTrack = BaseTrack> {
  /** Fired when the underlying AudioPlayer's playback state changes. */
  onPlaybackStateChange(state: PlaybackState): void;

  /**
   * Fired on a throttled interval during playback (typically ~500ms).
   * Consumer decides whether to persist, update UI, or both.
   */
  onProgressUpdate(positionMs: number, durationMs: number): void;

  /** Fired when a new track is loaded or the current track is cleared. */
  onTrackChanged(track: TTrack | null): void;

  /**
   * Fired when the current track reaches its natural end (the package's
   * equivalent of expo-audio's `didJustFinish`). The consumer decides what
   * happens next — repeat, advance, or stop. The package does not make
   * this decision: repeat modes, queue advance, and shuffle are consumer
   * concerns (see Bayaan's playerStore and Qariah's queueRecitations).
   *
   * Ordering note: after didJustFinish fires, the native player's
   * currentItem is nil; seekTo(0) + play() on the same source is a no-op.
   * Consumers that want to repeat must reload the source.
   */
  onTrackEnded(track: TTrack): void;

  /** Fired on any playback error. Consumer decides retry policy. */
  onError(error: Error, context: Record<string, unknown>): void;

  /**
   * Called by the provider on a lower-frequency cadence (e.g. every 10s,
   * on pause, on track change) so the consumer can persist progress.
   * Consumer implements the actual write (AsyncStorage, MMKV, SQLite,
   * network).
   *
   * `durationMs` is included so consumers can compute completion percent
   * without cross-referencing the current-track state.
   */
  onProgressPersist(track: TTrack, positionMs: number, durationMs: number): void;
}

// ============================================================
// CoordinatorHooks — how AudioCoordinator pauses consumer-owned players
// ============================================================

/**
 * Replaces the lazy `require()` in AudioCoordinator (Bayaan-Architecture
 * §3.1) that breaks the circular dep between AudioCoordinator ↔
 * mushafPlayerStore ↔ MushafAudioService.
 *
 * Consumer wires this at app startup. AudioCoordinator never imports a
 * consumer store directly.
 */
export interface CoordinatorHooks {
  pauseMain(): void;
  pauseMushaf(): void;
  getMainIsPlaying(): boolean;
  getMushafIsPlaying(): boolean;
}

// ============================================================
// PlayerEventSink — analytics hook
// ============================================================

/**
 * Routes analytics events. Generic in TTrack so the sink receives the same
 * track shape the PlayerController sees, letting consumers read consumer-
 * specific metadata (surahId, reciterId, rewayahId) directly from the
 * track without the package caring.
 *
 * Lifecycle-computed fields (listenedMs, completion %) are passed as
 * explicit arguments by the package; domain fields live on the track.
 */
export interface PlayerEventSink<TTrack extends BaseTrack = BaseTrack> {
  onPlaybackStarted(track: TTrack): void;
  onPlaybackCompleted(track: TTrack, listenedMs: number): void;
  onPlaybackPaused(track: TTrack, positionMs: number): void;
  onSkip(track: TTrack, direction: 'forward' | 'backward'): void;
  onRateChange(oldRate: number, newRate: number): void;
  onSeek(track: TTrack, fromPositionMs: number, toPositionMs: number): void;
  onError(error: Error, context: Record<string, unknown>): void;
}

/**
 * Ready-made no-op sink for consumers that don't want analytics. Required
 * to be passed explicitly (rather than implicit-default) so consumers
 * acknowledge the analytics decision at wire-up time. See ADR-0001 §Decision.6.
 */
export const NullPlayerEventSink: PlayerEventSink<BaseTrack> = {
  onPlaybackStarted: () => {},
  onPlaybackCompleted: () => {},
  onPlaybackPaused: () => {},
  onSkip: () => {},
  onRateChange: () => {},
  onSeek: () => {},
  onError: () => {},
};

// ============================================================
// TimestampProvider — consumer-owned ayah timing data
// ============================================================

/**
 * The package consumes a Promise; data origin is opaque (Bayaan hosts its
 * own DB; Qariah uses per-recitation timestamps from its backend).
 *
 * Keyed by recitation, not by reciter — both consumers have cases where a
 * single reciter has multiple recitations of the same surah, so
 * (surahId, reciterId) under-identifies. `recitationKey` is consumer-
 * opaque: pass whatever string uniquely identifies the recitation in your
 * data model.
 */
export interface TimestampProvider {
  fetchTimestamps(recitationKey: string): Promise<AyahTimestamp[]>;
}

// ============================================================
// LockScreenMetadataSource — subscription-based lock screen feed
// ============================================================

/**
 * LockScreenService today calls `usePlayerStore.subscribe()` and
 * `useMushafPlayerStore.subscribe()` directly — that's the coupling this
 * port removes.
 *
 * Listener is called with `null` when the source should be cleared (on
 * stop, or when mushaf takes over from main player).
 */
export interface LockScreenMetadataSource {
  subscribeMain(listener: (metadata: LockScreenMetadata | null) => void): Unsubscribe;
  subscribeMushaf(listener: (metadata: LockScreenMetadata | null) => void): Unsubscribe;
}

export type Unsubscribe = () => void;

// ============================================================
// BayaanAudioConfig — the full consumer config the package takes at init
// ============================================================

/**
 * Passed to the (future) `BayaanAudioProvider` once RFC-004's later
 * extraction PRs land. Surfaced here so consumer apps can prepare their
 * wire-up shape ahead of the migration.
 */
export interface BayaanAudioConfig<TTrack extends BaseTrack = BaseTrack> {
  controller: PlayerController<TTrack>;
  coordinator: CoordinatorHooks;
  /**
   * Required (not optional). Pass `NullPlayerEventSink` to opt out of
   * analytics explicitly.
   */
  eventSink: PlayerEventSink<TTrack>;
  /** Required only if mushaf audio is used. */
  timestamps?: TimestampProvider;
  /** Required only if lock-screen controls are wanted. */
  lockScreen?: LockScreenMetadataSource;
}
