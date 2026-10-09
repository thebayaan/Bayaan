// @ai-generated
/**
 * A page canvas keeps room below its last line for the marks that hang under
 * it (open tanween, a small low meem, a deep tail). The worst cases measured
 * on CanvasKit over every page's last ayah line: 4.4 pt past the content on an
 * iPhone 17 Pro (font 20.4 pt) and 11.2 pt on an iPhone SE-class screen (font
 * 19.4 pt). Page 525 also ends on a surah header frame, which needs ~2 pt.
 */

import {canvasBottomOverflow} from '../constants';

describe('canvasBottomOverflow', () => {
  it('covers the deepest marks measured under a last line', () => {
    expect(canvasBottomOverflow(20.4)).toBeGreaterThanOrEqual(4.4);
    expect(canvasBottomOverflow(19.4)).toBeGreaterThanOrEqual(11.2);
  });

  it('scales with the font and stays whole points', () => {
    expect(canvasBottomOverflow(20.4)).toBe(21);
    expect(canvasBottomOverflow(30)).toBe(30);
  });
});
