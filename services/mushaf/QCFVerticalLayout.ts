// @ai-start
/** Keep measured tajweed paragraphs inside the page without shrinking glyphs. */
export function fitQCFLinePositions(
  positions: number[],
  measuredLines: Array<{lineIndex: number; height: number}>,
  contentHeight: number,
): number[] {
  let scale = 1;
  for (const {lineIndex, height} of measuredLines) {
    const top = positions[lineIndex];
    if (top > 0) {
      scale = Math.min(scale, Math.max(0, (contentHeight - height - 2) / top));
    }
  }
  return scale < 1 ? positions.map(top => top * scale) : positions;
}
// @ai-end
