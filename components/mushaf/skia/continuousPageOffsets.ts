// @ai-generated
// Where each page sits in the vertical Mushaf scroll. A page there is its
// line count times the line height (the lines MushafPageContent and
// ContinuousQCFPage stack from its top), so every height is known before the
// page renders. The list is given these offsets instead of estimating them:
// the first scroll and every jump land on the page asked for.

/**
 * `offsets[i]` is the top of page `i + 1` in the list content, which starts
 * at `contentTop` (the list's top padding); `offsets[pageCount]` is the end
 * of the last page.
 */
export function buildPageOffsets(
  pageCount: number,
  lineCountOf: (page: number) => number,
  lineHeight: number,
  contentTop: number,
): number[] {
  const offsets = [contentTop];
  for (let page = 1; page <= pageCount; page++) {
    offsets.push(offsets[page - 1] + lineCountOf(page) * lineHeight);
  }
  return offsets;
}

/** The FlatList `getItemLayout` entry of list index `index` (page `index + 1`). */
export function pageItemLayout(
  offsets: readonly number[],
  index: number,
): {length: number; offset: number; index: number} {
  return {
    length: offsets[index + 1] - offsets[index],
    offset: offsets[index],
    index,
  };
}
