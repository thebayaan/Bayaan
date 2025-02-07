import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {
  TimerIcon,
  RepeatIcon,
  RepeatOneIcon,
  QueueIcon,
} from '@/components/Icons';

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

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.99}
        onPress={onSpeedPress}
        style={[
          styles.button,
          styles.speedButton,
          playbackSpeed !== 1 && styles.activeButton,
          (playbackSpeed === 0.5 || playbackSpeed === 1.5) &&
            styles.mediumButton,
          (playbackSpeed === 0.75 ||
            playbackSpeed === 1.25 ||
            playbackSpeed === 1.75) &&
            styles.expandedButton,
        ]}>
        <Text
          style={[
            styles.speedButtonText,
            playbackSpeed !== 1 && styles.activeText,
          ]}>
          {`${playbackSpeed}`}
          <Text style={styles.speedX}>x</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.99}
        onPress={onRepeatPress}
        style={[
          styles.button,
          styles.middleButton,
          repeatMode !== 'off' && styles.activeButton,
        ]}>
        {repeatMode === 'off' && (
          <RepeatIcon size={moderateScale(20)} color={theme.colors.text} />
        )}
        {repeatMode === 'all' && (
          <RepeatIcon size={moderateScale(20)} color={theme.colors.card} />
        )}
        {repeatMode === 'once' && (
          <RepeatOneIcon size={moderateScale(20)} color={theme.colors.card} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.99}
        onPress={onSleepTimerPress}
        style={[
          styles.button,
          styles.middleButton,
          (sleepTimer !== null || isEndOfSurahTimer) && styles.activeButton,
        ]}>
        <TimerIcon
          color={
            sleepTimer !== null || isEndOfSurahTimer
              ? theme.colors.card
              : theme.colors.text
          }
          size={moderateScale(22)}
          filled={!!(sleepTimer !== null || isEndOfSurahTimer)}
        />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.99}
        onPress={onQueuePress}
        style={[styles.button, styles.queueButton]}>
        <QueueIcon size={moderateScale(20)} color={theme.colors.text} />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(25),
      marginHorizontal: moderateScale(80),
    },
    button: {
      width: moderateScale(28),
      height: moderateScale(28),
      borderRadius: moderateScale(20),
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    speedButton: {
      borderTopRightRadius: moderateScale(8),
      borderBottomRightRadius: moderateScale(8),
      borderTopLeftRadius: moderateScale(20),
      borderBottomLeftRadius: moderateScale(20),
    },
    middleButton: {
      borderRadius: moderateScale(8),
    },
    activeButton: {
      backgroundColor: theme.colors.text,
    },
    speedButtonText: {
      fontSize: moderateScale(16),
      fontWeight: '600',
      color: theme.colors.text,
    },
    activeText: {
      color: theme.colors.card,
    },
    speedX: {
      fontSize: moderateScale(14),
    },
    mediumButton: {
      width: moderateScale(42),
      paddingHorizontal: moderateScale(3),
    },
    expandedButton: {
      width: moderateScale(50),
      paddingHorizontal: moderateScale(4),
    },
    queueButton: {
      marginLeft: moderateScale(4),
    },
  });

export default PlayerControlButtons;
