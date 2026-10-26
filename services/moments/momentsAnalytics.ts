// @ai-start
/**
 * Analytics for one Moments session (screen open to close).
 *
 * The tracker turns card changes, playback updates and button taps into the
 * moments_* events. The question these events answer is whether Moments turns
 * listeners into fans of reciters they had not heard here before, so every
 * per-card event says whether the reciter was new to Moments this session,
 * and the session summary counts conversions: a Continue, or a Favorite turned
 * on, for such a reciter.
 *
 * It holds no React state and gets the clock and the event sink injected, so
 * it can be tested without the analytics service or a player.
 */

import type {
  MomentActionProps,
  MomentActionType,
  MomentEndReason,
  MomentEndedProps,
  MomentsEntry,
  MomentsOpenedProps,
  MomentsSessionEndedProps,
  MomentViewedProps,
} from '@/services/analytics/events';

/** The parts of a feed card the events need. */
export interface TrackedMoment {
  key: string;
  reciter: {id: string};
  rewayat: {id: string};
  passage: {id: string; surah: number};
  clip: {startMs: number};
}

/** The parts of the Moments playback state the tracker reads. */
export interface TrackedPlayback {
  key: string | null;
  positionMs: number;
  playing: boolean;
  buffering: boolean;
}

export interface MomentsAnalyticsSink {
  trackMomentsOpened(props: MomentsOpenedProps): void;
  trackMomentViewed(props: MomentViewedProps): void;
  trackMomentEnded(props: MomentEndedProps): void;
  trackMomentAction(props: MomentActionProps): void;
  trackMomentsSessionEnded(props: MomentsSessionEndedProps): void;
}

export interface EndedMoment {
  card: TrackedMoment;
  reason: MomentEndReason;
  listenedMs: number;
}

/** Same id for the same reciter, rewayah and passage in every session. */
export function momentId(card: TrackedMoment): string {
  return `${card.reciter.id}/${card.rewayat.id}/${card.passage.id}`;
}

export function buildMomentViewedProps(
  card: TrackedMoment,
  position: number,
  startLatencyMs: number,
  newReciter: boolean,
): MomentViewedProps {
  return {
    moment_id: momentId(card),
    reciter_id: card.reciter.id,
    rewayah_id: card.rewayat.id,
    surah: card.passage.surah,
    position,
    start_latency_ms: Math.max(0, Math.round(startLatencyMs)),
    new_reciter: newReciter,
  };
}

export function buildMomentEndedProps(
  card: TrackedMoment,
  listenedMs: number,
  reason: MomentEndReason,
): MomentEndedProps {
  return {
    moment_id: momentId(card),
    reciter_id: card.reciter.id,
    listened_ms: Math.max(0, Math.round(listenedMs)),
    reason,
  };
}

export function buildMomentActionProps(
  card: TrackedMoment,
  action: MomentActionType,
  newReciter: boolean,
  enabled?: boolean,
): MomentActionProps {
  const props: MomentActionProps = {
    moment_id: momentId(card),
    action,
    reciter_id: card.reciter.id,
    new_reciter: newReciter,
  };
  if (enabled !== undefined) props.enabled = enabled;
  return props;
}

/** Whether an action makes a reciter new to Moments count as converted. */
export function isConversion(
  action: MomentActionType,
  newReciter: boolean,
  enabled?: boolean,
): boolean {
  if (!newReciter) return false;
  if (action === 'continue') return true;
  return action === 'favorite' && enabled === true;
}

interface ActiveMoment {
  card: TrackedMoment;
  position: number;
  activatedAt: number;
  viewed: boolean;
  listenedMs: number;
  /** When the current stretch of audible playback started. */
  playingSince: number | null;
}

export interface MomentsSessionOptions {
  entry: MomentsEntry;
  /** Reciter id to plays in Moments before this session. */
  priorPlays: Readonly<Record<string, number>>;
  sink: MomentsAnalyticsSink;
  now?: () => number;
}

export class MomentsSessionTracker {
  private readonly entry: MomentsEntry;
  private readonly priorPlays: Readonly<Record<string, number>>;
  private readonly sink: MomentsAnalyticsSink;
  private readonly now: () => number;
  private openedAt = 0;
  private open = false;
  private active: ActiveMoment | null = null;
  private cardsSeen = 0;
  private newRecitersSeen = new Set<string>();
  private converted = new Set<string>();

  constructor(options: MomentsSessionOptions) {
    this.entry = options.entry;
    this.priorPlays = options.priorPlays;
    this.sink = options.sink;
    this.now = options.now ?? Date.now;
  }

  isNewReciter(reciterId: string): boolean {
    return (this.priorPlays[reciterId] ?? 0) === 0;
  }

  start(): void {
    if (this.open) return;
    this.open = true;
    this.openedAt = this.now();
    this.sink.trackMomentsOpened({entry: this.entry});
  }

  /**
   * A card became the one on screen at `position` (its index in the feed).
   * Ends the previous card as swiped if it had not ended already, and
   * returns that end.
   */
  activate(card: TrackedMoment, position: number): EndedMoment | null {
    if (!this.open || this.active?.card.key === card.key) return null;
    const ended = this.endActive('swiped');
    this.active = {
      card,
      position,
      activatedAt: this.now(),
      viewed: false,
      listenedMs: 0,
      playingSince: null,
    };
    this.cardsSeen++;
    if (this.isNewReciter(card.reciter.id)) {
      this.newRecitersSeen.add(card.reciter.id);
    }
    return ended;
  }

  /** Feed every playback update here. Updates for other cards are ignored. */
  progress(playback: TrackedPlayback): void {
    const active = this.active;
    if (!this.open || !active || playback.key !== active.card.key) return;
    const now = this.now();
    if (!active.viewed && playback.positionMs > active.card.clip.startMs) {
      active.viewed = true;
      this.sink.trackMomentViewed(
        buildMomentViewedProps(
          active.card,
          active.position,
          now - active.activatedAt,
          this.isNewReciter(active.card.reciter.id),
        ),
      );
    }
    if (active.playingSince !== null) {
      active.listenedMs += now - active.playingSince;
    }
    active.playingSince = playback.playing && !playback.buffering ? now : null;
  }

  /** The audio service reported the end of a card's clip. */
  complete(key: string): EndedMoment | null {
    if (this.active?.card.key !== key) return null;
    return this.endActive('completed');
  }

  action(card: TrackedMoment, action: MomentActionType, enabled?: boolean) {
    if (!this.open) return;
    const newReciter = this.isNewReciter(card.reciter.id);
    this.sink.trackMomentAction(
      buildMomentActionProps(card, action, newReciter, enabled),
    );
    if (isConversion(action, newReciter, enabled)) {
      this.converted.add(card.reciter.id);
    }
  }

  /** The screen closed. Ends the card on screen as left. */
  close(): EndedMoment | null {
    if (!this.open) return null;
    const ended = this.endActive('left');
    this.open = false;
    this.sink.trackMomentsSessionEnded({
      cards_seen: this.cardsSeen,
      duration_ms: Math.max(0, this.now() - this.openedAt),
      conversions: this.converted.size,
      new_reciters_seen: this.newRecitersSeen.size,
    });
    return ended;
  }

  private endActive(reason: MomentEndReason): EndedMoment | null {
    const active = this.active;
    if (!active) return null;
    this.active = null;
    if (active.playingSince !== null) {
      active.listenedMs += this.now() - active.playingSince;
    }
    this.sink.trackMomentEnded(
      buildMomentEndedProps(active.card, active.listenedMs, reason),
    );
    return {card: active.card, reason, listenedMs: active.listenedMs};
  }
}
// @ai-end
