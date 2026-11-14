// @ai-generated
/**
 * Keeps the adhkar reader on the same dhikr when the pager's width changes
 * (rotation, Split View, Stage Manager).
 *
 * The readers used to scroll the existing list to `index * newWidth` right
 * after the resize. In Arabic the list turns that offset into a native x with
 * the content length and visible length of the previous layout, which only
 * update later from layout events, so the pager landed several dhikr away
 * (and Play All followed it). Instead the pager is remounted under a new key
 * and opens on the current dhikr through `initialScrollIndex`, which the list
 * applies once the new content has been measured: the same path as opening
 * the reader, in both directions.
 */
import {useRef} from 'react';

export interface PagerWidthAnchor {
  /** Changes with the width, so a resize mounts a fresh list. */
  pagerKey: string;
  /** Page to open the remounted list on; null until the first resize. */
  startIndex: number | null;
}

/**
 * `onResize` runs during the render that remounts the list, before the new
 * list can report anything, so the reader can treat that list's first
 * viewability report as the page it opened on rather than a swipe.
 */
export function usePagerWidthAnchor(
  pageWidth: number | null,
  currentIndex: number,
  onResize: () => void,
): PagerWidthAnchor {
  const anchor = useRef<{width: number | null; startIndex: number | null}>({
    width: null,
    startIndex: null,
  });
  if (pageWidth !== null && pageWidth !== anchor.current.width) {
    const resized = anchor.current.width !== null;
    anchor.current = {
      width: pageWidth,
      startIndex: resized ? currentIndex : anchor.current.startIndex,
    };
    if (resized) onResize();
  }
  return {
    pagerKey: `pager-${anchor.current.width ?? 0}`,
    startIndex: anchor.current.startIndex,
  };
}
