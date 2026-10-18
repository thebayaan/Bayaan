/**
 * Tells a Play All auto-scroll apart from a user swipe in the adhkar reader.
 *
 * Play All can jump several rows at once (it skips rows without audio), so
 * the rows passed on the way report as viewable while the scroll animates,
 * sometimes late. The reader keeps the row it is scrolling to as `target`
 * and treats every viewable change as part of that scroll until it settles
 * on the target. A drag by the user clears the target (see the screens).
 */
export interface ViewableChange {
  /** True when the change came from the user, so Play All should follow. */
  isUserSwipe: boolean;
  /** The Play All scroll target still in flight, or null once settled. */
  target: number | null;
}

export function resolveViewableChange(
  target: number | null,
  newIndex: number,
): ViewableChange {
  if (target === null) return {isUserSwipe: true, target: null};
  if (newIndex === target) return {isUserSwipe: false, target: null};
  return {isUserSwipe: false, target};
}
