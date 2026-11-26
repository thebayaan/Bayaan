// @ai-generated
import {sameSpread, spreadPageToShow} from '../spreadPage';

// Ta-Ha starts on page 312, the left (even) page of the 311 | 312 spread.
const tahaSpread = {right: 311, left: 312};

describe('spreadPageToShow', () => {
  it('a jump to an even page keeps that page, not the facing odd one', () => {
    expect(spreadPageToShow(tahaSpread, 250, 312)).toBe(312);
  });

  it('a jump to an odd page keeps that page', () => {
    expect(spreadPageToShow(tahaSpread, 250, 311)).toBe(311);
  });

  it('ignores a jump target the spread does not hold', () => {
    expect(spreadPageToShow(tahaSpread, 312, 40)).toBe(312);
    expect(spreadPageToShow(tahaSpread, 250, 40)).toBe(311);
  });

  it('keeps the page already being read when the spread holds it', () => {
    expect(spreadPageToShow({right: 1, left: 2}, 2, null)).toBe(2);
  });

  it('falls back to the spread first page when swiping to a new spread', () => {
    expect(spreadPageToShow({right: 313, left: 314}, 312, null)).toBe(313);
  });

  it('handles a spread with no left page', () => {
    expect(spreadPageToShow({right: 605, left: null}, 604, null)).toBe(605);
  });
});

describe('sameSpread', () => {
  it('pairs each odd page with the even page after it', () => {
    expect(sameSpread(312, 311)).toBe(true);
    expect(sameSpread(311, 312)).toBe(true);
    expect(sameSpread(313, 312)).toBe(false);
    expect(sameSpread(1, 2)).toBe(true);
    expect(sameSpread(604, 603)).toBe(true);
  });
});
