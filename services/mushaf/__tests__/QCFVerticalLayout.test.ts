// @ai-start
import {fitQCFLinePositions} from '../QCFVerticalLayout';

describe('QCF tajweed vertical layout', () => {
  it('keeps every paragraph above the footer when the last line exceeds its slot', () => {
    const positions = Array.from({length: 15}, (_, index) => index * 40);
    const measuredLines = positions.map((_, lineIndex) => ({
      lineIndex,
      height: lineIndex === 14 ? 74 : 60,
    }));

    const fitted = fitQCFLinePositions(positions, measuredLines, 600);

    expect(fitted[0]).toBe(0);
    expect(fitted[14]).toBeCloseTo(524);
    for (const {lineIndex, height} of measuredLines) {
      expect(fitted[lineIndex] + height).toBeLessThanOrEqual(598);
    }
    // Use one scale for the shared text/header/hit-test positions.
    expect(fitted[7]).toBeCloseTo(fitted[14] / 2);
    expect(positions[14]).toBe(560);
  });

  it('accounts for a taller earlier paragraph, not just the final line', () => {
    const fitted = fitQCFLinePositions(
      [0, 40, 80],
      [
        {lineIndex: 1, height: 80},
        {lineIndex: 2, height: 20},
      ],
      110,
    );

    expect(fitted).toEqual([0, 28, 56]);
    expect(fitted[1] + 80).toBe(108);
  });

  it('preserves centered opening pages and other lines that already fit', () => {
    const positions = [180, 220, 260, 300, 340, 380];
    const measuredLines = positions.map((_, lineIndex) => ({
      lineIndex,
      height: 60,
    }));

    expect(fitQCFLinePositions(positions, measuredLines, 600)).toBe(positions);
  });
});
// @ai-end
