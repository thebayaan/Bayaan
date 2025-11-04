import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {PlayIcon, ShuffleIcon, PauseIcon, DownloadIcon} from '@/components/Icons';
import Color from 'color';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);



interface CollectionActionButtonsProps {
  onShufflePress: () => void;
  onPlayPress: () => void;
  showDownloadIcon?: boolean;
  onDownloadPress?: () => void;
  disabled?: boolean;
  isPlaying?: boolean;
}

export const CollectionActionButtons: React.FC<
  CollectionActionButtonsProps
> = ({onShufflePress, onPlayPress, showDownloadIcon = false, onDownloadPress, disabled = false, isPlaying = false}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Animation values for button press feedback
  const shuffleScale = useSharedValue(1);
  const playScale = useSharedValue(1);

  const shuffleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: shuffleScale.value}],
  }));

  const playAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: playScale.value}],
  }));

  const handlePressIn = React.useCallback((button: 'shuffle' | 'play') => {
    const scale = button === 'shuffle' ? shuffleScale : playScale;
    scale.value = withSpring(0.92, {
      damping: 15,
      stiffness: 300,
    });
  }, [shuffleScale, playScale]);

  const handlePressOut = React.useCallback((button: 'shuffle' | 'play') => {
    const scale = button === 'shuffle' ? shuffleScale : playScale;
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  }, [shuffleScale, playScale]);

  return (
    <View style={showDownloadIcon ? styles.actionButtons : styles.actionButtonsWithoutDownload}>
      {showDownloadIcon && (
        <TouchableOpacity
          activeOpacity={0.99}
          style={styles.actionButton}
          onPress={onDownloadPress}
          disabled={!onDownloadPress || disabled}>
          <DownloadIcon
            color={onDownloadPress && !disabled ? theme.colors.text : theme.colors.textSecondary + '40'}
            size={moderateScale(28)}
          />
        </TouchableOpacity>
      )}
      <View style={styles.rightAlignedButtons}>
        <AnimatedTouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.circleButton,
            shuffleAnimatedStyle,
            disabled && styles.buttonDisabled,
          ]}
          onPress={onShufflePress}
          onPressIn={() => !disabled && handlePressIn('shuffle')}
          onPressOut={() => !disabled && handlePressOut('shuffle')}
          disabled={disabled}>
          <ShuffleIcon color={theme.colors.text} size={moderateScale(20)} />
        </AnimatedTouchableOpacity>
        <AnimatedTouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.circleButton,
            styles.playButton,
            playAnimatedStyle,
            disabled && styles.buttonDisabled,
          ]}
          onPress={onPlayPress}
          onPressIn={() => !disabled && handlePressIn('play')}
          onPressOut={() => !disabled && handlePressOut('play')}
          disabled={disabled}>
          <View style={styles.playIconContainer}>
            {isPlaying ? (
              <PauseIcon color={theme.colors.background} size={moderateScale(16)} />
            ) : (
              <PlayIcon color={theme.colors.background} size={moderateScale(16)} />
            )}
          </View>
        </AnimatedTouchableOpacity>
      </View>
    </View>
  );
});

CollectionActionButtons.displayName = 'CollectionActionButtons';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(5),
    },
    actionButtonsWithoutDownload: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(5),
    },
    actionButton: {
      padding: moderateScale(8),
    },
    rightAlignedButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
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
      backgroundColor: theme.colors.text,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    playIconContainer: {
      paddingLeft: moderateScale(4),
    },
  });
