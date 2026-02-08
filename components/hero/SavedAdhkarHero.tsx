import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {getRandomColors} from '@/utils/gradientColors';
import Color from 'color';
import {HeroSection} from './HeroSection';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

// Match SurahsHero height
const SECTION_HEIGHT = moderateScale(150);

interface SavedAdhkarCardProps {
  savedCount: number;
  onPress: () => void;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Card component for saved adhkar hero section
 * Matches the SurahHeroSection design pattern exactly
 */
const SavedAdhkarCard = ({
  savedCount,
  onPress,
  style,
}: SavedAdhkarCardProps) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

  // Generate gradient colors - same pattern as SurahOfTheDay
  const gradientColors = useMemo(() => {
    const baseColors = getRandomColors(42); // Fixed seed for consistent saved color
    const alpha1 = theme.isDarkMode ? 0.4 : 0.3;
    const alpha2 = theme.isDarkMode ? 0.25 : 0.2;
    const alpha3 = theme.isDarkMode ? 0.15 : 0.1;

    return [
      Color(baseColors[0]).alpha(alpha1).toString(),
      Color(baseColors[1]).alpha(alpha2).toString(),
      Color(baseColors[2]).alpha(alpha3).toString(),
    ] as [string, string, string];
  }, [theme.isDarkMode]);

  return (
    <AnimatedTouchableOpacity
      activeOpacity={1}
      style={[styles.hero, animatedStyle, style]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <LinearGradient
        colors={gradientColors}
        start={{x: 0, y: 0.8}}
        end={{x: 1, y: 0.2}}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {/* Top section - matching SurahHeroSection layout exactly */}
        <View style={styles.topSection}>
          <View style={styles.topRow}>
            <Text style={styles.heroTitle}>
              {' '}
              {savedCount === 1 ? 'SAVED DHIKR' : 'SAVED ADHKAR'}
            </Text>
            <View style={styles.iconContainer}>
              <Ionicons
                name="bookmark"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
            </View>
          </View>
          {/* Count number - positioned exactly where heroGlyph is */}
          <Text style={styles.heroGlyph}>{savedCount}</Text>
        </View>

        {/* Bottom section - matching SurahHeroSection layout exactly */}
        <View style={styles.bottomSection}>
          <Text style={styles.heroSurahName}> Saved </Text>
          <Text style={styles.translatedName}>Your collection</Text>
        </View>
      </View>
    </AnimatedTouchableOpacity>
  );
};

// Styles matching SurahHeroSection exactly
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
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginBottom: moderateScale(2),
    },
    heroTitle: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Bold',
      letterSpacing: moderateScale(0.8),
      color: theme.colors.textSecondary,
    },
    iconContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroGlyph: {
      fontSize: moderateScale(30),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 4,
      textAlign: 'center',
      marginTop: moderateScale(2),
    },
    bottomSection: {
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
  });

interface SavedAdhkarHeroProps {
  savedCount: number;
  onPress: () => void;
}

/**
 * Hero section for saved adhkar in AdhkarView
 * Only renders when there are saved adhkar
 */
export function SavedAdhkarHero({savedCount, onPress}: SavedAdhkarHeroProps) {
  const cardStyle: ViewStyle = useMemo(() => {
    return {
      width: '100%' as const,
      height: SECTION_HEIGHT,
    };
  }, []);

  // Don't render if no saved adhkar
  if (savedCount === 0) {
    return null;
  }

  return (
    <HeroSection
      mainHero={
        <View style={{paddingHorizontal: moderateScale(16)}}>
          <SavedAdhkarCard
            savedCount={savedCount}
            onPress={onPress}
            style={cardStyle}
          />
        </View>
      }
      randomHero={false}
    />
  );
}
