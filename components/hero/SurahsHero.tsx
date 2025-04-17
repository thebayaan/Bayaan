import React, {useMemo} from 'react';
import {View, useWindowDimensions} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Surah} from '@/data/surahData';
import {SurahHeroSection} from '@/components/hero/SurahHeroSection';
import {BrowseAllHeroSection} from '@/components/hero/BrowseAllHeroSection';
import {getRandomColors} from '@/utils/gradientColors';
import Color from 'color';
import {HeroSection} from './HeroSection';

interface SurahsHeroProps {
  surahOfTheDay: Surah;
  onSurahPress: (surah: Surah) => void;
}

// Same SECTION_HEIGHT as ScrollingHero for consistency
const SECTION_HEIGHT = moderateScale(150);

// Custom function to create subtler gradient colors for both light and dark modes
function createSubtleGradientColors(
  baseColors: readonly [string, string, string],
  isDarkMode: boolean,
): [string, string, string] {
  const alpha1 = isDarkMode ? 0.4 : 0.3;
  const alpha2 = isDarkMode ? 0.25 : 0.2;
  const alpha3 = isDarkMode ? 0.15 : 0.1;

  return [
    Color(baseColors[0]).alpha(alpha1).toString(),
    Color(baseColors[1]).alpha(alpha2).toString(),
    Color(baseColors[2]).alpha(alpha3).toString(),
  ];
}

/**
 * The main hero component for the SurahsView.
 * Includes SurahHeroSection, BrowseAllHeroSection, and RandomRecitationHero
 * with standardized spacing.
 */
export function SurahsHero({surahOfTheDay, onSurahPress}: SurahsHeroProps) {
  const {width: windowWidth} = useWindowDimensions();
  const {theme} = useTheme();

  // Generate shared gradient colors for both hero sections
  const sharedColorsBase = useMemo(() => getRandomColors(), []);

  // Create themed gradient colors for each section
  const surahHeroColors = useMemo(
    () => createSubtleGradientColors(sharedColorsBase, theme.isDarkMode),
    [sharedColorsBase, theme.isDarkMode],
  );

  const browseAllColors = useMemo(() => {
    // Use a slight variation of the same colors for the browse all section
    const shiftedColors = sharedColorsBase.map(colorStr => {
      const color = Color(colorStr);
      return color.rotate(30).hex(); // Rotate hue by 30 degrees
    }) as [string, string, string];

    return createSubtleGradientColors(shiftedColors, theme.isDarkMode);
  }, [sharedColorsBase, theme.isDarkMode]);

  // Calculate item dimensions based on screen width
  const heroGridDimensions = useMemo(() => {
    const horizontalPadding = moderateScale(16);
    const gapBetweenItems = moderateScale(16);
    const availableWidth =
      windowWidth - horizontalPadding * 2 - gapBetweenItems;
    const itemWidth = availableWidth / 2;

    return {
      width: itemWidth,
      gap: gapBetweenItems,
      paddingHorizontal: horizontalPadding,
    };
  }, [windowWidth]);

  // Create card style based on calculated dimensions
  const cardStyle = useMemo(() => {
    return {
      width: heroGridDimensions.width,
      height: SECTION_HEIGHT, // Same height as ScrollingHero
    };
  }, [heroGridDimensions.width]);
  
  const handleSurahPress = useMemo(() => {
    return (surah: Surah) => onSurahPress(surah);
  }, [onSurahPress]);

  return (
    <HeroSection
      mainHero={
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            paddingHorizontal: heroGridDimensions.paddingHorizontal,
            gap: heroGridDimensions.gap,
          }}>
          <SurahHeroSection
            surah={surahOfTheDay}
            onPress={handleSurahPress}
            isCompact={true}
            style={cardStyle}
            gradientColors={surahHeroColors}
          />
          <BrowseAllHeroSection
            isCompact={true}
            style={cardStyle}
            gradientColors={browseAllColors}
          />
        </View>
      }
    />
  );
} 