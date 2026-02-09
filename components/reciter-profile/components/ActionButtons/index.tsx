import React from 'react';
import {View, Pressable} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {PlayIcon, ShuffleIcon} from '@/components/Icons';
import {ActionButtonsProps} from '@/components/reciter-profile/types';
import Color from 'color';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import {Ionicons} from '@expo/vector-icons';

const GOLD_COLOR = '#FFD700';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onFavoritePress,
  onShufflePress,
  onPlayPress,
  isFavoriteReciter,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

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
      <AnimatedPressable
        style={[styles.circleButton, favoriteAnimatedStyle]}
        onPress={onFavoritePress}
        onPressIn={() => handlePressIn('favorite')}
        onPressOut={() => handlePressOut('favorite')}>
        <Ionicons
          name={isFavoriteReciter ? 'star' : 'star-outline'}
          size={moderateScale(20)}
          color={isFavoriteReciter ? GOLD_COLOR : theme.colors.textSecondary}
        />
      </AnimatedPressable>
      <AnimatedPressable
        style={[styles.circleButton, styles.playButton, playAnimatedStyle]}
        onPress={onPlayPress}
        onPressIn={() => handlePressIn('play')}
        onPressOut={() => handlePressOut('play')}>
        <View style={styles.playIconContainer}>
          <PlayIcon color={theme.colors.background} size={moderateScale(18)} />
        </View>
      </AnimatedPressable>
      <AnimatedPressable
        style={[styles.circleButton, shuffleAnimatedStyle]}
        onPress={onShufflePress}
        onPressIn={() => handlePressIn('shuffle')}
        onPressOut={() => handlePressOut('shuffle')}>
        <ShuffleIcon color={theme.colors.text} size={moderateScale(20)} />
      </AnimatedPressable>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: moderateScale(16),
      paddingVertical: moderateScale(4),
      paddingHorizontal: moderateScale(20),
    },
    circleButton: {
      width: moderateScale(42),
      height: moderateScale(42),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
      padding: moderateScale(8),
    },
    playButton: {
      width: moderateScale(42),
      height: moderateScale(42),
      backgroundColor: theme.colors.text,
    },
    playIconContainer: {
      paddingLeft: moderateScale(4),
    },
  });
