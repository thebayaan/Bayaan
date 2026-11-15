/**
 * @ai The pure part of removeFromQueue(): which tracks stay, where the
 * current index goes, and what the removal did to the current track. It
 * reads no store and starts no load, so removeFromQueue() can do one switch
 * on the outcome.
 */

/** What a removal did to the current track. */
export type QueueRemovalOutcome =
  /** The current track stays. Nothing to load. */
  | 'currentUnchanged'
  /** The current track went, and another track takes its place. */
  | 'newCurrent'
  /** No track is left. */
  | 'emptied';

export interface QueueRemoval<T> {
  /** The queue after the removal. */
  tracks: T[];
  /** The current index in `tracks` (0 when `tracks` is empty). */
  index: number;
  outcome: QueueRemovalOutcome;
}

/**
 * Remove the tracks at `indices` from a queue that plays `currentIndex`.
 *
 * The indices refer to `tracks` as given. An index out of range does
 * nothing, and a repeated index counts once. When the current track goes,
 * the next track that stays takes its place. When no track stays after it,
 * the last track that stays before it does.
 */
export function computeQueueRemoval<T>(
  {tracks, currentIndex}: {readonly tracks: readonly T[]; currentIndex: number},
  indices: readonly number[],
): QueueRemoval<T> {
  const removed = new Set(indices.filter(i => i >= 0 && i < tracks.length));
  const kept = tracks.filter((_, i) => !removed.has(i));
  if (kept.length === 0 && tracks.length > 0) {
    return {tracks: kept, index: 0, outcome: 'emptied'};
  }

  // Each removal before the current track moves it back by one. When the
  // current track went, this index is the next track that stays.
  const removedBefore = [...removed].filter(i => i < currentIndex).length;
  const index = Math.max(0, currentIndex - removedBefore);
  if (!removed.has(currentIndex)) {
    return {tracks: kept, index, outcome: 'currentUnchanged'};
  }
  return {
    tracks: kept,
    index: Math.min(index, kept.length - 1),
    outcome: 'newCurrent',
  };
}
