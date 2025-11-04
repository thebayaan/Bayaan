import React from 'react';
import {View, TouchableOpacity, Text} from 'react-native';
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
          size={isFavoriteReciter ? moderateScale(40) : moderateScale(28)}
          filled={isFavoriteReciter}
        />
      </AnimatedTouchableOpacity>
      <View style={styles.rightAlignedButtons}>
        <AnimatedTouchableOpacity
          activeOpacity={0.7}
          style={[styles.shuffleButton, shuffleAnimatedStyle]}
          onPress={onShufflePress}
          onPressIn={() => handlePressIn('shuffle')}
          onPressOut={() => handlePressOut('shuffle')}>
          <ShuffleIcon color={theme.colors.text} size={moderateScale(22)} />
          <Text style={styles.buttonText}>Shuffle</Text>
        </AnimatedTouchableOpacity>
        <AnimatedTouchableOpacity
          activeOpacity={0.7}
          style={[styles.playButton, playAnimatedStyle]}
          onPress={onPlayPress}
          onPressIn={() => handlePressIn('play')}
          onPressOut={() => handlePressOut('play')}>
          <PlayIcon color={theme.colors.text} size={moderateScale(18)} />
          <Text style={styles.playButtonText}>Play All</Text>
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
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(5),
    },
    rightAlignedButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(10),
    },
    favoriteButton: {
      width: moderateScale(50),
      height: moderateScale(50),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(25),
      backgroundColor: 'transparent',
    },
    favoriteButtonActive: {
      backgroundColor: theme.colors.card,
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    shuffleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(8),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      gap: moderateScale(8),
    },
    playButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(8),
      paddingHorizontal: moderateScale(16),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
      gap: moderateScale(8),
    },
    buttonText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
    },
    playButtonText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
  });
