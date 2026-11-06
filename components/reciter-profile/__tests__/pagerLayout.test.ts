// @ai-generated
import {hasPagerReachedInitialPage} from '../utils/pagerLayout';

describe('hasPagerReachedInitialPage', () => {
  it.each([2.625, 2.75])(
    'reveals a single-rewayat pager at Android pixel ratio %s',
    pixelRatio => {
      const pageWidth = 1080 / pixelRatio;
      const contentWidth = Math.fround(pageWidth * 2);

      expect(contentWidth).toBeLessThan(pageWidth * 2);
      expect(
        hasPagerReachedInitialPage(contentWidth, pageWidth, 1, pixelRatio),
      ).toBe(true);
    },
  );

  it('reveals the last rewayat when navigation selects a later tab', () => {
    const pixelRatio = 2.625;
    const pageWidth = 1080 / pixelRatio;
    const contentWidth = Math.fround(pageWidth * 4);

    expect(contentWidth).toBeLessThan(pageWidth * 4);
    expect(
      hasPagerReachedInitialPage(contentWidth, pageWidth, 3, pixelRatio),
    ).toBe(true);
  });

  it('reveals a pager with integral iOS page widths', () => {
    expect(hasPagerReachedInitialPage(780, 390, 1, 3)).toBe(true);
  });

  it('keeps waiting when the initial page has not been laid out', () => {
    const pixelRatio = 2.625;
    const pageWidth = 1080 / pixelRatio;

    expect(
      hasPagerReachedInitialPage(pageWidth, pageWidth, 1, pixelRatio),
    ).toBe(false);
    expect(hasPagerReachedInitialPage(0, pageWidth, 1, pixelRatio)).toBe(false);
  });

  it('keeps waiting when content is still one physical pixel short', () => {
    const pixelRatio = 2.625;
    const pageWidth = 1080 / pixelRatio;
    const contentWidth = Math.fround((1080 * 2 - 1) / pixelRatio);

    expect(
      hasPagerReachedInitialPage(contentWidth, pageWidth, 1, pixelRatio),
    ).toBe(false);
  });
});
