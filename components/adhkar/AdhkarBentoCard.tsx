import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Image} from 'expo-image';
import {moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {SuperCategory} from '@/types/adhkar';
import {ADHKAR_CATEGORY_IMAGES} from '@/constants/adhkarImages';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

const TEXT_POSITION: Record<string, 'top' | 'bottom' | 'center'> = {
  // Main adhkar
  'morning-adhkar': 'top',
  'evening-adhkar': 'bottom',
  salah: 'top',
  'before-sleep': 'top',
  'after-salah': 'top',
  'waking-up': 'top',
  salawat: 'top',
  'praises-of-allah': 'top',
  istighfar: 'top',
  nightmares: 'top',
  'protection-of-iman': 'center',
  'difficulties-happiness': 'top',
  'quranic-duas': 'top',
  // Other adhkar
  'names-of-allah': 'top',
  clothes: 'center',
  'lavatory-wudu': 'bottom',
  'adhan-masjid': 'top',
  home: 'top',
  istikharah: 'top',
  gatherings: 'top',
  'food-drink': 'top',
  travel: 'top',
  nature: 'top',
  'social-interactions': 'top',
  'hajj-umrah': 'top',
  'marriage-children': 'top',
  death: 'bottom',
  'ruqyah-illness': 'top',
  'money-shopping': 'top',
};

interface AdhkarBentoCardProps {
  category: SuperCategory;
  onPress: () => void;
  width: number;
  height: number;
}

export const AdhkarBentoCard = React.memo(function AdhkarBentoCard({
  category,
  onPress,
  width,
  height,
}: AdhkarBentoCardProps) {
  const {theme} = useTheme();
  const isDarkMode = theme.isDarkMode;

  // Bouncy scale animation
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, {
      damping: 20,
      stiffness: 400,
      mass: 0.5,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 20,
      stiffness: 400,
      mass: 0.5,
    });
  };

  // Subtle gradient incorporating the category's color (same pattern as ExploreView)
  const baseColor = Color(category.color);
  const gradientColors = [
    baseColor.alpha(0.15).toString(),
    baseColor.alpha(0.25).toString(),
  ] as const;

  const titleSize = moderateScale(14);
  const textPosition = TEXT_POSITION[category.id];

  const styles = createStyles(theme, width, height);

  const imageSet = ADHKAR_CATEGORY_IMAGES[category.id];

  return (
    <AnimatedTouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, animatedStyle]}>
      {imageSet ? (
        <View style={styles.gradient}>
          <Image
            source={isDarkMode ? imageSet.dark : imageSet.light}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          {isDarkMode && (
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)']}
              start={{x: 0, y: 0.3}}
              end={{x: 0, y: 1}}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.content}>
            <View
              style={[
                styles.textContainer,
                textPosition === 'top'
                  ? styles.topLeftContainer
                  : textPosition === 'bottom'
                    ? styles.bottomLeftContainer
                    : styles.centerLeftContainer,
              ]}>
              <Text
                style={[styles.title, {fontSize: titleSize}]}
                numberOfLines={2}>
                {category.title}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={gradientColors}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.gradient}>
          <View style={styles.content}>
            <View
              style={[
                styles.textContainer,
                textPosition === 'top'
                  ? styles.topLeftContainer
                  : textPosition === 'bottom'
                    ? styles.bottomLeftContainer
                    : styles.centerLeftContainer,
              ]}>
              <Text
                style={[styles.title, {fontSize: titleSize}]}
                numberOfLines={2}>
                {category.title}
              </Text>
            </View>
          </View>
        </LinearGradient>
      )}
    </AnimatedTouchableOpacity>
  );
});

const createStyles = (
  theme: ReturnType<typeof useTheme>['theme'],
  width: number,
  height: number,
) =>
  StyleSheet.create({
    container: {
      width,
      height,
      borderRadius: moderateScale(20),
      overflow: 'hidden',
    },
    gradient: {
      flex: 1,
      padding: moderateScale(16),
    },
    content: {
      flex: 1,
      justifyContent: 'center',
    },
    textContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    centerLeftContainer: {
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    topLeftContainer: {
      justifyContent: 'flex-start',
    },
    bottomLeftContainer: {
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
    },
    title: {
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      lineHeight: moderateScale(22),
      textAlign: 'left',
    },
  });

export default AdhkarBentoCard;
