import Color from 'color';
import {Theme} from './themeUtils';

export interface PlayerColors {
  primary: string;
  secondary: string;
  text: string;
  gradient: string[];
  gradientStart: string;
  gradientMiddle: string;
  gradientEnd: string;
}

export interface CachedReciterColors {
  primary: string;
  secondary: string;
  timestamp: number;
}

// Cache duration: 24 hours
export const CACHE_DURATION = 24 * 60 * 60 * 1000;

export const calculateContrastColor = (backgroundColor: string): string => {
  try {
    const bgColor = Color(backgroundColor);
    return bgColor.isLight() ? '#000000' : '#FFFFFF';
  } catch (error) {
    console.warn('Error calculating contrast color:', error);
    return '#FFFFFF';
  }
};

export const calculateGradient = (
  primary: string,
  secondary: string,
  isDarkMode: boolean,
): string[] => {
  try {
    const baseColor = primary;
    const targetColor = secondary;

    const startColor = Color(baseColor)
      .mix(Color(isDarkMode ? targetColor : targetColor), 0.1)
      .rgb()
      .string();

    const endColor = Color(startColor)
      .mix(Color(isDarkMode ? targetColor : targetColor), 0.75)
      .rgb()
      .string();

    return [startColor, endColor];
  } catch (error) {
    console.warn('Error calculating gradient:', error);
    return [primary, secondary];
  }
};

export const ensureMinBrightness = (
  colorStr: string,
  minBrightness = 0.1,
): string => {
  try {
    const color = Color(colorStr);
    return color.luminosity() < minBrightness ? '#121212' : colorStr;
  } catch (error) {
    console.warn('Error ensuring min brightness:', error);
    return colorStr;
  }
};

export const calculatePlayerColors = (
  primary: string,
  secondary: string,
  theme: Theme,
  isDarkMode: boolean,
): PlayerColors => {
  const safeColors = {
    primary: ensureMinBrightness(primary),
    secondary: ensureMinBrightness(secondary),
  };

  const gradient = calculateGradient(
    safeColors.primary,
    safeColors.secondary,
    isDarkMode,
  );

  return {
    primary: safeColors.primary,
    secondary: safeColors.secondary,
    text: calculateContrastColor(safeColors.primary),
    gradient,
    gradientStart: gradient[0],
    gradientMiddle: gradient[1],
    gradientEnd: gradient[1],
  };
};
