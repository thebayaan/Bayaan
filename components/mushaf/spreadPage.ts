// @ai-generated
/** The two pages of an iPad spread: the odd page on the right, the even one
 *  on the left (`null` only for a mushaf with an odd page count). */
export interface SpreadPages {
  right: number;
  left: number | null;
}

function spreadHolds(spread: SpreadPages, page: number | null): boolean {
  return page !== null && (page === spread.right || page === spread.left);
}

/**
 * The page a spread that just came into view stands for.
 *
 * A page the reader jumped to wins when the spread holds it: a jump to an
 * even page (Ta-Ha starts on 312, the left of 311 | 312) used to make the
 * facing odd page current, so the header named the surah before it and
 * last-read saved the wrong page. Otherwise the page the reader was already
 * on, so a rotation into landscape does not turn page 2 into page 1, and
 * failing both the spread's first page.
 */
export function spreadPageToShow(
  spread: SpreadPages,
  current: number,
  jumpTarget: number | null,
): number {
  if (spreadHolds(spread, jumpTarget)) return jumpTarget as number;
  if (spreadHolds(spread, current)) return current;
  return spread.right;
}

/** Whether `page` is shown by the same spread as `current`. A jump there
 *  scrolls nowhere, so the list reports no newly visible spread. */
export function sameSpread(page: number, current: number): boolean {
  return Math.floor((page - 1) / 2) === Math.floor((current - 1) / 2);
}
