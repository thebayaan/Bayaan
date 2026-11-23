// @ai-generated
/**
 * Keeps the adhkar reader on the same dhikr when the pager's width changes
 * (rotation, Split View, Stage Manager).
 *
 * Left to right, the existing list is scrolled to `index * newWidth` right
 * after the resize, so every page stays mounted and keeps its own state (its
 * scroll position, an opened instruction).
 *
 * In Arabic that scroll landed several dhikr away: a right-to-left list turns
 * the offset into a native x with the content length and visible length of
 * the previous layout, which only update later from layout events (and Play
 * All followed it). There the pager is remounted under a new key and opens
 * on the current dhikr through `initialScrollIndex`, which the list applies
 * once the new content has been measured: the same path as opening the
 * reader.
 */
import {useEffect, useRef, type RefObject} from 'react';
import {I18nManager} from 'react-native';
import {isRTL} from '@/utils/rtl';

export interface PagerWidthAnchor {
  /** Changes with the width of a right-to-left pager, so a resize mounts a
   * fresh list. */
  pagerKey: string;
  /** Page to open the remounted list on; null until the first remount. */
  startIndex: number | null;
}

/** The part of the pager's list that a left-to-right resize uses. */
export interface ScrollablePager {
  scrollToOffset(params: {offset: number; animated?: boolean}): void;
}

/**
 * True when a width change remounts the pager: the list is right to left,
 * by the native direction (which it converts offsets with) or the app's.
 */
export function pagerRemountsOnResize(): boolean {
  return I18nManager.isRTL || isRTL;
}

/**
 * `onResize` runs during the render that remounts the list, before the new
 * list can report anything, so the reader can treat that list's first
 * viewability report as the page it opened on rather than a swipe. It does
 * not run for a left-to-right list, which is scrolled through `listRef`
 * instead of remounted.
 */
export function usePagerWidthAnchor(
  pageWidth: number | null,
  currentIndex: number,
  onResize: () => void,
  listRef: RefObject<ScrollablePager | null>,
): PagerWidthAnchor {
  const anchor = useRef<{
    width: number | null;
    // The width the list was mounted at, which names its key.
    keyWidth: number | null;
    startIndex: number | null;
  }>({width: null, keyWidth: null, startIndex: null});
  // Left to right: the page to scroll back to at the new width.
  const scrollBackTo = useRef<number | null>(null);
  if (pageWidth !== null && pageWidth !== anchor.current.width) {
    const resized = anchor.current.width !== null;
    if (resized && !pagerRemountsOnResize()) {
      anchor.current = {...anchor.current, width: pageWidth};
      scrollBackTo.current = currentIndex;
    } else {
      anchor.current = {
        width: pageWidth,
        keyWidth: pageWidth,
        startIndex: resized ? currentIndex : anchor.current.startIndex,
      };
      if (resized) onResize();
    }
  }
  useEffect(() => {
    const index = scrollBackTo.current;
    if (index === null || pageWidth === null) return;
    scrollBackTo.current = null;
    listRef.current?.scrollToOffset({
      offset: index * pageWidth,
      animated: false,
    });
  }, [pageWidth, listRef]);
  return {
    pagerKey: `pager-${anchor.current.keyWidth ?? 0}`,
    startIndex: anchor.current.startIndex,
  };
}
