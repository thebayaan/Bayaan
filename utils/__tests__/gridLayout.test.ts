// @ai-generated
import {
  computeGridLayout,
  computeShelfLayout,
  pageSpacing,
} from '../gridLayout';

const opts = {minCardWidth: 120, horizontalPadding: 10, gap: 10, minColumns: 3};

describe('computeGridLayout', () => {
  it('fits the row exactly inside the container', () => {
    for (const width of [320, 375, 430, 678, 720, 834, 1024]) {
      const {numColumns, itemWidth} = computeGridLayout(width, opts);
      const rowWidth =
        numColumns * itemWidth +
        (numColumns - 1) * opts.gap +
        opts.horizontalPadding * 2;
      expect(rowWidth).toBeCloseTo(width, 5);
    }
  });

  it('keeps every card at least minCardWidth when above minColumns', () => {
    const {numColumns, itemWidth} = computeGridLayout(720, opts);
    expect(numColumns).toBe(5);
    expect(itemWidth).toBeGreaterThanOrEqual(opts.minCardWidth);
  });

  it('uses the container width, so a narrower pane gets fewer columns', () => {
    // A 1024pt window with an 88pt rail and a 720pt column.
    expect(computeGridLayout(720, opts).numColumns).toBeLessThan(
      computeGridLayout(1024, opts).numColumns,
    );
  });

  it('never drops below minColumns on a phone', () => {
    const {numColumns, itemWidth} = computeGridLayout(320, opts);
    expect(numColumns).toBe(3);
    expect(itemWidth).toBeGreaterThan(0);
  });

  it('handles an unmeasured (zero) width', () => {
    expect(computeGridLayout(0, opts)).toEqual({numColumns: 3, itemWidth: 0});
  });
});

describe('computeShelfLayout', () => {
  const shelf = {minCardWidth: 150, leadingPadding: 18, gap: 13, peek: 0.3};

  it('shows whole cards and the chosen peek of the next one', () => {
    for (const width of [656, 746, 944, 1136]) {
      const {numColumns, itemWidth} = computeShelfLayout(width, shelf);
      const shown =
        shelf.leadingPadding +
        numColumns * (itemWidth + shelf.gap) +
        shelf.peek * itemWidth;
      expect(shown).toBeCloseTo(width, 5);
      expect(itemWidth).toBeGreaterThanOrEqual(shelf.minCardWidth);
    }
  });

  it('adds cards as the pane widens', () => {
    // iPad mini, 11" and 13" portrait panes beside the 88pt rail.
    expect(computeShelfLayout(656, shelf).numColumns).toBe(3);
    expect(computeShelfLayout(746, shelf).numColumns).toBe(4);
    expect(computeShelfLayout(944, shelf).numColumns).toBe(5);
  });

  it('keeps minColumns and handles an unmeasured width', () => {
    expect(computeShelfLayout(200, {...shelf, minColumns: 2}).numColumns).toBe(
      2,
    );
    expect(computeShelfLayout(0, shelf).itemWidth).toBe(0);
  });
});

describe('pageSpacing', () => {
  it('follows the width classes', () => {
    expect(pageSpacing(834)).toEqual({margin: 24, gap: 16});
    expect(pageSpacing(900)).toEqual({margin: 32, gap: 20});
    expect(pageSpacing(1279)).toEqual({margin: 32, gap: 20});
    expect(pageSpacing(1366)).toEqual({margin: 40, gap: 24});
  });
});
