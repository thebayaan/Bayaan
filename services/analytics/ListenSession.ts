// @ai-generated
import {
  PlaybackCompletedProps,
  PlaybackPausedProps,
  PlaybackResumedProps,
  PlaybackSkippedProps,
  PlaybackStartedProps,
} from './events';

/** A stop this close to the end of the track is the track end, not a pause. */
const TRACK_END_WINDOW_MS = 2000;

export interface ListenTrack {
  surahId: number;
  reciterId: string;
  reciterName: string;
  rewayahId: string;
}

/** Where the native player is, in milliseconds. */
export interface ListenPosition {
  positionMs: number;
  durationMs: number;
  didJustFinish?: boolean;
  /** The player waits for data: a stall, not listened time. */
  isBuffering?: boolean;
}

export interface ListenSessionEvents {
  started(props: PlaybackStartedProps): void;
  paused(props: PlaybackPausedProps): void;
  resumed(props: PlaybackResumedProps): void;
  completed(props: PlaybackCompletedProps): void;
  skipped(props: PlaybackSkippedProps): void;
  /** One listened segment. Each segment comes here once, for the totals. */
  listened(ms: number, track: ListenTrack): void;
}

export type ListenEndArgs =
  | [
      reason: 'completed',
      at: {
        durationMs: number;
        /** The queue goes on by itself: a repeat, or the next track. */
        autoplayNext: boolean;
      },
    ]
  | [reason: 'skipped', at: {direction: 'next' | 'prev'; positionMs: number}]
  /** Another queue or track took over. Sends nothing. */
  | [reason: 'replaced'];

/**
 * The listening session of one track: from its start to its completion, a
 * skip, or a replacement. `playingChanged` takes the native playing edge, so
 * a button pause, a lock screen pause and an interruption take one path.
 */
export class ListenSession {
  private track: ListenTrack | null = null;
  /** When the open segment started; 0 when no segment is open. */
  private segmentStartedAt = 0;
  private listenedMs = 0;
  /** A playback_paused went out, so the next play is a resume. */
  private paused = false;
  /** The native player waits for data. */
  private buffering = false;
  private nextIsAutoplay = false;

  constructor(
    private readonly events: ListenSessionEvents,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get isOpen(): boolean {
    return this.track !== null;
  }

  /** The track started to play. */
  start(track: ListenTrack, positionMs: number): void {
    this.end('replaced');
    this.track = track;
    this.listenedMs = 0;
    this.paused = false;
    this.segmentStartedAt = this.buffering ? 0 : this.now();
    const source = this.nextIsAutoplay ? 'autoplay' : 'queue';
    this.nextIsAutoplay = false;
    this.events.started({
      ...this.trackProps(track),
      rewayah_id: track.rewayahId,
      source,
      position_ms: positionMs,
    });
  }

  /**
   * The native player started or stopped, or its buffering changed. A segment
   * is open while it plays and does not buffer: Android reports playing true
   * through a stall, iOS reports playing false.
   */
  playingChanged(playing: boolean, at: ListenPosition): void {
    this.buffering = at.isBuffering === true;
    const track = this.track;
    if (!track) return;
    if (playing && !this.buffering) {
      if (this.segmentStartedAt > 0) return;
      this.segmentStartedAt = this.now();
      if (!this.paused) return;
      this.paused = false;
      this.events.resumed({
        ...this.trackProps(track),
        position_ms: at.positionMs,
      });
      return;
    }
    if (this.segmentStartedAt === 0) return;
    const segmentMs = this.closeSegment(track);
    const isTrackEnd =
      at.didJustFinish ||
      (at.durationMs > 0 &&
        at.durationMs - at.positionMs < TRACK_END_WINDOW_MS);
    // A stall sends nothing. A pause during a stall sends nothing either: on
    // iOS no other status reports it, and on Android its stop comes when the
    // buffer fills, after the segment closed at the stall.
    if (isTrackEnd || this.buffering) return;
    this.paused = true;
    this.events.paused({
      ...this.trackProps(track),
      position_ms: at.positionMs,
      listened_ms: segmentMs,
    });
  }

  /**
   * The queue did not go on by itself after a completion that said it would
   * (the next track was held paused, or failed to load), so the next start
   * is the listener's own.
   */
  cancelAutoplay(): void {
    this.nextIsAutoplay = false;
  }

  /** Ends the session. A session ends once: a later end sends nothing. */
  end(...[reason, at]: ListenEndArgs): void {
    const track = this.track;
    if (!track) return;
    this.closeSegment(track);
    this.track = null;
    if (reason === 'completed') {
      this.nextIsAutoplay = at.autoplayNext;
      this.events.completed({
        ...this.trackProps(track),
        duration_ms: at.durationMs,
        listened_ms: this.listenedMs,
        completion_pct:
          at.durationMs > 0
            ? Math.round((this.listenedMs / at.durationMs) * 100)
            : 100,
      });
    } else if (reason === 'skipped') {
      this.events.skipped({
        ...this.trackProps(track),
        position_ms: at.positionMs,
        listened_ms: this.listenedMs,
        direction: at.direction,
      });
    }
  }

  private closeSegment(track: ListenTrack): number {
    if (this.segmentStartedAt === 0) return 0;
    const ms = Math.max(0, this.now() - this.segmentStartedAt);
    this.segmentStartedAt = 0;
    this.listenedMs += ms;
    this.events.listened(ms, track);
    return ms;
  }

  private trackProps(track: ListenTrack) {
    return {
      surah_id: track.surahId,
      reciter_id: track.reciterId,
      reciter_name: track.reciterName,
    };
  }
}
