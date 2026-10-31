// @ai-generated
/** Where the vertical mushaf's page list opens, and how it keeps its place. */
export interface ContinuousPagePlacement {
  initialScrollIndex: number;
  maintainVisibleContentPosition: {disabled: true};
}

// One object, so the list does not see a new setting on every render.
const NO_POSITION_CORRECTION: {disabled: true} = {disabled: true};

/**
 * Opens the vertical mushaf on `initialPage`.
 *
 * FlashList places every page it has not measured yet at a 200pt estimate,
 * and by default corrects the scroll offset whenever the rows above the
 * first visible one change size. Opening on page N scrolls past N - 1
 * estimated rows. Once the first pages are measured (a phone page is about
 * 550pt) every row above is estimated again and page N moves down: the
 * initial scroll follows it there, and the position correction then adds
 * the same shift a second time. The list opened about 2 - 200 / pageHeight
 * times too far, page 42 as 68 and page 100 as 164, and that wrong page
 * became the reading position.
 *
 * Every mushaf page is 15 lines (only the two opening pages are shorter), so
 * once one page is measured the estimates are exact and there is no shift
 * left to correct. Without the correction the initial scroll lands on the
 * page.
 */
export function continuousPagePlacement(
  initialPage: number,
): ContinuousPagePlacement {
  return {
    initialScrollIndex: initialPage - 1,
    maintainVisibleContentPosition: NO_POSITION_CORRECTION,
  };
}
