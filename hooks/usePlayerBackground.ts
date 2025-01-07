import {useMemo} from 'react';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';

export const usePlayerBackground = (theme: Theme, isDarkMode: boolean) => {
  const gradientColors = useMemo(() => {
    const baseColor = theme.colors.primary;
    const DARKEST_COLOR = theme.colors.card;
    const LIGHTEST_COLOR = theme.colors.card;

    const startColor = Color(baseColor)
      .mix(Color(isDarkMode ? DARKEST_COLOR : LIGHTEST_COLOR), 0.75)
      .rgb()
      .string();

    const endColor = Color(startColor)
      .mix(Color(isDarkMode ? DARKEST_COLOR : LIGHTEST_COLOR), 0.899)
      .rgb()
      .string();

    return [startColor, endColor];
  }, [theme, isDarkMode]);

  return {gradientColors};
};
