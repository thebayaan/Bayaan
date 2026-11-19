import Color from 'color';
import {primaryColors, type PrimaryColor} from '@/styles/colorSchemes';
import {
  createTheme,
  overBackground,
  readableAccent,
  type Theme,
} from '@/utils/themeUtils';

// WCAG AA for text under 18pt (ipad-standards §12).
const WCAG_AA_TEXT = 4.5;
const ACCENTS = Object.keys(primaryColors) as PrimaryColor[];

/** The sheet, its 4% and 6% text fills, and a 7% accent tint. */
const surfacesOf = (theme: Theme): string[] => [
  theme.colors.background,
  overBackground(theme, theme.colors.text, 0.04),
  overBackground(theme, theme.colors.text, 0.06),
  overBackground(theme, theme.colors.primary, 0.07),
];

const contrast = (a: string, b: string) => Color(a).contrast(Color(b));

describe.each(['light', 'dark'] as const)('readableAccent, %s', scheme => {
  it.each(ACCENTS)('reads at 4.5:1 or more with the %s accent', accent => {
    const theme = createTheme(scheme, accent);
    const surfaces = surfacesOf(theme);
    const color = readableAccent(theme, surfaces);
    for (const surface of surfaces) {
      expect(contrast(color, surface)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
  });
});

describe('readableAccent', () => {
  it('keeps an accent that reads already', () => {
    const theme = createTheme('light', 'Purple');
    expect(readableAccent(theme)).toBe(primaryColors.Purple);
  });

  it('moves a light accent toward the text colour on the light background', () => {
    // The default Blue is about 2.8:1 on the light background.
    const theme = createTheme('light', 'Blue');
    expect(contrast(primaryColors.Blue, theme.colors.background)).toBeLessThan(
      WCAG_AA_TEXT,
    );
    const color = readableAccent(theme);
    expect(contrast(color, theme.colors.background)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
    expect(Color(color).luminosity()).toBeLessThan(
      Color(primaryColors.Blue).luminosity(),
    );
  });

  it('takes a lower minimum, as an icon needs (3:1)', () => {
    const theme = createTheme('dark', 'Purple');
    const icon = readableAccent(theme, [theme.colors.background], 3);
    const text = readableAccent(theme, [theme.colors.background]);
    expect(contrast(icon, theme.colors.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(icon, theme.colors.background)).toBeLessThanOrEqual(
      contrast(text, theme.colors.background),
    );
  });
});

describe('overBackground', () => {
  it('is the opaque colour of a colour at an alpha over the background', () => {
    const theme = createTheme('light', 'Blue');
    expect(overBackground(theme, theme.colors.text, 0)).toBe(
      Color(theme.colors.background).hex(),
    );
    expect(overBackground(theme, theme.colors.text, 1)).toBe(
      Color(theme.colors.text).hex(),
    );
  });
});
