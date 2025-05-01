import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {StarIcon, PlayIcon, ShuffleIcon} from '@/components/Icons';
import {ActionButtonsProps} from '@/components/reciter-profile/types';
import Color from 'color';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

// Animated TouchableOpacity for button animations
const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

/**
 * ActionButtons component for the ReciterProfile
 *
 * This component displays the favorite, shuffle, and play buttons
 * for controlling reciter playback and favorites.
 *
 * @component
 */
export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onFavoritePress,
  onShufflePress,
  onPlayPress,
  isFavoriteReciter,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  // Animation values for button press feedback
  const favoriteScale = useSharedValue(1);
  const shuffleScale = useSharedValue(1);
  const playScale = useSharedValue(1);

  const favoriteAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: favoriteScale.value}],
  }));

  const shuffleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: shuffleScale.value}],
  }));

  const playAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: playScale.value}],
  }));

  const handlePressIn = (button: 'favorite' | 'shuffle' | 'play') => {
    const scale =
      button === 'favorite'
        ? favoriteScale
        : button === 'shuffle'
          ? shuffleScale
          : playScale;

    scale.value = withSpring(0.92, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = (button: 'favorite' | 'shuffle' | 'play') => {
    const scale =
      button === 'favorite'
        ? favoriteScale
        : button === 'shuffle'
          ? shuffleScale
          : playScale;

    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  return (
    <View style={styles.actionButtons}>
      <AnimatedTouchableOpacity
        activeOpacity={0.7}
        style={[styles.favoriteButton, favoriteAnimatedStyle]}
        onPress={onFavoritePress}
        onPressIn={() => handlePressIn('favorite')}
        onPressOut={() => handlePressOut('favorite')}>
        <StarIcon
          color={
            isFavoriteReciter
              ? theme.colors.primary
              : theme.colors.textSecondary
          }
          size={moderateScale(18)}
          filled={isFavoriteReciter}
        />
      </AnimatedTouchableOpacity>
      <View style={styles.rightAlignedButtons}>
        <AnimatedTouchableOpacity
          activeOpacity={0.7}
          style={[styles.circleButton, shuffleAnimatedStyle]}
          onPress={onShufflePress}
          onPressIn={() => handlePressIn('shuffle')}
          onPressOut={() => handlePressOut('shuffle')}>
          <ShuffleIcon color={theme.colors.text} size={moderateScale(20)} />
        </AnimatedTouchableOpacity>
        <AnimatedTouchableOpacity
          activeOpacity={0.7}
          style={[styles.circleButton, styles.playButton, playAnimatedStyle]}
          onPress={onPlayPress}
          onPressIn={() => handlePressIn('play')}
          onPressOut={() => handlePressOut('play')}>
          <View style={styles.playIconContainer}>
            <PlayIcon color={theme.colors.text} size={moderateScale(16)} />
          </View>
        </AnimatedTouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(5),
    },
    rightAlignedButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
    },
    favoriteButton: {
      width: moderateScale(40),
      height: moderateScale(40),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
      padding: moderateScale(8),
    },
    circleButton: {
      width: moderateScale(40),
      height: moderateScale(40),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
      padding: moderateScale(8),
    },
    playButton: {
      // Slightly larger to emphasize it's the primary action
      width: moderateScale(42),
      height: moderateScale(42),
    },
    playIconContainer: {
      paddingLeft: moderateScale(2), // Slight adjustment to center the play icon visually
    },
  });
