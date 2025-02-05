import {useMemo} from 'react';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {useImageColors} from './useImageColors';
import {usePlayerStore} from '@/store/playerStore';

export const usePlayerBackground = (theme: Theme, isDarkMode: boolean) => {
  const currentTrack = usePlayerStore(state => state.currentTrack);

  const extractedColors = useImageColors(currentTrack?.reciterName);

  const gradientColors = useMemo(() => {
    const baseColor = extractedColors.secondary;
    const DARKEST_COLOR = extractedColors.primary;
    const LIGHTEST_COLOR = extractedColors.primary;

    const startColor = Color(baseColor)
      .mix(Color(isDarkMode ? DARKEST_COLOR : LIGHTEST_COLOR), 0.1)
      .rgb()
      .string();

    const endColor = Color(startColor)
      .mix(Color(isDarkMode ? DARKEST_COLOR : LIGHTEST_COLOR), 0.75)
      .rgb()
      .string();

    const colors = [startColor, endColor];
    return colors;
  }, [extractedColors.primary, isDarkMode, extractedColors.secondary]);

  return {
    gradientColors,
    extractedColors,
    isLoading:
      !extractedColors.primary || extractedColors.primary === theme.colors.card,
  };
};
