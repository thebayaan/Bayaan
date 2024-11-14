import Color from 'color';
import {Theme} from '@/utils/themeUtils';

export const getGradientColors = (
  baseColor: string,
  theme: Theme,
  isDarkMode: boolean,
) => {
  const DARKEST_COLOR = theme.colors.background;
  const LIGHTEST_COLOR = theme.colors.background;

  const startColor = Color(baseColor)
    .mix(
      Color(isDarkMode ? DARKEST_COLOR : LIGHTEST_COLOR),
      isDarkMode ? 0.75 : 0.75,
    )
    .rgb()
    .string();

  const endColor = Color(startColor)
    .mix(
      Color(isDarkMode ? DARKEST_COLOR : LIGHTEST_COLOR),
      isDarkMode ? 0.899 : 0.999,
    )
    .rgb()
    .string();

  return [startColor, endColor];
};
