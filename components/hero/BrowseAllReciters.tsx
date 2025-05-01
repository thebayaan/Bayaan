import React, {useMemo} from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {LinearGradient} from 'expo-linear-gradient';
import {MushafiIcon} from '@/components/Icons';
import {Surah} from '@/data/surahData';
import {Theme} from '@/utils/themeUtils';
import {getRandomColors, getThemedGradientColors} from '@/utils/gradientColors';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {useRouter} from 'expo-router';

// Create animated TouchableOpacity
const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

interface BrowseAllHeroSectionProps {
  onPress?: (surah: Surah) => void; // Make onPress optional
  isCompact?: boolean;
  style?: ViewStyle | ViewStyle[]; // Use ViewStyle or an array of styles
  gradientColors?: string[];
}

export const BrowseAllHeroSection: React.FC<BrowseAllHeroSectionProps> =
  React.memo(({onPress, isCompact = false, style, gradientColors}) => {
    const {theme} = useTheme();
    const router = useRouter(); // Get the router for navigation
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

    // Use provided gradientColors if available, otherwise generate them
    const colors = useMemo(() => {
      if (gradientColors && gradientColors.length >= 2) {
        return gradientColors as [string, string, ...string[]];
      }
      // Generate gradient colors - use a fixed seed value for consistency
      const randomColors = getRandomColors(999); // Using a unique ID (999) for consistent colors
      return getThemedGradientColors(randomColors, theme.isDarkMode);
    }, [gradientColors, theme.isDarkMode]);

    const handlePress = () => {
      // Navigate to the browse-all-surahs screen
      router.push('/(tabs)/(a.home)/browse-all-surahs');

      // Still call the onPress prop if it exists (for backward compatibility)
      if (onPress) {
        onPress({
          id: 0,
          name: 'All Surahs',
          revelation_place: 'Meccan',
          revelation_order: 0,
          bismillah_pre: false,
          name_arabic: 'جميع السور',
          verses_count: 0,
          pages: '0-0',
          translated_name_english: 'All Surahs',
        });
      }
    };

    return (
      <AnimatedTouchableOpacity
        style={[styles.container, animatedStyle, style]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}>
        <LinearGradient
          colors={colors}
          style={styles.gradient}
          start={{x: 0, y: 0.8}}
          end={{x: 1, y: 0.2}}>
          <View style={styles.iconContainer}>
            <MushafiIcon
              size={moderateScale(isCompact ? 32 : 40)}
              color={theme.colors.text}
            />
          </View>
          <Text style={styles.title}>All Surahs</Text>
          <Text style={styles.subtitle}>Browse all 114 surahs</Text>
        </LinearGradient>
      </AnimatedTouchableOpacity>
    );
  });

BrowseAllHeroSection.displayName = 'BrowseAllHeroSection';

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      borderRadius: moderateScale(20),
      overflow: 'hidden',
      flex: 1,
    },
    gradient: {
      padding: moderateScale(10),
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    iconContainer: {
      marginBottom: verticalScale(8),
    },
    title: {
      fontSize: moderateScale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: verticalScale(4),
      textAlign: 'center',
    },
    subtitle: {
      fontSize: moderateScale(11),
      color: theme.colors.textSecondary,
      opacity: 0.9,
      textAlign: 'center',
    },
  });
}
