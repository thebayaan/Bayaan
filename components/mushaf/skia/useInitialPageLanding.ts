// @ai-generated
import {useCallback, useMemo, useRef} from 'react';

interface InitialPageLanding {
  /** For the list's onLoad: lands on the start page once laid out. */
  onLoad: () => void;
  /** False until then, so pages scrolled past on the way are not recorded. */
  hasLanded: () => boolean;
}

/**
 * Opens a list of pages on `initialPage`. Pages differ in height, so the
 * list's initialScrollIndex lands from estimated sizes and can open dozens of
 * pages away (page 42 opened as 68). Once the list has measured its first
 * pages it scrolls to the start page for real, and until it has, the pages
 * it reports as visible are not the reader's and must not be saved.
 */
export function useInitialPageLanding(
  initialPage: number,
  scrollToIndex: (index: number) => void,
  schedule: (run: () => void) => void = requestAnimationFrame,
): InitialPageLanding {
  const landedRef = useRef(false);
  const startRef = useRef(initialPage);

  const onLoad = useCallback(() => {
    if (landedRef.current) return;
    scrollToIndex(startRef.current - 1);
    schedule(() => {
      landedRef.current = true;
    });
  }, [scrollToIndex, schedule]);

  const hasLanded = useCallback(() => landedRef.current, []);

  return useMemo(() => ({onLoad, hasLanded}), [onLoad, hasLanded]);
}
