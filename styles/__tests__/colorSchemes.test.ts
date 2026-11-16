// @ai-start
import Color from 'color';
import {darkColors, lightColors} from '@/styles/colorSchemes';

// textTertiary is the color of captions, section labels and helper text.
// WCAG asks for 4.5:1 for text of this size. The text sits on the screen
// background and on cards that tint the background with theme.colors.text
// at 4 to 8 % alpha (8 % is a selected card).
const WCAG_AA_TEXT = 4.5;
const CARD_TINTS = [0.04, 0.06, 0.08];

type Colors = typeof lightColors;

const surfacesOf = (colors: Colors): [string, string][] => [
  ['background', colors.background],
  ['backgroundSecondary', colors.backgroundSecondary],
  ['card', colors.card],
  ...CARD_TINTS.map((alpha): [string, string] => [
    `text at ${alpha} over background`,
    Color(colors.background).mix(Color(colors.text), alpha).hex(),
  ]),
];

const contrast = (a: string, b: string) => Color(a).contrast(Color(b));

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('%s textTertiary', (_scheme, colors) => {
  it.each(surfacesOf(colors))('is 4.5:1 or more on %s', (_name, surface) => {
    expect(contrast(colors.textTertiary, surface)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
  });

  it('is lighter than textSecondary on the background', () => {
    expect(contrast(colors.textTertiary, colors.background)).toBeLessThan(
      contrast(colors.textSecondary, colors.background),
    );
  });
});
// @ai-end
