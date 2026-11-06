// @ai-generated
export function hasPagerReachedInitialPage(
  contentWidth: number,
  pageWidth: number,
  initialPageIndex: number,
  pixelRatio: number,
): boolean {
  const targetX = initialPageIndex * pageWidth;

  // Android reports native layout widths as floats, while window dimensions use
  // JavaScript doubles. Compare physical pixels so rounding cannot hide a full page.
  return (
    Math.round(contentWidth * pixelRatio) >=
    Math.round((targetX + pageWidth) * pixelRatio)
  );
}
