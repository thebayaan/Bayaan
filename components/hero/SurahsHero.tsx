import React, {useCallback, useMemo} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Surah} from '@/data/surahData';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {LinearGradient} from 'expo-linear-gradient';
import {MakkahIcon, MadinahIcon} from '@/components/Icons';
import {getRandomColors, getThemedGradientColors} from '@/utils/gradientColors';
import {BrowseAllHeroSection} from '@/components/hero/BrowseAllHeroSection';
import Color from 'color';
import {HeroSection} from './HeroSection';

// Create the AnimatedTouchableOpacity component once, outside of render functions
const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

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

interface SurahHeroSectionProps {
  surah: Surah;
  onPress: (surah: Surah) => void;
  title?: string;
  isCompact?: boolean;
  style?: ViewStyle | ViewStyle[];
  gradientColors?: string[];
}

/**
 * Individual Surah hero section component that displays surah information
 * with animation and gradient background.
 */
export const SurahHeroSection = ({
  surah,
  onPress,
  title = 'SURAH OF THE DAY',
  style,
  gradientColors,
}: SurahHeroSectionProps) => {
  const {theme} = useTheme();
  const handlePress = useCallback(() => onPress(surah), [surah, onPress]);

  // Animation values
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{scale: scale.value}],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.97, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  // Use provided gradientColors if available, otherwise generate them
  const colors = useMemo(() => {
    if (gradientColors && gradientColors.length >= 2) {
      return gradientColors as [string, string, ...string[]];
    }
    const randomColors = getRandomColors(surah.id);
    return getThemedGradientColors(randomColors, theme.isDarkMode);
  }, [gradientColors, theme.isDarkMode, surah.id]);

  // Use the styles
  const styles = useMemo(() => createStyles(theme), [theme]);

  const revelationPlace = surah.revelation_place.toLowerCase();

  return (
    <AnimatedTouchableOpacity
      activeOpacity={1}
      style={[styles.hero, animatedStyle, style]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <LinearGradient
        colors={colors}
        start={{x: 0, y: 0.8}}
        end={{x: 1, y: 0.2}}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <View style={styles.topSection}>
          <View style={styles.topRow}>
            <Text style={styles.heroTitle}>{title}</Text>
            <View style={styles.revelationPlace}>
              {revelationPlace === 'makkah' ? (
                <MakkahIcon
                  size={moderateScale(20)}
                  color={theme.colors.text}
                  secondaryColor={theme.colors.background}
                />
              ) : (
                <MadinahIcon
                  size={moderateScale(12)}
                  color={theme.colors.text}
                />
              )}
            </View>
          </View>
          <Text style={styles.heroGlyph}>{surahGlyphMap[surah.id]}</Text>
        </View>
        <View style={styles.bottomSection}>
          <Text style={styles.heroSurahName}>{surah.name}</Text>
          <Text style={styles.translatedName}>
            {surah.translated_name_english}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{surah.verses_count}</Text>
              <Text style={styles.statLabel}>Verses</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{surah.id}</Text>
              <Text style={styles.statLabel}>Number</Text>
            </View>
          </View>
        </View>
      </View>
    </AnimatedTouchableOpacity>
  );
};

// Styles for the SurahHeroSection component
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    hero: {
      borderRadius: moderateScale(20),
      overflow: 'hidden',
      flex: 1,
    },
    content: {
      padding: moderateScale(10),
      flexDirection: 'column',
      flex: 1,
    },
    topSection: {
      marginBottom: moderateScale(6),
      alignItems: 'center',
    },
    bottomSection: {
      alignItems: 'center',
    },
    heroGlyph: {
      fontSize: moderateScale(36),
      fontFamily: 'SurahNames',
      color: theme.colors.text,
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 4,
      textAlign: 'center',
      marginTop: moderateScale(2),
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginBottom: moderateScale(2),
    },
    heroTitle: {
      fontSize: moderateScale(8),
      fontFamily: 'Manrope-Bold',
      letterSpacing: moderateScale(0.5),
      color: theme.colors.textSecondary,
    },
    revelationPlace: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroSurahName: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: moderateScale(1),
      textAlign: 'center',
    },
    translatedName: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(6),
      textAlign: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      gap: moderateScale(16),
      justifyContent: 'center',
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statValue: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginRight: moderateScale(4),
    },
    statLabel: {
      fontSize: moderateScale(8),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
    },
  });

interface SurahsHeroProps {
  surahOfTheDay: Surah;
  onSurahPress: (surah: Surah) => void;
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
