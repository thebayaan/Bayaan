import React, {useMemo} from 'react';
import {ViewStyle} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {Surah} from '@/data/surahData';
import {SurahHeroSection} from '@/components/hero/SurahsHero';
import {getRandomColors} from '@/utils/gradientColors';
import Color from 'color';

interface SurahOfTheDayProps {
  surah: Surah;
  onPress: (surah: Surah) => void;
  style?: ViewStyle | ViewStyle[];
}

/**
 * A component that displays the Surah of the Day card
 * with standardized styling and animations.
 */
export function SurahOfTheDay({surah, onPress, style}: SurahOfTheDayProps) {
  const {theme} = useTheme();

  // Generate gradient colors
  const baseColors = useMemo(() => getRandomColors(), []);
  const gradientColors = useMemo(() => {
    // Use the same alpha values as in SurahsHero
    const alpha1 = theme.isDarkMode ? 0.4 : 0.3;
    const alpha2 = theme.isDarkMode ? 0.25 : 0.2;
    const alpha3 = theme.isDarkMode ? 0.15 : 0.1;

    return [
      Color(baseColors[0]).alpha(alpha1).toString(),
      Color(baseColors[1]).alpha(alpha2).toString(),
      Color(baseColors[2]).alpha(alpha3).toString(),
    ] as [string, string, string];
  }, [baseColors, theme.isDarkMode]);

  return (
    <SurahHeroSection
      surah={surah}
      onPress={onPress}
      title="SURAH OF THE DAY"
      isCompact={true}
      style={style}
      gradientColors={gradientColors}
    />
  );
}
