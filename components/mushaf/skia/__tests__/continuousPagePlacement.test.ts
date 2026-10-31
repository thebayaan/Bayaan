// @ai-generated
/**
 * Switching to Scroll on page 100 opened the vertical mushaf on page 164,
 * and a cold open on page 270 landed on 445: the start scroll ran before
 * FlashList had measured any page (see continuousPagePlacement).
 */
import {continuousPagePlacement} from '../continuousPagePlacement';

describe('continuousPagePlacement', () => {
  it('scrolls to the page the reader was on', () => {
    expect(continuousPagePlacement(42).openingIndex).toBe(41);
    expect(continuousPagePlacement(1).openingIndex).toBe(0);
    expect(continuousPagePlacement(604).openingIndex).toBe(603);
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
});
