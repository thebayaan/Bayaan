import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {
  TimerIcon,
  RepeatIcon,
  RepeatOneIcon,
  QueueIcon,
} from '@/components/Icons';
import {usePlayerBackground} from '@/hooks/usePlayerBackground';

interface PlayerControlButtonsProps {
  playbackSpeed: number;
  repeatMode: 'off' | 'all' | 'once';
  sleepTimer: NodeJS.Timeout | null;
  isEndOfSurahTimer: boolean;
  onSpeedPress: () => void;
  onRepeatPress: () => void;
  onSleepTimerPress: () => void;
  onQueuePress: () => void;
}

const PlayerControlButtons: React.FC<PlayerControlButtonsProps> = ({
  playbackSpeed,
  repeatMode,
  sleepTimer,
  isEndOfSurahTimer,
  onSpeedPress,
  onRepeatPress,
  onSleepTimerPress,
  onQueuePress,
}) => {
  const {theme} = useTheme();
  const {gradientColors} = usePlayerBackground(theme, theme.isDarkMode);

  // Calculate contrasting colors based on background
  const baseColor = Color(gradientColors[0]);

  // Create more contrast by increasing the color difference
  const contrastColor = baseColor.isLight()
    ? baseColor.darken(0.8).saturate(0.2)
    : baseColor.lighten(2.2).saturate(1.2);

  // Create a subtle background color for the buttons
  const buttonBgColor = baseColor.isLight()
    ? baseColor.darken(0.2).alpha(0.2)
    : baseColor.lighten(0.4).alpha(0.2);

  // Create a high contrast version for active states (using TrackInfo.tsx calculations)
  const activeButtonBg = baseColor.isLight()
    ? baseColor.darken(0.8).saturate(0.2) // Match TrackInfo.tsx contrast
    : baseColor.lighten(4.8).saturate(0.2); // Match TrackInfo.tsx contrast

  // Create a contrasting text color for active states
  const activeTextColor = baseColor.isLight()
    ? Color('white').alpha(0.95) // For light bg (dark button), use white text
    : Color('black').alpha(0.95); // For dark bg (light button), use black text

  const styles = createStyles(
    theme,
    contrastColor.string(),
    buttonBgColor.string(),
    activeButtonBg.string(),
    activeTextColor.string(),
  );

  return (
    <View style={styles.container}>
      <View style={styles.buttonWrapper}>
        <TouchableOpacity
          activeOpacity={0.99}
          onPress={onSpeedPress}
          style={[styles.button, playbackSpeed !== 1 && styles.activeButton]}>
          <Text
            style={[
              styles.speedButtonText,
              playbackSpeed !== 1 && styles.activeText,
            ]}>
            {`${playbackSpeed}`}
            <Text style={styles.speedX}>x</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonWrapper}>
        <TouchableOpacity
          activeOpacity={0.99}
          onPress={onRepeatPress}
          style={[styles.button, repeatMode !== 'off' && styles.activeButton]}>
          {repeatMode === 'off' && (
            <RepeatIcon
              size={moderateScale(20)}
              color={contrastColor.string()}
            />
          )}
          {repeatMode === 'all' && (
            <RepeatIcon
              size={moderateScale(20)}
              color={activeTextColor.string()}
            />
          )}
          {repeatMode === 'once' && (
            <RepeatOneIcon
              size={moderateScale(20)}
              color={activeTextColor.string()}
            />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.buttonWrapper}>
        <TouchableOpacity
          activeOpacity={0.99}
          onPress={onSleepTimerPress}
          style={[
            styles.button,
            (sleepTimer || isEndOfSurahTimer) && styles.activeButton,
          ]}>
          <TimerIcon
            color={
              sleepTimer || isEndOfSurahTimer
                ? activeTextColor.string()
                : contrastColor.string()
            }
            size={moderateScale(22)}
            filled={!!(sleepTimer || isEndOfSurahTimer)}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.buttonWrapper}>
        <TouchableOpacity
          activeOpacity={0.99}
          onPress={onQueuePress}
          style={[styles.button, styles.queueButton]}>
          <QueueIcon size={moderateScale(20)} color={contrastColor.string()} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (
  theme: Theme,
  textColor: string,
  buttonBgColor: string,
  activeButtonBg: string,
  activeTextColor: string,
) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      width: '100%',
      paddingVertical: moderateScale(16),
    },
    buttonWrapper: {
      alignItems: 'center',
      width: moderateScale(60),
      height: moderateScale(40),
    },
    button: {
      backgroundColor: buttonBgColor,
      padding: moderateScale(3.5),
      borderRadius: moderateScale(9),
      justifyContent: 'center',
      alignItems: 'center',
    },
    speedButtonText: {
      color: textColor,
      fontSize: moderateScale(16),
      fontWeight: '500',
      opacity: 0.9,
    },
    speedX: {
      fontSize: moderateScale(14),
      fontWeight: '600',
    },
    activeText: {
      color: activeTextColor,
      opacity: 1,
      fontWeight: '600',
    },
    activeButton: {
      // transform: [{scale: 1.05}],
      backgroundColor: activeButtonBg,
    },
    queueButton: {
      opacity: 0.9,
    },
  });

export default PlayerControlButtons;
