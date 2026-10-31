// @ai-generated
/**
 * Switching from Book to Scroll on page 42 opened the vertical mushaf on
 * page 68 (page 100 on 164): FlashList's scroll position correction added
 * the shift of the re-estimated rows above the start page on top of the
 * initial scroll that already followed it (see continuousPagePlacement).
 */
import {continuousPagePlacement} from '../continuousPagePlacement';

/** Where the list lands when the shift is applied twice. */
function landedIndex(
  startIndex: number,
  estimate: number,
  pageHeight: number,
  corrected: boolean,
): number {
  const estimatedOffset = startIndex * estimate;
  const measuredOffset = startIndex * pageHeight;
  const shift = measuredOffset - estimatedOffset;
  const offset = measuredOffset + (corrected ? shift : 0);
  return Math.floor(offset / pageHeight);
}

describe('continuousPagePlacement', () => {
  it('opens on the page the reader was on', () => {
    expect(continuousPagePlacement(42).initialScrollIndex).toBe(41);
    expect(continuousPagePlacement(1).initialScrollIndex).toBe(0);
    expect(continuousPagePlacement(604).initialScrollIndex).toBe(603);
  });

  it('turns off the scroll position correction', () => {
    expect(
      continuousPagePlacement(42).maintainVisibleContentPosition.disabled,
    ).toBe(true);
  });

  it('hands the list the same setting on every render', () => {
    expect(continuousPagePlacement(42).maintainVisibleContentPosition).toBe(
      continuousPagePlacement(100).maintainVisibleContentPosition,
    );
  });

  it('matches the pages the correction opened on', () => {
    // A 550pt phone page against FlashList's 200pt estimate (the device,
    // with its real page height, opened page 100 on 164).
    expect(landedIndex(41, 200, 550, true) + 1).toBe(68);
    expect(landedIndex(99, 200, 550, true) + 1).toBe(163);
    expect(landedIndex(41, 200, 550, false) + 1).toBe(42);
  });
});
