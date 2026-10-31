// @ai-generated
/**
 * How the vertical mushaf opens on the reader's page.
 *
 * FlashList v2 has no item size hint: it lays out every page it has not
 * measured at a running average that starts at 200pt. A phone page is about
 * 579pt. With `initialScrollIndex` the list scrolled to the start page's
 * measured offset while the pages above it were still laid out near the
 * estimate, so the offset fell on a later page (270 opened as 445, 100 as
 * 164) and that page became the reading position.
 *
 * So the list mounts at the top, hidden, and once it has measured its first
 * pages (`onLoad`) it scrolls to the start page with `scrollToIndex`, which
 * re-reads the layouts as it goes. The page reports the list makes before
 * that are ignored.
 */
export interface ContinuousPagePlacement {
  /** The FlashList index to scroll to on load. */
  openingIndex: number;
  maintainVisibleContentPosition: {disabled: true};
}

// One object, so the list does not see a new setting on every render.
const NO_POSITION_CORRECTION: {disabled: true} = {disabled: true};

export function continuousPagePlacement(
  openingPage: number,
): ContinuousPagePlacement {
  return {
    openingIndex: openingPage - 1,
    maintainVisibleContentPosition: NO_POSITION_CORRECTION,
  };
}
