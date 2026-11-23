// @ai-generated
/**
 * Tells the adhkar reader when a swipe by the user has come to rest.
 *
 * In Play All the audio follows the page the user swipes to. It used to
 * follow as soon as the next page was half visible, with the finger still
 * down: dragging past halfway and back switched the audio to the next dhikr
 * and then restarted the first one. A swipe now counts once the pager has
 * stopped on a page.
 *
 * The readers feed it the pager's scroll events and ask `isSwiping()` before
 * they act on a page change; `onSettled` runs once per swipe, at rest.
 */
import {useEffect, useRef} from 'react';

// A paging snap takes a few hundred ms. If no scroll-end event has arrived
// this long after the finger lifted, the page shown is taken as final, so a
// missing event cannot leave the audio behind the page.
export const SWIPE_SETTLE_FALLBACK_MS = 1000;
// An offset within this many points of a page edge is on that page.
const AT_REST_TOLERANCE = 1;

export interface SwipeSettle {
  /** True from the start of a drag until the pager has come to rest. */
  isSwiping(): boolean;
  onScrollBeginDrag(): void;
  /** The finger lifted with the pager at this scroll offset. */
  onScrollEndDrag(offset: number, pageWidth: number | null): void;
  onMomentumScrollEnd(): void;
  dispose(): void;
}

export function createSwipeSettle(onSettled: () => void): SwipeSettle {
  let swiping = false;
  let fingerDown = false;
  let fallback: ReturnType<typeof setTimeout> | null = null;

  function clearFallback(): void {
    if (fallback) clearTimeout(fallback);
    fallback = null;
  }

  function settle(): void {
    clearFallback();
    if (!swiping) return;
    swiping = false;
    onSettled();
  }

  return {
    isSwiping: () => swiping,
    onScrollBeginDrag() {
      clearFallback();
      swiping = true;
      fingerDown = true;
    },
    onScrollEndDrag(offset, pageWidth) {
      fingerDown = false;
      if (!swiping) return;
      // Lifted exactly on a page: nothing is left to animate, and iOS sends
      // no momentum event then. Page edges are multiples of the page width
      // whichever side the offset is counted from, so this holds in RTL too.
      if (
        pageWidth &&
        Math.abs(offset - Math.round(offset / pageWidth) * pageWidth) <
          AT_REST_TOLERANCE
      ) {
        settle();
        return;
      }
      clearFallback();
      fallback = setTimeout(settle, SWIPE_SETTLE_FALLBACK_MS);
    },
    onMomentumScrollEnd() {
      // Android also sends this when a new drag cuts the previous snap
      // short. The finger is down again then, so that swipe is not over.
      if (fingerDown) return;
      settle();
    },
    dispose: clearFallback,
  };
}

/** One SwipeSettle for the life of the screen; `onSettled` may change. */
export function useSwipeSettle(onSettled: () => void): SwipeSettle {
  const latest = useRef(onSettled);
  latest.current = onSettled;
  const made = useRef<SwipeSettle | null>(null);
  if (made.current === null) {
    made.current = createSwipeSettle(() => latest.current());
  }
  const swipe = made.current;
  useEffect(() => () => swipe.dispose(), [swipe]);
  return swipe;
}
