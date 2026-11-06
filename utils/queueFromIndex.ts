// @ai-generated
/**
 * Build a play queue from a list where some entries could not be turned
 * into tracks (null), starting at the entry the user tapped.
 *
 * The queue keeps the list's order and does not wrap around: tapping row n
 * plays n to the end, and "previous" can still reach the earlier rows. The
 * returned startIndex points at row n (or the next playable row after it)
 * inside the compacted queue.
 */
export function queueFromIndex<T>(
  items: readonly (T | null | undefined)[],
  startIndex: number,
): {tracks: T[]; startIndex: number} {
  const tracks: T[] = [];
  let queueStart = -1;
  items.forEach((item, i) => {
    if (item == null) return;
    if (queueStart === -1 && i >= startIndex) queueStart = tracks.length;
    tracks.push(item);
  });
  return {tracks, startIndex: queueStart === -1 ? 0 : queueStart};
}
